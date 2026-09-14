import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PreferencesPage } from './preferences.page';
import { RecipeGeneratorService } from '../../services/recipe-generator.service';
import { RecipeStoreService } from '../../services/recipe-store.service';
import { QuotaService } from '../../services/quota.service';
import { RecipeApiService } from '../../services/recipe-api.service';

const free = { ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 0, systemRemaining: 12 };
let page: PreferencesPage;
let http: HttpTestingController;
let draft = new Map<string, string>();

/** Isolates browser state and every backend request. */
function setup(): void {
  draft = new Map();
  spyOn(Storage.prototype, 'getItem').and.callFake(/** Reads test storage. @param key Key. */ key => draft.get(key) ?? null);
  spyOn(Storage.prototype, 'setItem').and.callFake(/** Writes test storage. @param key Key. @param value Value. */ (key, value) => draft.set(key, value));
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  page = new PreferencesPage(TestBed.inject(RecipeGeneratorService), TestBed.inject(RecipeStoreService), TestBed.inject(QuotaService), TestBed.inject(RecipeApiService), jasmine.createSpyObj<Router>('Router', ['navigate']));
  page.generator.addIngredient({ ingredient: 'Carrot', servingSize: '500g', isEditMode: false });
}



/** Checks actual defaults and committed values across a fresh service instance. */
function restoresDraft(): void {
  expect(page.generator.canGenerate()).toBeTrue();
  page.generator.selectPreference('dietPreferences', 'vegan');
  page.generator.changeAmount('portionsAmount', 1);
  const restored = new RecipeGeneratorService(TestBed.inject(HttpClient));
  expect(restored.requirements).toEqual(page.generator.requirements);
  expect(restored.canGenerate()).toBeTrue();
}



/** Tests unknown, delayed and available quota without a model call. */
function delayedQuota(): void {
  expect(page.generationDisabled).toBeTrue();
  page.ngOnInit();
  expect(page.quotaChecking).toBeTrue();
  tick(1000);
  expect(page.generationDisabled).toBeTrue();
  http.expectOne(/** Matches quota. @param r Request. */ r => r.method === 'GET').flush(free);
  expect(page.quotaChecking).toBeFalse();
  expect(page.generationDisabled).toBeFalse();
}



/** Technical status failures stay blocked and support an explicit successful retry. */
function quotaFailure(): void {
  page.ngOnInit();
  http.expectOne(/** Matches quota. @param r Request. */ r => r.method === 'GET').flush({}, { status: 503, statusText: 'Unavailable' });
  expect(page.quota.status).toBeNull();
  expect(page.generationDisabled).toBeTrue();
  expect(page.showQuantityPopup).toBeFalse();
  page.refreshQuota();
  http.expectOne(/** Matches retry. @param r Request. */ r => r.method === 'GET').flush(free);
  expect(page.generationDisabled).toBeFalse();
}



/** Applies the three-slot rule independently to IP and system counters. */
function limits(): void {
  page.quota.set({ ...free, ipUsed: 3, ipRemaining: 0 });
  expect(page.generationBlockedReason).toContain('Your daily limit');
  expect(page.generationBlockedReason).toBe(page.quotaBlockedReason);
  page.quota.set({ ...free, systemUsed: 10, systemRemaining: 2 });
  expect(page.generationBlockedReason).toContain('System capacity');
  page.generateRecipes();
  http.expectNone(/** Rejects paid calls. @param r Request. */ r => r.method === 'POST');
  expect(page.showQuantityPopup).toBeFalse();
}



/** Invalid quota data and stalled requests never masquerade as available slots. */
function invalidAndTimeout(): void {
  page.refreshQuota();
  http.expectOne(/** Matches quota. */ () => true).flush({ ipRemaining: 3 });
  expect(page.generationDisabled).toBeTrue();
  page.refreshQuota();
  const pending = http.expectOne(/** Matches retry. */ () => true);
  tick(15000);
  expect(pending.cancelled).toBeTrue();
  expect(page.quotaChecking).toBeFalse();
  expect(page.generationDisabled).toBeTrue();
}



/** Missing ingredients get an explicit recovery path rather than an unexplained disabled button. */
function missingIngredients(): void {
  page.quota.set(free);
  page.generator.removeIngredient(page.generator.requirements.ingredients[0]);
  expect(page.generationBlockedReason).toContain('Add ingredients');
  expect(page.generationDisabled).toBeTrue();
}



describe('Generation readiness and reload', /** Registers isolated regression cases. */ () => {
  beforeEach(setup);
  afterEach(/** Ensures there are no unhandled requests. */ () => http.verify());
  it('restores ingredients and real default selections', restoresDraft);
  it('waits for confirmed availability', fakeAsync(delayedQuota));
  it('recovers explicitly from quota failure', quotaFailure);
  it('requires three slots in both quotas', limits);
  it('rejects malformed status and releases timed-out checks', fakeAsync(invalidAndTimeout));
  it('explains missing ingredients', missingIngredients);
});
