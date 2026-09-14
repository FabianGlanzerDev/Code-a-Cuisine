import { HttpErrorResponse } from '@angular/common/http';
import { validEntry } from '../../services/recipe-requirements';
import { TitleCasePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize, Observable, of, switchMap } from 'rxjs';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { GeneratedRecipe, GenerationResponse, Recipe } from '../../models/recipe.model';
import { QuotaService } from '../../services/quota.service';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeGeneratorService } from '../../services/recipe-generator.service';
import { RecipeStoreService } from '../../services/recipe-store.service';
import { LoadingOverlayComponent } from '../loading-overlay/loading-overlay.component';
import { InputErrorDialogComponent } from '../../components/input-error-dialog.component';

@Component({
  selector: 'app-preferences-page',
  imports: [RouterLink, TitleCasePipe, SiteHeaderComponent, LoadingOverlayComponent, InputErrorDialogComponent],
  templateUrl: './preferences.page.html',
  styleUrl: './preferences.page.css',
})
export class PreferencesPage implements OnInit {
  @ViewChild('generateTrigger') generateTrigger?: ElementRef<HTMLButtonElement>;
  loading = false;
  errorMessage = '';
  showQuantityPopup = false;
  popupMessage = 'It looks like some ingredient quantities aren’t sufficient for your selected servings. Please add or adjust quantities and try again.';
  quotaError = '';
  quotaChecking = false;

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
    this.refreshQuota();
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
    return !!this.generationBlockedReason;
  }



  /** Explains exactly the same conditions used by the Generate button. */
  get generationBlockedReason(): string {
    if (this.loading) return 'A request is already in progress.';
    if (this.quotaChecking) return 'Checking available recipe slots…';
    if (this.quotaError || !this.quota.status) return 'Availability is unknown. Please check recipe slots again.';
    if (this.store.pendingRecipes.length) return 'Confirm saving the previous recipes before generating again.';
    if (!this.generator.requirements.ingredients.length) return 'Add ingredients before generating a recipe.';
    if (this.generator.requirements.ingredients.some(/** Rejects invalid quantities or unfinished edits. @param entry Ingredient. */ entry => !validEntry(entry) || entry.isEditMode)) return 'Finish editing your ingredients and enter valid positive quantities.';
    if (!this.generator.canGenerate()) return 'Choose a cooking time, cuisine and diet, with 1-12 portions and 1-3 cooks.';
    if (this.quota.status.ipRemaining < 3) return 'Your daily recipe limit is reached. Three free IP slots are required.';
    if (this.quota.status.systemRemaining < 3) return 'The daily system limit is reached. Three free system slots are required.';
    return '';
  }



  /** Explicit read-only retry; never starts recipe generation. */
  refreshQuota(): void {
    if (this.quotaChecking) return;
    this.quotaChecking = true;
    this.quotaError = '';
    this.quota.invalidate();
    this.quota.load().pipe(finalize(/** Releases the check even after a timeout. */ () => this.quotaChecking = false)).subscribe({
      error: /** Keeps unknown availability distinct from free slots. */ () => this.quotaError = 'Recipe slots could not be checked. Please try again.',
    });
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
  @HostListener('document:keydown.escape')
  closeQuantityPopup(): void {
    this.showQuantityPopup = false;
  }



  /**
   * Returns to ingredient entry after a quantity validation problem.
   */
  backToIngredients(): void {
    this.showQuantityPopup = false;
    const targetDocument = this.generateTrigger?.nativeElement.ownerDocument;
    void this.router.navigate(['/generate-recipe']).then(/** Focuses the ingredient field after the destination renders. */ () => {
      requestAnimationFrame(/** Waits for the new page view. */ () => targetDocument?.querySelector<HTMLInputElement>('#ingredient')?.focus());
    });
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
    if (this.isQuantityError(error) || this.isInputError(error)) {
      this.popupMessage = this.isInputError(error) ? message : 'It looks like some ingredient quantities aren’t sufficient for your selected servings. Please add or adjust quantities and try again.';
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
    if (error instanceof HttpErrorResponse && (error.status >= 500 || error.status === 0) && !error.error?.quota) this.reconcileQuota();
    if (error instanceof HttpErrorResponse && error.error?.code === 'MODEL_OUTPUT_INVALID') return 'The generated recipes failed technical validation. This does not mean your ingredients are insufficient. Reserved recipe slots remain used today. No automatic retry was made.';
    if (typeof detail === 'string') return detail;
    if (error instanceof HttpErrorResponse && (error.status >= 500 || error.status === 0)) {
      return 'The generation service could not complete the request. This is a technical error, not a daily-limit message. Slots may already be reserved and recipes may still be processing. Check the cookbook later before another attempt.';
    }
    return 'Recipe generation failed. Please try again later.';
  }



  /** Reads quota once after an ambiguous failure; never repeats generation. */
  private reconcileQuota(): void {
    this.quota.invalidate();
    this.quotaChecking = true;
    this.quotaError = 'Checking whether recipe slots were reserved...';
    this.quota.load().pipe(finalize(/** Releases the quota-check state. */ () => this.quotaChecking = false)).subscribe({
      next: /** Clears the temporary status after a successful read. */ () => this.quotaError = '',
      error: /** Explains why no remaining quota is displayed. */ () => this.quotaError = 'Remaining quota is unknown. The failed request may have reserved recipe slots.',
    });
  }



  /**
   * Accepts only the reserved, explicit quantity-error contract; the current backend does not emit it.
   * @param error Structured server error.
   * @returns {boolean} The result of this operation.
   */
  private isQuantityError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 422
      && error.error?.code === 'INSUFFICIENT_INGREDIENT_QUANTITIES'
      && error.error?.portionsAmount === this.generator.requirements.portionsAmount;
  }



  /** Accepts only explicitly classified backend input errors, never generic HTTP failures. @param error Server failure. */
  private isInputError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 400
      && error.error?.code === 'INVALID_RECIPE_INPUT' && typeof error.error?.detail === 'string';
  }
}
