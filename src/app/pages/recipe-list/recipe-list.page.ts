import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { Cuisine } from '../../models/cuisine.model';
import { Recipe } from '../../models/recipe.model';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeStoreService } from '../../services/recipe-store.service';

@Component({
  selector: 'app-recipe-list-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './recipe-list.page.html',
  styleUrl: './recipe-list.page.css',
})
export class RecipeListPage implements OnInit {
  readonly pageSize = 20;
  cuisine: Cuisine | undefined;
  currentPage = 1;
  loading = true;
  errorMessage = '';

  constructor(
    public readonly store: RecipeStoreService,
    private readonly api: RecipeApiService,
    private readonly route: ActivatedRoute,
  ) {}

  /** Loads cuisine metadata and the recipes for the requested category. */
  ngOnInit(): void {
    const cuisineName = this.route.snapshot.queryParamMap.get('cuisine');
    this.cuisine = this.store.findCuisine(cuisineName);
    if (!cuisineName || !this.cuisine) return this.finishWithError('This cuisine category is not available.');

    this.api.getByCuisine(cuisineName).subscribe({
      next: (recipes) => this.setRecipes(recipes),
      error: () => this.finishWithError('Recipes could not be loaded. Please try again.'),
    });
  }

  /** Returns only recipes belonging to the active page. */
  get pageRecipes(): Recipe[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.store.selectedRecipes.slice(start, start + this.pageSize);
  }

  /** Returns the number of pages required for the loaded recipes. */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.store.selectedRecipes.length / this.pageSize));
  }

  /** Opens the previous recipe page when available. */
  previousPage(): void {
    this.currentPage = Math.max(1, this.currentPage - 1);
  }

  /** Opens the next recipe page when available. */
  nextPage(): void {
    this.currentPage = Math.min(this.totalPages, this.currentPage + 1);
  }

  /** Stores loaded recipes and resets pagination to the first page. */
  private setRecipes(recipes: Recipe[]): void {
    this.store.setSelectedRecipes(recipes);
    this.currentPage = 1;
    this.loading = false;
    this.errorMessage = '';
  }

  /** Resets stale results and exposes a readable load error. */
  private finishWithError(message: string): void {
    this.store.setSelectedRecipes([]);
    this.loading = false;
    this.errorMessage = message;
  }
}
