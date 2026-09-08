import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PreferencesPage } from './preferences.page';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeGeneratorService } from '../../services/recipe-generator.service';
import { RecipeStoreService } from '../../services/recipe-store.service';
import { QuotaService } from '../../services/quota.service';
import { generatedRecipes, requirements } from '../../../testing/recipe.fixture';

let page: PreferencesPage;
let http: HttpTestingController;
let store: RecipeStoreService;
let router: jasmine.SpyObj<Router>;

/**
 * Creates the generation flow with intercepted HTTP and isolated browser storage.
 */
function configurePreferences(): void {
  spyOn(Storage.prototype, 'getItem').and.returnValue(null);
  spyOn(Storage.prototype, 'setItem').and.stub();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const generator = TestBed.inject(RecipeGeneratorService);
  generator.requirements = structuredClone(requirements);
  store = TestBed.inject(RecipeStoreService);
  http = TestBed.inject(HttpTestingController);
  router = jasmine.createSpyObj('Router', ['navigate']);
  page = new PreferencesPage(generator, store, TestBed.inject(QuotaService), TestBed.inject(RecipeApiService), router);
}



/**
 * Keeps generated results after a failed save and retries storage without another AI request.
 */
function retriesStorageOnly(): void {
  page.generateRecipes();
  page.generateRecipes();
  http.expectOne(/** Matches generation. @param request HTTP request. */ (request) => request.method === 'POST').flush({ recipes: backendRecipes(), persisted: false });
  flushRecovery(false);
  expect(store.pendingRecipes.length).toBe(3);
  expect(page.loading).toBeFalse();
  expect(page.generationDisabled).toBeTrue();
  page.checkStorage();
  flushRecovery(true);
  expect(store.pendingRecipes.length).toBe(0);
  expect(store.generatedRecipes.length).toBe(3);
  expect(router.navigate).toHaveBeenCalledWith(['/recipe-results']);
}



/** Returns the stable identifiers supplied by the current backend. */
function backendRecipes() {
  return generatedRecipes().map(/** Adds a deterministic server key. @param recipe Generated recipe. @param index Batch position. */ (recipe, index) => ({ ...recipe, id: 'server-' + index }));
}



/** Completes all pending read-only storage checks. @param complete Whether every record exists. */
function flushRecovery(complete: boolean): void {
  for (const [index, recipe] of store.pendingRecipes.entries()) {
    const request = http.expectOne(/** Matches the retained key. @param request HTTP request. */ (request) => request.url.endsWith(`/${recipe.id}.json`));
    expect(request.request.method).toBe('GET');
    request.flush(complete || index < 2 ? recipe : null);
  }
}



/**
 * Prevents a generation when fewer than three recipe slots remain.
 */
function blocksExhaustedQuota(): void {
  page.quota.set({ ipLimit: 3, ipUsed: 1, ipRemaining: 2, systemLimit: 12, systemUsed: 1, systemRemaining: 11 });
  expect(page.generationDisabled).toBeTrue();
  page.generateRecipes();
  http.expectNone(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'POST');
}



/**
 * Rejects incomplete generator responses before sending any Firebase write.
 */
function rejectsIncompleteGeneration(): void {
  page.generateRecipes();
  http.expectOne(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'POST').flush(generatedRecipes().slice(0, 2));
  http.expectNone(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'PATCH');
  expect(page.errorMessage).toBeTruthy();
  expect(page.loading).toBeFalse();
}



/** Uses confirmed backend IDs without a redundant browser write. */
function acceptsBackendPersistence(): void {
  page.generateRecipes();
  const recipes = generatedRecipes().map(/** Maps the current item to its output value. @param recipe Current callback input. @param index Current callback input. */ (recipe, index) => ({ ...recipe, id: 'server-' + index }));
  http.expectOne(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'POST').flush({ recipes, persisted: true });
  http.expectNone(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'PATCH');
  expect(store.generatedRecipes[0].id).toBe('server-0');
  expect(router.navigate).toHaveBeenCalledWith(['/recipe-results']);
}



/** Retains the original batch across denied reads without trying a public write. */
function retriesBackendStorage(): void {
  page.generateRecipes();
  const recipes = backendRecipes();
  http.expectOne(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'POST').flush({ recipes, persisted: false });
  const reads = http.match(/** Collects the pending recovery reads. @param request HTTP request. */ (request) => request.method === 'GET');
  reads[0].flush({ error: 'Permission denied' }, { status: 401, statusText: 'Unauthorized' });
  expect(store.pendingRecipes[0].id).toBe('server-0');
  expect(page.errorMessage).toContain('contact the site owner');
  page.checkStorage();
  flushRecovery(true);
  expect(store.generatedRecipes[0].id).toBe('server-0');
}



/**
 * Registers the user-visible generation failure regressions.
 */
function preferencesSuite(): void {
  beforeEach(configurePreferences);
  afterEach(/** Verifies and cleans up the completed test. */ () => http.verify());
  it('prevents double generation and rechecks partial storage using only reads', retriesStorageOnly);
  it('requires three available recipe slots', blocksExhaustedQuota);
  it('rejects incomplete generator responses', rejectsIncompleteGeneration);
  it('uses backend-persisted recipes without another write', acceptsBackendPersistence);
  it('retains backend IDs after a denied read without public writes', retriesBackendStorage);
}



describe('PreferencesPage', preferencesSuite);
