import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { IngredientEntry } from '../../models/recipe.model';
import { RecipeGeneratorService } from '../../services/recipe-generator.service';

import { InputErrorDialogComponent } from '../../components/input-error-dialog.component';

import ingredients from '../../data/ingredients.json';

interface UnitOption { name: string; abbreviation: string; }

@Component({
  selector: 'app-ingredient-entry-page',
  imports: [FormsModule, SiteHeaderComponent, InputErrorDialogComponent],
  templateUrl: './ingredient-entry.page.html',
  styleUrl: './ingredient-entry.page.css',
})
export class IngredientEntryPage {
  readonly units: UnitOption[] = [
    { name: 'piece', abbreviation: '' },
    { name: 'ml', abbreviation: 'ml' },
    { name: 'gram', abbreviation: 'g' },
  ];

  private readonly knownIngredients = ingredients;

  selectedUnit = this.units[2];
  ingredientName = '';
  servingSize = 100;
  dropdownOpen = false;
  errorMessage = '';
  showInputPopup = false;

  editingIngredient: IngredientEntry | null = null;
  editServingSize = 1;
  editUnit = this.units[0];
  editUnitDropdownOpen = false;

  /**
   * Initializes the component or service with its required dependencies.
   * @param generator Shared ingredient and preference state.
   * @param router Application router.
   */
  constructor(
    public readonly generator: RecipeGeneratorService,
    private readonly router: Router,
  ) { }



  /**
   * Returns up to three matching ingredient suggestions for the current input.
   * @returns {string[]} The result of this operation.
   */
  get ingredientSuggestions(): string[] {
    const query = this.ingredientName.trim().toLowerCase();
    if (!query) return [];

    return this.knownIngredients
      .filter(/** Checks whether the current item matches the filter. @param ingredient Current callback input. */ (ingredient) => ingredient.toLowerCase().startsWith(query))
      .slice(0, 3);
  }



  /**
   * Opens or closes the add-form unit menu.
   */
  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
    this.editUnitDropdownOpen = false;
  }



  /**
   * Selects one serving unit for a new ingredient.
   * @param unit Expected ingredient or nutrition unit.
   */
  selectUnit(unit: UnitOption): void {
    this.selectedUnit = unit;
    this.dropdownOpen = false;
  }



  /**
   * Opens or closes the inline-edit unit menu.
   */
  toggleEditUnitDropdown(): void {
    this.editUnitDropdownOpen = !this.editUnitDropdownOpen;
    this.dropdownOpen = false;
  }



  /**
   * Selects one serving unit while editing an existing ingredient.
   * @param unit Expected ingredient or nutrition unit.
   */
  selectEditUnit(unit: UnitOption): void {
    this.editUnit = unit;
    this.editUnitDropdownOpen = false;
  }



  /**
   * Copies one autocomplete suggestion into the ingredient field.
   * @param suggestion Selected autocomplete suggestion.
   */
  selectIngredientSuggestion(suggestion: string): void {
    this.ingredientName = suggestion;
  }



  /**
   * Adds the current ingredient values to the recipe request.
   */
  addIngredient(): void {
    const name = this.ingredientName.trim();
    const amount = Number(this.servingSize);
    this.errorMessage = this.validateNewIngredient(name, amount);
    if (this.errorMessage) { this.showInputPopup = true; return; }
    this.generator.addIngredient(this.createIngredient(name, amount));
    this.resetIngredientInput();
  }



  /**
   * Explains invalid input before it reaches the backend validator.
   * @param name Ingredient or node name.
   * @param amount Ingredient quantity.
   * @returns {string} The result of this operation.
   */
  private validateNewIngredient(name: string, amount: number): string {
    if (!name || name.length > 80 || !/[\p{L}]/u.test(name) || !/^[\p{L}\p{N} .,'’()\-/]+$/u.test(name)) return 'Please enter a valid ingredient name (up to 80 characters).';
    if (!this.knownIngredients.some(/** Matches a catalog name. @param food Known food. */ food => food.toLowerCase() === name.toLowerCase())) return 'This food is not in our English/German ingredient list yet. Check the spelling, use a suggestion or ask the site owner to add it. / Zutat noch unbekannt: Schreibweise prüfen oder Aufnahme anfragen.';
    if (!this.units.includes(this.selectedUnit)) return 'Please select g, ml or pieces.';
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) return 'Please enter an amount greater than 0 and at most 10000.';
    const entries = this.generator.requirements.ingredients;
    if (entries.length >= 30) return 'You can add at most 30 ingredients.';
    if (entries.some(/** Checks whether this item meets the condition. @param entry Current callback input. */ (entry) => entry.ingredient.toLowerCase() === name.toLowerCase())) return 'This ingredient is already listed. Edit its amount instead.';
    return '';
  }



  /**
   * Starts the compact inline editor shown in the design reference.
   * @param ingredient Ingredient to update.
   */
  startEdit(ingredient: IngredientEntry): void {
    if (this.editingIngredient && this.editingIngredient !== ingredient) {
      this.editingIngredient.isEditMode = false;
    }

    const parsed = this.parseServingSize(ingredient.servingSize);
    this.editingIngredient = ingredient;
    this.editServingSize = parsed.amount;
    this.editUnit = parsed.unit;
    this.editUnitDropdownOpen = false;
    ingredient.isEditMode = true;
  }



  /**
   * Saves amount and unit changes and closes the inline editor.
   * @param ingredient Ingredient to update.
   */
  saveEdit(ingredient: IngredientEntry): void {
    const amount = Number(this.editServingSize);
    if (!this.units.includes(this.editUnit)) { this.errorMessage = 'Please select g, ml or pieces.'; this.showInputPopup = true; return; }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      this.errorMessage = 'Please enter an amount greater than 0 and at most 10000.';
      this.showInputPopup = true;
      return;
    }
    this.errorMessage = '';

    ingredient.servingSize = `${amount}${this.editUnit.abbreviation}`;
    ingredient.isEditMode = false;
    this.generator.saveDraft();
    this.editingIngredient = null;
    this.editUnitDropdownOpen = false;
  }



  /**
   * Removes the selected ingredient row.
   * @param ingredient Ingredient to update.
   */
  removeIngredient(ingredient: IngredientEntry): void {
    if (this.editingIngredient === ingredient) {
      this.editingIngredient = null;
      this.editUnitDropdownOpen = false;
    }
    this.generator.removeIngredient(ingredient);
  }



  /**
   * Moves to preferences when at least one ingredient exists.
   */
  continueToPreferences(): void {
    if (this.editingIngredient) return;
    if (!this.generator.requirements.ingredients.length) {
      this.errorMessage = 'Please add at least one ingredient with a positive amount before continuing.';
      this.showInputPopup = true;
      return;
    }
    void this.router.navigate(['/choose-preferences']);
  }



  /**
   * Creates the API-compatible ingredient model from input values.
   * @param name Ingredient or node name.
   * @param amount Ingredient quantity.
   * @returns {IngredientEntry} The result of this operation.
   */
  private createIngredient(name: string, amount: number): IngredientEntry {
    return {
      ingredient: name,
      servingSize: `${amount}${this.selectedUnit.abbreviation}`,
      isEditMode: false,
    };
  }



  /**
   * Splits a stored serving string such as 100g, 250ml or 1 into amount and unit.
   * @param value Value to validate or store.
   * @returns {{ amount: number; unit: UnitOption }} The result of this operation.
   */
  private parseServingSize(value: string): { amount: number; unit: UnitOption } {
    const match = String(value).trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s*(.*)$/);
    const amount = match ? Number(match[1].replace(',', '.')) : 1;
    const suffix = (match?.[2] ?? '').trim().toLowerCase();

    if (suffix === 'g' || suffix === 'gram' || suffix === 'grams') {
      return { amount, unit: this.units[2] };
    }
    if (suffix === 'ml' || suffix === 'milliliter' || suffix === 'milliliters') {
      return { amount, unit: this.units[1] };
    }
    return { amount, unit: this.units[0] };
  }



  /**
   * Restores the ingredient form defaults after a successful add.
   */
  private resetIngredientInput(): void {
    this.ingredientName = '';
    this.servingSize = 100;
  }



  /** Closes the dialog and focuses the unchanged ingredient form. @param page Current page element. */
  backToInput(page: HTMLElement): void {
    this.showInputPopup = false;
    requestAnimationFrame(/** Waits for dialog teardown and its focus restoration. */ () => {
      requestAnimationFrame(/** Focuses the form after background interaction is restored. */ () => page.querySelector<HTMLInputElement>('#ingredient')?.focus());
    });
  }
}
