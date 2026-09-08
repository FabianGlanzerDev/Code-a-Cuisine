import { HttpErrorResponse } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize, Observable, of, switchMap } from 'rxjs';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { GeneratedRecipe, GenerationResponse, Recipe } from '../../models/recipe.model';
import { QuotaService } from '../../services/quota.service';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeGeneratorService } from '../../services/recipe-generator.service';
import { RecipeStoreService } from '../../services/recipe-store.service';
import { LoadingOverlayComponent } from '../loading-overlay/loading-overlay.component';
import { FocusDialogDirective } from '../../components/focus-dialog.directive';

@Component({
  selector: 'app-preferences-page',
  imports: [RouterLink, TitleCasePipe, SiteHeaderComponent, LoadingOverlayComponent, FocusDialogDirective],
  templateUrl: './preferences.page.html',
  styleUrl: './preferences.page.css',
})
export class PreferencesPage implements OnInit {
  loading = false;
  errorMessage = '';
  showQuantityPopup = false;
  quotaError = '';

  /**
   * Initializes the component or service with its required dependencies.
   * @param generator Shared ingredient and preference state.
   * @param store Shared recipe collections.
   * @param quota Quota service.
   * @param api Recipe persistence service.
   * @param router Application router.
   */
  constructor(
    public readonly generator: RecipeGeneratorService,
    public readonly store: RecipeStoreService,
    public readonly quota: QuotaService,
    private readonly api: RecipeApiService,
    private readonly router: Router,
  ) { }



  /**
   * Loads the currently available quota without blocking the page.
   */
  ngOnInit(): void {
    this.quota.load().subscribe({ next: /** Applies a successful asynchronous result. @param status Current callback input. */ (status) => this.quota.set(status),
      error: /** Handles a failed asynchronous operation. */ () => this.quotaError = 'Quota could not be loaded. The backend will check availability when you generate.' });
  }



  /**
   * Increases one people/portion counter.
   * @param key Storage key or preference property.
   */
  increase(key: 'portionsAmount' | 'cooksAmount'): void {
    this.generator.changeAmount(key, 1);
  }



  /**
   * Decreases one people/portion counter without going below one.
   * @param key Storage key or preference property.
   */
  decrease(key: 'portionsAmount' | 'cooksAmount'): void {
    this.generator.changeAmount(key, -1);
  }



  /**
   * Stores a selected preference value.
   * @param key Storage key or preference property.
   * @param value Value to validate or store.
   */
  choose(key: 'cookingTime' | 'cuisine' | 'dietPreferences', value: string): void {
    this.generator.selectPreference(key, value);
  }



  /**
   * Generates, saves, and opens the resulting recipes.
   */
  generateRecipes(): void {
    if (this.generationDisabled) return;
    this.errorMessage = '';
    this.showQuantityPopup = false;
    this.loading = true;
    this.generator.generate().pipe(
      switchMap(/** Continues with the dependent asynchronous operation. @param response Current callback input. */ (response) => this.saveResponse(response)),
      finalize(/** Restores transient state when the operation finishes. */ () => this.loading = false),
    ).subscribe({ next: /** Applies a successful asynchronous result. @param recipes Current callback input. */ (recipes) => this.finish(recipes), error: /** Handles a failed asynchronous operation. @param error Current callback input. */ (error) => this.handleError(error) });
  }



  /**
   * Uses backend-persisted recipes or retains stable IDs for read-only recovery.
   * @param response Validated generation response with optional persistence confirmation.
   * @returns The recipe set after confirmed persistence.
   */
  private saveResponse(response: GenerationResponse): Observable<Recipe[]> {
    const generated = this.extractRecipes(response);
    if (generated.some(/** Rejects missing or invalid backend keys. @param recipe Generated recipe. */ (recipe) => !recipe.id || !/^[a-zA-Z0-9_-]+$/.test(recipe.id))
      || new Set(generated.map(/** Returns the backend key. @param recipe Generated recipe. */ (recipe) => recipe.id)).size !== 3) throw new Error('Missing saved recipe identifiers.');
    const recipes = this.api.prepareGeneratedRecipes(generated);
    if (!Array.isArray(response) && 'recipes' in response && response.persisted === true) return of(recipes);
    this.store.setPendingRecipes(recipes);
    return this.api.confirmStoredRecipes(recipes);
  }



  /**
   * Prevents duplicate requests, insufficient quota and replacing unsaved results.
   * @returns {boolean} The result of this operation.
   */
  get generationDisabled(): boolean {
    const status = this.quota.status;
    return this.loading || !!this.store.pendingRecipes.length || !this.generator.canGenerate()
      || !!status && (status.ipRemaining < 3 || status.systemRemaining < 3);
  }



  /**
   * Rechecks backend persistence using the original IDs without generating or writing.
   */
  checkStorage(): void {
    if (this.loading || !this.store.pendingRecipes.length) return;
    this.loading = true;
    this.errorMessage = '';
    this.api.confirmStoredRecipes(this.store.pendingRecipes).pipe(finalize(/** Restores transient state when the operation finishes. */ () => this.loading = false))
      .subscribe({ next: /** Applies a successful asynchronous result. @param recipes Current callback input. */ (recipes) => this.finish(recipes), error: /** Handles a failed asynchronous operation. @param error Current callback input. */ (error) => this.handleError(error) });
  }



  /**
   * Closes the ingredient-quantity popup.
   */
  closeQuantityPopup(): void {
    this.showQuantityPopup = false;
  }



  /**
   * Returns to ingredient entry after a quantity validation problem.
   */
  backToIngredients(): void {
    this.showQuantityPopup = false;
    void this.router.navigate(['/generate-recipe']);
  }



  /**
   * Validates the generator response and stores returned quota metadata.
   * @param response HTTP response to inspect.
   * @returns {GeneratedRecipe[]} The result of this operation.
   */
  private extractRecipes(response: GenerationResponse | null): GeneratedRecipe[] {
    if (!response) throw new Error('Recipe generation returned an empty response.');
    if (Array.isArray(response)) return this.validateRecipeSet(response);
    if ('recipes' in response) {
      this.quota.set(response.quota);
      return this.validateRecipeSet(response.recipes);
    }
    this.quota.set(response.quota);
    throw new Error(response.detail || 'Recipe generation failed');
  }



  /**
   * Rejects incomplete backend responses before anything is written to Firebase.
   * @param recipes Recipe set to process.
   * @returns {GeneratedRecipe[]} The result of this operation.
   */
  private validateRecipeSet(recipes: GeneratedRecipe[]): GeneratedRecipe[] {
    if (recipes.length !== 3) throw new Error('Recipe generation did not return exactly three recipes.');
    const titles = recipes.map(/** Maps the current item to its output value. @param recipe Current callback input. */ (recipe) => recipe?.title?.trim().toLowerCase());
    if (titles.some(/** Checks whether this item meets the condition. @param title Current callback input. */ (title) => !title) || new Set(titles).size !== 3) {
      throw new Error('Recipe generation returned invalid or duplicate recipe titles.');
    }
    return recipes;
  }



  /**
   * Stores generated recipes before navigating to the results page.
   * @param recipes Recipe set to process.
   */
  private finish(recipes: Recipe[]): void {
    this.store.setGeneratedRecipes(recipes);
    this.store.setPendingRecipes([]);
    void this.router.navigate(['/recipe-results']);
  }



  /**
   * Displays the quantity modal for matching backend errors or a normal error message otherwise.
   * @param error Failure to handle.
   */
  private handleError(error: unknown): void {
    if (this.store.pendingRecipes.length) {
      this.errorMessage = 'Your recipes are kept on this device, but saving is not confirmed. Please check again later. If this continues, contact the site owner to restore them. No new generation is needed.';
      return;
    }
    const message = this.generationErrorMessage(error);
    if (this.isQuantityError(message)) {
      this.showQuantityPopup = true;
      this.errorMessage = '';
      return;
    }
    this.errorMessage = message;
  }



  /**
   * Extracts a safe error string and refreshes quota metadata from HTTP failures.
   * @param error Failure to handle.
   * @returns {string} The result of this operation.
   */
  private generationErrorMessage(error: unknown): string {
    const detail = error instanceof HttpErrorResponse ? error.error?.detail : undefined;
    if (error instanceof HttpErrorResponse) this.quota.set(error.error?.quota);
    return typeof detail === 'string' ? detail : 'Recipe generation failed. Please try again later.';
  }



  /**
   * Detects backend wording that indicates insufficient quantities for the selected servings.
   * @param message Readable error message.
   * @returns {boolean} The result of this operation.
   */
  private isQuantityError(message: string): boolean {
    return /not enough|insufficient|quantit(?:y|ies)|selected servings/i.test(message);
  }
}
