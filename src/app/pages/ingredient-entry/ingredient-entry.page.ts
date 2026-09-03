import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { IngredientEntry } from '../../models/recipe.model';
import { RecipeGeneratorService } from '../../services/recipe-generator.service';

interface UnitOption { name: string; abbreviation: string; }

@Component({
  selector: 'app-ingredient-entry-page',
  imports: [FormsModule, SiteHeaderComponent],
  templateUrl: './ingredient-entry.page.html',
  styleUrl: './ingredient-entry.page.css',
})
export class IngredientEntryPage {
  readonly units: UnitOption[] = [
    { name: 'piece', abbreviation: '' },
    { name: 'ml', abbreviation: 'ml' },
    { name: 'gram', abbreviation: 'g' },
  ];

  private readonly knownIngredients = [
    'Apple', 'Avocado', 'Baby spinach', 'Bacon', 'Banana', 'Basil', 'Beef', 'Bell pepper',
    'Broccoli', 'Butter', 'Carrot', 'Cheese', 'Cherry tomatoes', 'Chicken', 'Chickpeas',
    'Cucumber', 'Egg', 'Garlic', 'Lemon', 'Lentils', 'Milk', 'Mushrooms', 'Onion', 'Pasta',
    'Pastrami', 'Passionfruit', 'Potato', 'Rice', 'Salmon', 'Tomato', 'Tuna', 'Yogurt',
  ];

  selectedUnit = this.units[2];
  ingredientName = '';
  servingSize = 100;
  dropdownOpen = false;

  editingIngredient: IngredientEntry | null = null;
  editServingSize = 1;
  editUnit = this.units[0];
  editUnitDropdownOpen = false;

  constructor(
    public readonly generator: RecipeGeneratorService,
    private readonly router: Router,
  ) { }

  /** Returns up to three matching ingredient suggestions for the current input. */
  get ingredientSuggestions(): string[] {
    const query = this.ingredientName.trim().toLowerCase();
    if (!query) return [];

    return this.knownIngredients
      .filter((ingredient) => ingredient.toLowerCase().startsWith(query))
      .slice(0, 3);
  }

  /** Opens or closes the add-form unit menu. */
  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
    this.editUnitDropdownOpen = false;
  }

  /** Selects one serving unit for a new ingredient. */
  selectUnit(unit: UnitOption): void {
    this.selectedUnit = unit;
    this.dropdownOpen = false;
  }

  /** Opens or closes the inline-edit unit menu. */
  toggleEditUnitDropdown(): void {
    this.editUnitDropdownOpen = !this.editUnitDropdownOpen;
    this.dropdownOpen = false;
  }

  /** Selects one serving unit while editing an existing ingredient. */
  selectEditUnit(unit: UnitOption): void {
    this.editUnit = unit;
    this.editUnitDropdownOpen = false;
  }

  /** Copies one autocomplete suggestion into the ingredient field. */
  selectIngredientSuggestion(suggestion: string): void {
    this.ingredientName = suggestion;
  }

  /** Adds the current ingredient values to the recipe request. */
  addIngredient(): void {
    const name = this.ingredientName.trim();
    const amount = Number(this.servingSize);
    if (!name || !Number.isFinite(amount) || amount <= 0) return;
    this.generator.addIngredient(this.createIngredient(name, amount));
    this.resetIngredientInput();
  }

  /** Starts the compact inline editor shown in the design reference. */
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

  /** Saves amount and unit changes and closes the inline editor. */
  saveEdit(ingredient: IngredientEntry): void {
    const amount = Number(this.editServingSize);
    if (!Number.isFinite(amount) || amount <= 0) return;

    ingredient.servingSize = `${amount}${this.editUnit.abbreviation}`;
    ingredient.isEditMode = false;
    this.editingIngredient = null;
    this.editUnitDropdownOpen = false;
  }

  /** Removes the selected ingredient row. */
  removeIngredient(ingredient: IngredientEntry): void {
    if (this.editingIngredient === ingredient) {
      this.editingIngredient = null;
      this.editUnitDropdownOpen = false;
    }
    this.generator.removeIngredient(ingredient);
  }

  /** Moves to preferences when at least one ingredient exists. */
  continueToPreferences(): void {
    if (!this.generator.requirements.ingredients.length) return;
    void this.router.navigate(['/choose-preferences']);
  }

  /** Creates the API-compatible ingredient model from input values. */
  private createIngredient(name: string, amount: number): IngredientEntry {
    return {
      ingredient: name,
      servingSize: `${amount}${this.selectedUnit.abbreviation}`,
      isEditMode: false,
    };
  }

  /** Splits a stored serving string such as 100g, 250ml or 1 into amount and unit. */
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

  /** Restores the ingredient form defaults after a successful add. */
  private resetIngredientInput(): void {
    this.ingredientName = '';
    this.servingSize = 100;
  }
}
