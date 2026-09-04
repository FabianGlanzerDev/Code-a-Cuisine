import { HttpErrorResponse } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { GeneratedRecipe, GenerationResponse, Recipe } from '../../models/recipe.model';
import { QuotaService } from '../../services/quota.service';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeGeneratorService } from '../../services/recipe-generator.service';
import { RecipeStoreService } from '../../services/recipe-store.service';
import { LoadingOverlayComponent } from '../loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-preferences-page',
  imports: [RouterLink, TitleCasePipe, SiteHeaderComponent, LoadingOverlayComponent],
  templateUrl: './preferences.page.html',
  styleUrl: './preferences.page.css',
})
export class PreferencesPage implements OnInit {
  loading = false;
  errorMessage = '';
  showQuantityPopup = false;

  constructor(
    public readonly generator: RecipeGeneratorService,
    public readonly store: RecipeStoreService,
    public readonly quota: QuotaService,
    private readonly api: RecipeApiService,
    private readonly router: Router,
  ) { }

  /** Loads the currently available quota without blocking the page. */
  ngOnInit(): void {
    this.quota.load().subscribe({ next: (status) => this.quota.set(status), error: () => undefined });
  }

  /** Increases one people/portion counter. */
  increase(key: 'portionsAmount' | 'cooksAmount'): void {
    this.generator.changeAmount(key, 1);
  }

  /** Decreases one people/portion counter without going below one. */
  decrease(key: 'portionsAmount' | 'cooksAmount'): void {
    this.generator.changeAmount(key, -1);
  }

  /** Stores a selected preference value. */
  choose(key: 'cookingTime' | 'cuisine' | 'dietPreferences', value: string): void {
    this.generator.selectPreference(key, value);
  }

  /** Generates, saves, and opens the resulting recipes. */
  generateRecipes(): void {
    if (!this.generator.canGenerate()) return;
    this.errorMessage = '';
    this.showQuantityPopup = false;
    this.loading = true;
    this.generator.generate().pipe(
      switchMap((response) => this.api.saveGeneratedRecipes(this.extractRecipes(response))),
      finalize(() => this.loading = false),
    ).subscribe({ next: (recipes) => this.finish(recipes), error: (error) => this.handleError(error) });
  }

  /** Closes the ingredient-quantity popup. */
  closeQuantityPopup(): void {
    this.showQuantityPopup = false;
  }

  /** Returns to ingredient entry after a quantity validation problem. */
  backToIngredients(): void {
    this.showQuantityPopup = false;
    void this.router.navigate(['/generate-recipe']);
  }

  /** Validates the generator response and stores returned quota metadata. */
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

  /** Rejects incomplete backend responses before anything is written to Firebase. */
  private validateRecipeSet(recipes: GeneratedRecipe[]): GeneratedRecipe[] {
    if (recipes.length !== 3) throw new Error('Recipe generation did not return exactly three recipes.');
    const titles = recipes.map((recipe) => recipe.title?.trim().toLowerCase());
    if (titles.some((title) => !title) || new Set(titles).size !== 3) {
      throw new Error('Recipe generation returned invalid or duplicate recipe titles.');
    }
    return recipes;
  }

  /** Stores generated recipes before navigating to the results page. */
  private finish(recipes: Recipe[]): void {
    this.store.setGeneratedRecipes(recipes);
    void this.router.navigate(['/recipe-results']);
  }

  /** Displays the quantity modal for matching backend errors or a normal error message otherwise. */
  private handleError(error: unknown): void {
    const detail = error instanceof HttpErrorResponse ? error.error?.detail : undefined;
    const quota = error instanceof HttpErrorResponse ? error.error?.quota : undefined;
    const message = detail || (error instanceof Error ? error.message : 'Recipe generation failed.');
    this.quota.set(quota);

    if (this.isQuantityError(message)) {
      this.showQuantityPopup = true;
      this.errorMessage = '';
      return;
    }
    this.errorMessage = message;
  }

  /** Detects backend wording that indicates insufficient quantities for the selected servings. */
  private isQuantityError(message: string): boolean {
    return /not enough|insufficient|quantit(?:y|ies)|selected servings/i.test(message);
  }
}
