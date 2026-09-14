import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, tick, TestBed } from '@angular/core/testing';
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
  TestBed.inject(QuotaService).set({ ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 0, systemRemaining: 12 });
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



/** Verifies the global cost limit. */
function blocksGlobalQuota(): void {
    page.quota.set({ ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 12, systemRemaining: 0 });
    page.generateRecipes();
    expect(page.generationDisabled).toBeTrue();
    http.expectNone(/** Matches model requests. @param request HTTP request. */ request => request.method === 'POST');

}



/** Verifies gateway failure handling. */
function reportsGatewayError(): void {
    page.generateRecipes();
    http.expectOne(/** Matches generation. @param request HTTP request. */ request => request.method === 'POST')
      .flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    expect(page.errorMessage).toContain('technical error');
    expect(page.loading).toBeFalse();
    expect(page.showQuantityPopup).toBeFalse();
    http.expectOne(/** Matches the single reconciliation read. @param request HTTP request. */ request => request.method === 'GET')
      .flush({ ipLimit: 3, ipUsed: 3, ipRemaining: 0, systemLimit: 12, systemUsed: 3, systemRemaining: 9 });
    expect(page.generationDisabled).toBeTrue();
    http.expectNone(/** Detects forbidden retries. @param request HTTP request. */ request => request.method === 'POST');

}



/** Separates an explicit future quantity contract from technical, schema and quota errors. */
function quantityErrorCases(): void {
  for (const [status, code, portions, opens] of [[422, 'INSUFFICIENT_INGREDIENT_QUANTITIES', 2, true],
    [422, 'INSUFFICIENT_INGREDIENT_QUANTITIES', 12, false], [422, 'SCHEMA_REJECTED', 2, false],
    [502, 'MODEL_OUTPUT_INVALID', 2, false], [422, 'MODEL_QUANTITY_EXCEEDS_AVAILABLE', 2, false], [502, 'MODEL_UNAVAILABLE', 2, false], [400, '', 2, false], [502, 'INSUFFICIENT_INGREDIENT_QUANTITIES', 2, false],
    [429, 'IP_LIMIT', 2, false], [429, 'SYSTEM_LIMIT', 2, false], [0, '', 2, false]] as const) {
    it('quantity dialog classification ' + status + '/' + code + '/' + portions, /** Checks one isolated response. */ () => {
      page.generateRecipes();
      http.expectOne(/** Finds the sole model request. @param request HTTP request. */ request => request.method === 'POST')
        .flush({ code, portionsAmount: portions, detail: 'Insufficient quantities for selected servings.', quota: { ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 0, systemRemaining: 12 } }, { status, statusText: 'Test error' });
      expect(page.showQuantityPopup).toBe(opens);
      expect(page.loading).toBeFalse();
    });
  }
}



/** Keeps original input and preferences when returning from the dialog. */
function retainsQuantityInputs(): void {
  const before = structuredClone(page.generator.requirements);
  router.navigate.and.resolveTo(true);
  page.showQuantityPopup = true;
  page.backToIngredients();
  expect(page.showQuantityPopup).toBeFalse();
  expect(page.generator.requirements).toEqual(before);
  expect(router.navigate).toHaveBeenCalledWith(['/generate-recipe']);
}



/** Ends a stalled generation without retrying. */
function stalledGeneration(): void {
    page.generateRecipes();
    const generation = http.expectOne(/** Captures the only model request. */ request => request.method === 'POST');
    tick(240000);
    expect(generation.cancelled).toBeTrue();
    expect(page.loading).toBeFalse();
    expect(page.showQuantityPopup).toBeFalse();
    expect(page.errorMessage).toContain('technical error');
    http.expectOne(/** Captures the sole quota reconciliation. */ request => request.method === 'GET').flush({ ipLimit: 3, ipUsed: 3, ipRemaining: 0, systemLimit: 12, systemUsed: 3, systemRemaining: 9 });
    http.expectNone(/** Rejects automatic model retries. */ request => request.method === 'POST');
}



/** Registers recovery cases without a model or production database. */
function registerRecoveryCases(): void {
  it('ends a stalled generation and reconciles quota once without opening the quantity dialog', fakeAsync(stalledGeneration));
  it('retains inputs when leaving the quantity dialog', retainsQuantityInputs);
  it('keeps configuration failures outside the input dialog', rejectsConfigurationPopup);
}



/**
 * Registers the user-visible generation failure regressions.
 */
function preferencesSuite(): void {
  beforeEach(configurePreferences);
  afterEach(/** Verifies and cleans up the completed test. */ () => http.verify());
  quantityErrorCases();
  it('opens the input dialog only for classified invalid input', rejectsInput);
  registerRecoveryCases();
  it('prevents double generation and rechecks partial storage using only reads', retriesStorageOnly);
  it('requires three available recipe slots', blocksExhaustedQuota);
  it('rejects incomplete generator responses', rejectsIncompleteGeneration);
  it('uses backend-persisted recipes without another write', acceptsBackendPersistence);
  it('retains backend IDs after a denied read without public writes', retriesBackendStorage);
  it('blocks a globally exhausted quota even with free IP slots', blocksGlobalQuota);
  it('reports a raw 502 as a technical error without retrying', reportsGatewayError);
}



describe('PreferencesPage', preferencesSuite);



/** Verifies the backend input contract without issuing a real request. */
function rejectsInput(): void {
  page.generateRecipes();
  http.expectOne(/** Matches generation. @param request HTTP request. */ request => request.method === 'POST')
    .flush({ code: 'INVALID_RECIPE_INPUT', detail: 'Please combine duplicate ingredients.', quota: null }, { status: 400, statusText: 'Bad Request' });
  expect(page.showQuantityPopup).toBeTrue();
  expect(page.popupMessage).toBe('Please combine duplicate ingredients.');
  expect(page.loading).toBeFalse();
  expect(router.navigate).not.toHaveBeenCalled();
}



/** Technical configuration faults must never blame ingredient input. */
function rejectsConfigurationPopup(): void {
  page.generateRecipes();
  http.expectOne(/** Matches generation. @param request HTTP request. */ request => request.method === 'POST')
    .flush({ code: 'BACKEND_CONFIGURATION_ERROR', detail: 'Contact the site operator.', quota: null }, { status: 400, statusText: 'Bad Request' });
  expect(page.showQuantityPopup).toBeFalse();
  expect(page.errorMessage).toBe('Contact the site operator.');
}



/** Checks every input blocker against the same decision used by the button. */
function checksInputTransitions(): void {
  expect(page.generationDisabled).toBeFalse();
  const original = structuredClone(page.generator.requirements);
  page.generator.requirements.ingredients = [];
  expect(page.generationBlockedReason).toContain('Add ingredients');
  page.generator.requirements = structuredClone(original);
  page.generator.requirements.ingredients[0].isEditMode = true;
  expect(page.generationBlockedReason).toContain('Finish editing');
  page.generator.requirements = structuredClone(original); page.generator.requirements.cuisine = '';
  expect(page.generationBlockedReason).toContain('Choose a cooking time');
  page.generator.requirements = original;
  expect(page.generationDisabled).toBeFalse();
}



/** Verifies a timeout, a retry and a delayed success cannot leave stale loading flags. */
function checksQuotaTransitions(): void {
  page.refreshQuota(); expect(page.generationBlockedReason).toContain('Checking');
  const pending = http.expectOne(/** Finds the quota request. @param request HTTP request. */ request => request.method === 'GET');
  tick(15000); expect(pending.cancelled).toBeTrue(); expect(page.quotaChecking).toBeFalse();
  expect(page.generationBlockedReason).toContain('Availability is unknown');
  page.refreshQuota(); expect(page.generationDisabled).toBeTrue(); tick(1000);
  http.expectOne(/** Finds the retry. @param request HTTP request. */ request => request.method === 'GET')
    .flush({ ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 0, systemRemaining: 12 });
  expect(page.quotaChecking).toBeFalse(); expect(page.generationDisabled).toBeFalse();
  http.expectNone(/** No model request during availability recovery. @param request HTTP request. */ request => request.method === 'POST');
}



describe('Generation eligibility transitions', /** Guards the visible blocker and request lifecycle. */ () => {
  beforeEach(configurePreferences);
  afterEach(/** Rejects leftover requests. */ () => http.verify());
  it('distinguishes missing ingredients, unfinished edits and missing preferences', checksInputTransitions);
  it('recovers from quota timeout without generating', fakeAsync(checksQuotaTransitions));
});




/** Malformed error metadata must still release loading and expose recovery. */
function malformedFailureQuota(): void {
  page.generateRecipes();
  http.expectOne(/** Finds the sole generation. @param request HTTP request. */ request => request.method === 'POST')
    .flush({ quota: { ipRemaining: 3 } }, { status: 502, statusText: 'Bad Gateway' });
  expect(page.loading).toBeFalse(); expect(page.showQuantityPopup).toBeFalse();
  expect(page.errorMessage).toContain('technical error');
  http.expectOne(/** Reconciles once. @param request HTTP request. */ request => request.method === 'GET')
    .flush({ ipLimit: 3, ipUsed: 3, ipRemaining: 0, systemLimit: 12, systemUsed: 3, systemRemaining: 9 });
  expect(page.generationBlockedReason).toContain('daily recipe limit');
}



describe('Malformed generation error recovery', /** Keeps technical errors outside the ingredient popup. */ () => {
  beforeEach(configurePreferences);
  afterEach(/** Rejects leftover or repeated requests. */ () => http.verify());
  it('handles invalid quota metadata without throwing out of the error handler', malformedFailureQuota);
});
