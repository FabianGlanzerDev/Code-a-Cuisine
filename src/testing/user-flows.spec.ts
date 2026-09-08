import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { IngredientEntryPage } from '../app/pages/ingredient-entry/ingredient-entry.page';
import { RecipeListPage } from '../app/pages/recipe-list/recipe-list.page';
import { RecipeGeneratorService } from '../app/services/recipe-generator.service';
import { RecipeApiService } from '../app/services/recipe-api.service';
import { RecipeStoreService } from '../app/services/recipe-store.service';
import { generatedRecipes } from './recipe.fixture';

let generator: RecipeGeneratorService;
let entry: IngredientEntryPage;
let router: jasmine.SpyObj<Router>;

/** Creates an ingredient form that cannot issue external requests. */
function configureEntry(): void {
  generator = new RecipeGeneratorService(jasmine.createSpyObj<HttpClient>('HttpClient', ['post']));
  router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  entry = new IngredientEntryPage(generator, router);
  spyOn(Storage.prototype, 'getItem').and.returnValue(null);
}



/** Exercises adding, editing and removing ingredients with positive decimal amounts. */
function editsIngredients(): void {
  entry.ingredientName = 'Carrot'; entry.servingSize = 0.5; entry.addIngredient();
  const ingredient = generator.requirements.ingredients[0];
  expect(ingredient.servingSize).toBe('0.5g');
  entry.startEdit(ingredient); entry.continueToPreferences();
  expect(router.navigate).not.toHaveBeenCalled();
  entry.editServingSize = 200; entry.saveEdit(ingredient);
  expect(ingredient.servingSize).toBe('200g');
  entry.continueToPreferences();
  expect(router.navigate).toHaveBeenCalledWith(['/choose-preferences']);
  entry.removeIngredient(ingredient);
  expect(generator.requirements.ingredients.length).toBe(0);
}



/** Rejects invalid values and duplicate ingredient names before navigation. */
function rejectsBadIngredients(): void {
  entry.ingredientName = 'Carrot'; entry.servingSize = -1; entry.addIngredient();
  expect(generator.requirements.ingredients.length).toBe(0);
  expect(entry.errorMessage).toBeTruthy();
  entry.servingSize = 100; entry.addIngredient();
  entry.ingredientName = 'carrot'; entry.addIngredient();
  expect(generator.requirements.ingredients.length).toBe(1);
  expect(entry.errorMessage).toContain('already listed');
}



/** Enforces the checklist bounds and default portion count. */
function boundsCounters(): void {
  expect(generator.requirements.portionsAmount).toBe(2);
  generator.changeAmount('portionsAmount', 100);
  generator.changeAmount('cooksAmount', 100);
  expect(generator.requirements.portionsAmount).toBe(12);
  expect(generator.requirements.cooksAmount).toBe(3);
  generator.changeAmount('portionsAmount', -100);
  generator.changeAmount('cooksAmount', -100);
  expect(generator.requirements.portionsAmount).toBe(1);
  expect(generator.requirements.cooksAmount).toBe(1);
}



/** Verifies pagination boundaries when a cuisine contains more than twenty recipes. */
function paginatesRecipes(): void {
  const store = new RecipeStoreService();
  store.selectedRecipes = Array.from({ length: 41 }, /** Creates one entry for the resulting array. @param _ Current callback input. @param index Current callback input. */ (_, index) => ({ ...generatedRecipes()[0], id: String(index), likes: 0 }));
  const list = new RecipeListPage(store, {} as RecipeApiService, {} as ActivatedRoute);
  expect(list.pageRecipes.length).toBe(20);
  expect(list.totalPages).toBe(3);
  list.nextPage(); expect(list.pageRecipes[0].id).toBe('20');
  list.nextPage(); list.nextPage(); expect(list.pageRecipes.length).toBe(1);
  list.previousPage(); expect(list.currentPage).toBe(2);
}



/** Registers the important form and cookbook pagination flows. */
function userFlowSuite(): void {
  beforeEach(configureEntry);
  it('adds, edits and removes ingredients', editsIngredients);
  it('rejects negative amounts and duplicate names', rejectsBadIngredients);
  it('enforces portion and cook limits', boundsCounters);
  it('paginates recipes at twenty items', paginatesRecipes);
}



describe('Ingredient and cookbook flows', userFlowSuite);
