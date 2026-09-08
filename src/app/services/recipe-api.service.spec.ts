import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RecipeApiService } from './recipe-api.service';
import { generatedRecipes } from '../../testing/recipe.fixture';

let api: RecipeApiService;
let http: HttpTestingController;

/**
 * Configures an isolated HTTP backend; tests cannot contact production.
 */
function configureApi(): void {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  api = TestBed.inject(RecipeApiService);
  http = TestBed.inject(HttpTestingController);
}



/**
 * Recovers an uncertain acknowledgement through reads and preserves current likes.
 */
function confirmsSavedBatch(): void {
  const recipes = api.prepareGeneratedRecipes(generatedRecipes());
  api.confirmStoredRecipes(recipes).subscribe(/** Checks live likes after recovery. @param saved Confirmed recipes. */ (saved) => expect(saved.map(/** Reads the current count. @param recipe Stored recipe. */ (recipe) => recipe.likes)).toEqual([2, 2, 2]));
  for (const recipe of recipes) {
    const stored = { ...recipe, ingredients: { yourIngredients: recipe.ingredients.yourIngredients }, likes: 2 };
    const request = http.expectOne(/** Matches the original key. @param request HTTP request. */ (request) => request.url.endsWith(`/${recipe.id}.json`));
    expect(request.request.method).toBe('GET');
    request.flush(stored);
  }
}



/**
 * Rejects missing records and records whose title exists but whose contents are partial.
 */
function rejectsPartialStorage(): void {
  const recipes = api.prepareGeneratedRecipes(generatedRecipes());
  for (const partial of [null, { title: recipes[2].title }]) {
    const failed = jasmine.createSpy('failed');
    api.confirmStoredRecipes(recipes).subscribe({ next: fail, error: failed });
    recipes.forEach(/** Completes the batch with one incomplete record. @param recipe Expected recipe. @param index Batch position. */ (recipe, index) => {
      http.expectOne(/** Matches the original key. @param request HTTP request. */ (request) => request.url.endsWith(`/${recipe.id}.json`)).flush(index === 2 ? partial : recipe);
    });
    expect(failed).toHaveBeenCalled();
  }
}



/**
 * Verifies concurrent likes are retried only after an explicit ETag conflict.
 */
function retriesLikeConflict(): void {
  api.changeLikes('recipe', 1).subscribe(/** Handles the emitted asynchronous result. @param likes Current callback input. */ (likes) => expect(likes).toBe(3));
  http.expectOne(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'GET').flush(1, { headers: { ETag: 'v1' } });
  const first = http.expectOne(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'PUT');
  expect(first.request.headers.get('if-match')).toBe('v1');
  first.flush(2, { status: 412, statusText: 'Conflict' });
  http.expectOne(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'GET').flush(2, { headers: { ETag: 'v2' } });
  const retry = http.expectOne(/** Handles the current value in the enclosing operation. @param request Current callback input. */ (request) => request.method === 'PUT');
  expect(retry.request.body).toBe(3);
  retry.flush(3);
}



/** Avoids an invalid decrement after another anonymous visitor already reached zero. */
function handlesZeroLikes(): void {
  api.changeLikes('recipe', -1).subscribe(/** Confirms the shared minimum. @param likes Current count. */ (likes) => expect(likes).toBe(0));
  http.expectOne(/** Matches the counter read. @param request HTTP request. */ (request) => request.method === 'GET').flush(null, { headers: { ETag: 'zero' } });
  http.expectNone(/** Rejects redundant writes. @param request HTTP request. */ (request) => request.method === 'PUT');
}



/**
 * Registers isolated persistence and concurrency regressions.
 */
function apiSuite(): void {
  beforeEach(configureApi);
  afterEach(/** Verifies and cleans up the completed test. */ () => http.verify());
  it('confirms all stored contents using only reads and preserves likes', confirmsSavedBatch);
  it('rejects missing or partially stored recipe contents', rejectsPartialStorage);
  it('uses ETags to preserve concurrent likes', retriesLikeConflict);
  it('handles an unlike when the shared count is already zero', handlesZeroLikes);
}



describe('RecipeApiService', apiSuite);
