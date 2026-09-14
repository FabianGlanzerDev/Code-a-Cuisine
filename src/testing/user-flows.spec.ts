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
  spyOn(Storage.prototype, 'getItem').and.returnValue(null);
  spyOn(Storage.prototype, 'setItem').and.stub();
  generator = new RecipeGeneratorService(jasmine.createSpyObj<HttpClient>('HttpClient', ['post']));
  router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  entry = new IngredientEntryPage(generator, router);
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



/** Verifies pagination boundaries when a cuisine contains more than fifteen recipes. */
function paginatesRecipes(): void {
  const store = new RecipeStoreService();
  store.selectedRecipes = Array.from({ length: 41 }, /** Creates one entry for the resulting array. @param _ Current callback input. @param index Current callback input. */ (_, index) => ({ ...generatedRecipes()[0], id: String(index), likes: 0 }));
  const list = new RecipeListPage(store, {} as RecipeApiService, {} as ActivatedRoute, router);
  expect(list.pageRecipes.length).toBe(15);
  expect(list.totalPages).toBe(3);
  list.nextPage(); expect(list.pageRecipes[0].id).toBe('15');
  list.nextPage(); list.nextPage(); expect(list.pageRecipes.length).toBe(11);
  list.previousPage(); expect(list.currentPage).toBe(2);
}



/** Registers the important form and cookbook pagination flows. */
function userFlowSuite(): void {
  beforeEach(configureEntry);
  it('shows the input dialog without advancing for missing or invalid input', opensInputDialog);
  it('adds, edits and removes ingredients', editsIngredients);
  it('preserves a free-text edit after invalid input and saves the corrected name', editsFreeText);
  it('does not add again for a held Enter key', ignoresRepeatedEnter);
  it('rejects negative amounts and duplicate names', rejectsBadIngredients);
  it('enforces portion and cook limits', boundsCounters);
  it('paginates recipes at fifteen items', paginatesRecipes);
  it('accepts free-text ingredients without selecting a suggestion', acceptsFreeText);
}



describe('Ingredient and cookbook flows', userFlowSuite);



/** Verifies names outside the optional suggestions remain usable. */
function acceptsFreeText(): void {
  for (const name of ['Salatblatt', 'Purple sprouting broccoli', 'Fresh garden sorrel']) {
    entry.ingredientName = name; entry.addIngredient();
    expect(entry.errorMessage).toBe('');
    expect(generator.requirements.ingredients.at(-1)?.ingredient).toBe(name);
  }
  expect(generator.requirements.ingredients.length).toBe(3);
}



/** Verifies early rejection preserves the entered data and prevents navigation. */
function opensInputDialog(): void {
  entry.continueToPreferences(); expect(entry.showInputPopup).toBeTrue();
  expect(router.navigate).not.toHaveBeenCalled();
  entry.showInputPopup = false; entry.ingredientName = 'Carrot'; entry.servingSize = 0;
  entry.addIngredient(); expect(entry.showInputPopup).toBeTrue();
  expect(entry.ingredientName).toBe('Carrot'); expect(entry.servingSize).toBe(0);
  expect(generator.requirements.ingredients.length).toBe(0);
  entry.showInputPopup = false; entry.servingSize = 0.5; entry.addIngredient();
  expect(entry.showInputPopup).toBeFalse(); expect(generator.requirements.ingredients.length).toBe(1);
}



/** Keeps name and amount edits intact until both are valid. */
function editsFreeText(): void {
  entry.ingredientName = 'Salatblatt'; entry.addIngredient();
  const item = generator.requirements.ingredients[0]; entry.startEdit(item);
  entry.editIngredientName = 'Fresh garden sorrel'; entry.editServingSize = -1; entry.saveEdit(item);
  expect(item.ingredient).toBe('Salatblatt'); expect(item.isEditMode).toBeTrue();
  expect(entry.editIngredientName).toBe('Fresh garden sorrel'); expect(entry.showInputPopup).toBeTrue();
  entry.showInputPopup = false; entry.editServingSize = 50; entry.saveEdit(item);
  expect(item.ingredient).toBe('Fresh garden sorrel'); expect(item.servingSize).toBe('50g');
  expect(item.isEditMode).toBeFalse();
}



/** Prevents keyboard autorepeat from creating duplicate adds or error dialogs. */
function ignoresRepeatedEnter(): void {
  entry.ingredientName = 'Salatblatt';
  const field = document.createElement('div');
  entry.ingredientKey(new KeyboardEvent('keydown', { key: 'Enter' }), field);
  entry.ingredientKey(new KeyboardEvent('keydown', { key: 'Enter', repeat: true }), field);
  expect(generator.requirements.ingredients.length).toBe(1); expect(entry.showInputPopup).toBeFalse();
}
