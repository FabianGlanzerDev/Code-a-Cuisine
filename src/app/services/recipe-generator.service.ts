import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError, timeout, TimeoutError } from 'rxjs';
import { environment } from '../../environments/environment';
import { readBrowserValue, writeBrowserValue } from './browser-storage';
import { validRequirements } from './recipe-requirements';
import { GenerationResponse, IngredientEntry, RecipeRequirements } from '../models/recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeGeneratorService {
  requirements = this.restoreRequirements();

  /**
   * Initializes the component or service with its required dependencies.
   * @param http Injected HTTP client.
   */
  constructor(private readonly http: HttpClient) {}



  /**
   * Sends the current recipe requirements to the configured generation endpoint.
   * @returns {Observable<GenerationResponse>} The result of this operation.
   */
  generate(): Observable<GenerationResponse> {
    return this.http.post<GenerationResponse>(environment.webhookUrl, this.requirements).pipe(
      timeout(240000),
      catchError(/** Treats an expired client wait as ambiguous network failure without retrying. */ error => throwError(/** Preserves HTTP errors and maps only client timeouts. */ () => error instanceof TimeoutError ? new HttpErrorResponse({ status: 0, statusText: 'Generation response timed out' }) : error)),
    );
  }



  /**
   * Adds a validated ingredient to the current recipe requirements.
   * @param ingredient Ingredient to update.
   */
  addIngredient(ingredient: IngredientEntry): void {
    this.requirements = {
      ...this.requirements,
      ingredients: [...this.requirements.ingredients, ingredient],
    };
    this.saveDraft();
  }



  /**
   * Removes one ingredient from the current recipe requirements.
   * @param ingredient Ingredient to update.
   */
  removeIngredient(ingredient: IngredientEntry): void {
    const index = this.requirements.ingredients.indexOf(ingredient);
    if (index >= 0) this.requirements.ingredients.splice(index, 1);
    this.saveDraft();
  }



  /**
   * Changes portions or cooks while enforcing the checklist limits.
   * @param key Storage key or preference property.
   * @param delta Signed amount of change.
   */
  changeAmount(key: 'portionsAmount' | 'cooksAmount', delta: number): void {
    const maximum = key === 'portionsAmount' ? 12 : 3;
    const nextValue = this.requirements[key] + delta;
    this.requirements[key] = Math.min(maximum, Math.max(1, nextValue));
    this.saveDraft();
  }



  /**
   * Updates one selectable recipe preference.
   * @param key Storage key or preference property.
   * @param value Value to validate or store.
   */
  selectPreference(key: 'cookingTime' | 'cuisine' | 'dietPreferences', value: string): void {
    this.requirements[key] = value;
    this.saveDraft();
  }



  /**
   * Returns whether all required generation choices are available.
   * @returns {boolean} The result of this operation.
   */
  canGenerate(): boolean {
    return validRequirements(this.requirements) && this.requirements.ingredients.length > 0
      && this.requirements.ingredients.every(/** Rejects unfinished edits. @param ingredient Draft entry. */ ingredient => !ingredient.isEditMode);
  }



  /** Saves only committed ingredient values and preferences, never loading or quota state. */
  saveDraft(): void {
    const draft = { ...this.requirements, ingredients: this.requirements.ingredients.map(/** Excludes transient editor state. @param item Ingredient. */ item => ({ ...item, isEditMode: false })) };
    if (validRequirements(draft)) writeBrowserValue('code-a-cuisine-requirements', draft);
  }



  /** Restores a validated draft without trusting arbitrary browser storage. */
  private restoreRequirements(): RecipeRequirements {
    const saved = readBrowserValue<unknown>('code-a-cuisine-requirements', null);
    return validRequirements(saved) ? saved : this.createDefaults();
  }



  /**
   * Returns a fresh requirements object matching the generator API contract.
   * @returns {RecipeRequirements} The result of this operation.
   */
  private createDefaults(): RecipeRequirements {
    return {
      ingredients: [], portionsAmount: 2, cooksAmount: 1,
      cookingTime: 'quick', cuisine: 'german', dietPreferences: 'no preferences',
    };
  }
}
