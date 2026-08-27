import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GenerationResponse, IngredientEntry, RecipeRequirements } from '../models/recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeGeneratorService {
  requirements = this.createDefaults();

  constructor(private readonly http: HttpClient) {}

  /** Sends the current recipe requirements to the configured generation endpoint. */
  generate(): Observable<GenerationResponse> {
    return this.http.post<GenerationResponse>(environment.webhookUrl, this.requirements);
  }

  /** Adds a validated ingredient to the current recipe requirements. */
  addIngredient(ingredient: IngredientEntry): void {
    this.requirements = {
      ...this.requirements,
      ingredients: [...this.requirements.ingredients, ingredient],
    };
  }

  /** Removes one ingredient from the current recipe requirements. */
  removeIngredient(ingredient: IngredientEntry): void {
    const index = this.requirements.ingredients.indexOf(ingredient);
    if (index >= 0) this.requirements.ingredients.splice(index, 1);
  }

  /** Toggles inline editing for one ingredient. */
  toggleIngredientEdit(ingredient: IngredientEntry): void {
    ingredient.isEditMode = !ingredient.isEditMode;
  }

  /** Changes portions or cooks while enforcing the checklist limits. */
  changeAmount(key: 'portionsAmount' | 'cooksAmount', delta: number): void {
    const maximum = key === 'portionsAmount' ? 12 : 3;
    const nextValue = this.requirements[key] + delta;
    this.requirements[key] = Math.min(maximum, Math.max(1, nextValue));
  }

  /** Updates one selectable recipe preference. */
  selectPreference(key: 'cookingTime' | 'cuisine' | 'dietPreferences', value: string): void {
    this.requirements[key] = value;
  }

  /** Returns whether all required generation choices are available. */
  canGenerate(): boolean {
    const { ingredients, cookingTime, cuisine, dietPreferences } = this.requirements;
    return ingredients.length > 0 && Boolean(cookingTime && cuisine && dietPreferences);
  }

  /** Returns a fresh requirements object matching the generator API contract. */
  private createDefaults(): RecipeRequirements {
    return {
      ingredients: [], portionsAmount: 2, cooksAmount: 1,
      cookingTime: 'quick', cuisine: '', dietPreferences: '',
    };
  }
}
