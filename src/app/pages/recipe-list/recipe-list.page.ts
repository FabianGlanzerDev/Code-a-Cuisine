import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { Cuisine } from '../../models/cuisine.model';
import { Recipe } from '../../models/recipe.model';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeStoreService } from '../../services/recipe-store.service';
import { readBrowserValue, writeBrowserValue } from '../../services/browser-storage';

@Component({
  selector: 'app-recipe-list-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './recipe-list.page.html',
  styleUrl: './recipe-list.page.css',
})
export class RecipeListPage implements OnInit, OnDestroy {
  readonly pageSize = 15;
  private static readonly rememberedPages = new Map<string, number>();
  private routeSubscription?: Subscription;
  private recipeSubscription?: Subscription;
  cuisine: Cuisine | undefined;
  currentPage = 1;
  loading = true;
  errorMessage = '';

  /**
   * Initializes the component or service with its required dependencies.
   * @param store Shared recipe collections.
   * @param api Recipe persistence service.
   * @param route Active route metadata.
   */
  constructor(
    public readonly store: RecipeStoreService,
    private readonly api: RecipeApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}



  /**
   * Loads cuisine metadata and the recipes for the requested category.
   */
  ngOnInit(): void {
    this.routeSubscription = this.route.queryParamMap.subscribe(/** Applies category and page URL changes. */ () => this.loadCategory());
  }



  /** Cancels route and recipe subscriptions when leaving this page. */
  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.recipeSubscription?.unsubscribe();
  }



  /** Loads a new category, or restores pagination for the existing category. */
  private loadCategory(): void {
    const cuisineName = this.route.snapshot.queryParamMap.get('cuisine');
    if (this.cuisine?.name === cuisineName && !this.loading) return this.restorePage();
    this.recipeSubscription?.unsubscribe();
    this.cuisine = this.store.findCuisine(cuisineName);
    if (!cuisineName || !this.cuisine) return this.finishWithError('This cuisine category is not available.');
    this.loading = true;
    this.store.setSelectedRecipes([]);
    this.recipeSubscription = this.api.getByCuisine(cuisineName).subscribe({
      next: /** Applies a successful asynchronous result. @param recipes Current callback input. */ (recipes) => this.setRecipes(recipes),
      error: /** Handles a failed asynchronous operation. */ () => this.finishWithError('Recipes could not be loaded. Please try again.'),
    });
  }



  /**
   * Returns only recipes belonging to the active page.
   * @returns {Recipe[]} The result of this operation.
   */
  get pageRecipes(): Recipe[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.store.selectedRecipes.slice(start, start + this.pageSize);
  }



  /**
   * Returns the number of pages required for the loaded recipes.
   * @returns {number} The result of this operation.
   */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.store.selectedRecipes.length / this.pageSize));
  }



  /**
   * Opens the previous recipe page when available.
   */
  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }



  /**
   * Opens the next recipe page when available.
   */
  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }



  /**
   * Stores loaded recipes and restores the category's last or explicitly requested page.
   * @param recipes Recipe set to process.
   */
  private setRecipes(recipes: Recipe[]): void {
    this.store.setSelectedRecipes(recipes);
    this.loading = false;
    this.errorMessage = '';
    this.restorePage();
  }



  /** Restores direct URLs or the category context retained before opening details. */
  private restorePage(): void {
    const key = 'code-a-cuisine-list-page-' + this.cuisine?.name;
    const saved = RecipeListPage.rememberedPages.get(key) ?? readBrowserValue(key, 1);
    const requested = Number(this.route.snapshot.queryParamMap.get('page') ?? saved);
    this.currentPage = Number.isSafeInteger(requested) ? Math.max(1, Math.min(this.totalPages, requested)) : 1;
    this.rememberPage();
  }



  /** Keeps category pagination across details, reloads and unavailable browser storage. */
  private rememberPage(): void {
    const key = 'code-a-cuisine-list-page-' + this.cuisine?.name;
    RecipeListPage.rememberedPages.set(key, this.currentPage);
    writeBrowserValue(key, this.currentPage);
  }



  /** Changes the visible page and its shareable URL without another recipe request. */
  goToPage(page: number): void {
    this.currentPage = Math.max(1, Math.min(this.totalPages, page));
    this.rememberPage();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: this.currentPage }, queryParamsHandling: 'merge' });
  }



  /** Lists the first, last and nearby pages, with gaps for distant pages. */
  get pageNumbers(): (number | null)[] {
    const visible = new Set([1, this.totalPages, this.currentPage - 1, this.currentPage, this.currentPage + 1]);
    if (this.currentPage <= 2) visible.add(3);
    if (this.currentPage >= this.totalPages - 1) visible.add(this.totalPages - 2);
    const pages = [...visible].filter(/** Keeps valid pages. */ page => page >= 1 && page <= this.totalPages).sort(/** Orders pages. */ (a, b) => a - b);
    const result: (number | null)[] = [];
    pages.forEach(/** Inserts gaps between distant pages. */ (page, index) => {
      const previous = pages[index - 1];
      if (page - previous === 2) result.push(previous + 1);
      else if (page - previous > 2) result.push(null);
      result.push(page);
    });
    return result;
  }



  /**
   * Resets stale results and exposes a readable load error.
   * @param message Readable error message.
   */
  private finishWithError(message: string): void {
    this.store.setSelectedRecipes([]);
    this.loading = false;
    this.errorMessage = message;
  }
}
