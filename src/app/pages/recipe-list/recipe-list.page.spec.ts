import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { RecipeListPage } from './recipe-list.page';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeStoreService } from '../../services/recipe-store.service';
import { generatedRecipes } from '../../../testing/recipe.fixture';

/** Creates an isolated category page with predictable saved recipes. */
function categoryPage(page: string | null, count = 121): RecipeListPage {
  const params = convertToParamMap({ cuisine: 'italian', ...(page === null ? {} : { page }) });
  const route = { snapshot: { queryParamMap: params }, queryParamMap: of(params) } as ActivatedRoute;
  const recipes = Array.from({ length: count }, /** Creates a unique fixture. */ (_, index) => ({ ...generatedRecipes()[0], id: String(index) }));
  const api = { getByCuisine: /** Returns fixtures without HTTP. */ () => of(recipes) } as unknown as RecipeApiService;
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  const list = new RecipeListPage(new RecipeStoreService(), api, route, router);
  list.ngOnInit();
  return list;
}



/** Checks direct links, clamps invalid pages and preserves category return context. */
function restoresPagination(): void {
  const list = categoryPage('3');
  expect(list.currentPage).toBe(3);
  expect(list.pageRecipes[0].id).toBe('30');
  expect(list.pageRecipes.length).toBe(15);
  list.goToPage(4);
  expect(categoryPage(null).currentPage).toBe(4);
  expect(categoryPage('999').currentPage).toBe(9);
  expect(categoryPage('bad').currentPage).toBe(1);
  expect(categoryPage('-1').currentPage).toBe(1);
}



/** Covers calculated ellipses, boundary pages and empty data. */
function handlesPaginationBounds(): void {
  const list = categoryPage('1');
  expect(list.pageNumbers).toEqual([1, 2, 3, null, 9]);
  list.previousPage(); expect(list.currentPage).toBe(1);
  list.goToPage(9); list.nextPage();
  expect(list.pageRecipes.length).toBe(1);
  expect(list.pageNumbers).toEqual([1, null, 7, 8, 9]);
  const empty = categoryPage('3', 0);
  expect(empty.currentPage).toBe(1);
  expect(empty.pageRecipes).toEqual([]);
}



/** Registers category pagination regressions without remote requests. */
function categorySuite(): void {
  it('restores URL and category pages without modifying recipe details', restoresPagination);
  it('calculates pages and ellipses for real collection sizes', handlesPaginationBounds);
}



describe('Cookbook category pagination', categorySuite);
