import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { Recipe, RecipeDirection } from '../../models/recipe.model';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeStoreService } from '../../services/recipe-store.service';
import { readBrowserValue, writeBrowserValue } from '../../services/browser-storage';

@Component({
  selector: 'app-recipe-detail-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './recipe-detail.page.html',
  styleUrl: './recipe-detail.page.css',
})
export class RecipeDetailPage implements OnInit {
  recipe: Recipe | null = null;
  loading = true;
  errorMessage = '';
  likedByThisBrowser = false;
  likePending = false;
  likeError = '';
  backRoute = '/recipe-results';
  backLabel = 'Recipe Results';
  backQuery: { cuisine?: string } = {};

  /**
   * Initializes the component or service with its required dependencies.
   * @param route Active route metadata.
   * @param api Recipe persistence service.
   * @param store Shared recipe collections.
   */
  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: RecipeApiService,
    private readonly store: RecipeStoreService,
  ) { }



  /**
   * Resolves the requested recipe from memory or Firebase.
   */
  ngOnInit(): void {
    this.configureBackLink();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return this.showRecipeError('The requested recipe could not be found.');

    const cached = this.store.findRecipe(id);
    if (cached) return this.setRecipe(cached);

    this.api.getById(id).subscribe({
      next: /** Applies a successful asynchronous result. @param recipe Current callback input. */ (recipe) => recipe ? this.setRecipe(recipe) : this.showRecipeError('This recipe no longer exists.'),
      error: /** Handles a failed asynchronous operation. */ () => this.showRecipeError('The recipe could not be loaded. Please try again.'),
    });
  }



  /**
   * Preserves the originating cookbook category when navigating back from a recipe.
   */
  private configureBackLink(): void {
    if (this.route.snapshot.queryParamMap.get('from') !== 'cookbook') return;
    const cuisine = this.route.snapshot.queryParamMap.get('cuisine');
    this.backRoute = cuisine ? '/recipes-list' : '/cookbook';
    this.backLabel = 'Cookbook';
    this.backQuery = cuisine ? { cuisine } : {};
  }



  /**
   * Returns one task-list entry group per configured cook.
   * @returns {number[]} The result of this operation.
   */
  get cookNumbers(): number[] {
    return Array.from({ length: this.recipe?.cooksAmount ?? 1 }, /** Creates one entry for the resulting array. @param _ Current callback input. @param index Current callback input. */ (_, index) => index + 1);
  }



  /**
   * Returns all directions assigned to one cook.
   * @param cook Cook whose directions should be listed.
   * @returns {RecipeDirection[]} The result of this operation.
   */
  directionsForCook(cook: number): RecipeDirection[] {
    return this.recipe?.directions.filter(/** Checks whether the current item matches the filter. @param direction Current callback input. */ (direction) => direction.cook === cook) ?? [];
  }



  /**
   * Adds or removes this browser's heart and persists the shared like count in Firebase.
   */
  toggleLike(): void {
    if (!this.recipe || this.likePending) return;

    const nextLikedState = !this.likedByThisBrowser;
    this.likePending = true;
    this.likeError = '';
    this.api.changeLikes(this.recipe.id, nextLikedState ? 1 : -1).subscribe({
      next: /** Applies a successful asynchronous result. @param likes Current callback input. */ (likes) => this.finishLikeUpdate(likes, nextLikedState),
      error: /** Handles a failed asynchronous operation. */ () => this.failLikeUpdate(),
    });
  }



  /**
   * Stores the active recipe and restores this browser's previous heart state.
   * @param recipe Recipe to process.
   */
  private setRecipe(recipe: Recipe): void {
    this.recipe = recipe;
    this.loading = false;
    this.errorMessage = '';
    this.likedByThisBrowser = this.readLikedRecipeIds().has(recipe.id);
  }



  /**
   * Displays a stable empty/error state instead of rendering incomplete recipe data.
   * @param message Readable error message.
   */
  private showRecipeError(message: string): void {
    this.recipe = null;
    this.loading = false;
    this.errorMessage = message;
  }



  /**
   * Finishes a successful Firebase heart update.
   * @param likes Persisted like count.
   * @param liked Updated browser like state.
   */
  private finishLikeUpdate(likes: number, liked: boolean): void {
    if (this.recipe) this.recipe.likes = likes;
    this.likedByThisBrowser = liked;
    this.persistLikedState(liked);
    this.likePending = false;
  }



  /**
   * Restores the heart button after a failed Firebase update.
   */
  private failLikeUpdate(): void {
    this.likeError = 'Could not update the heart. Please try again.';
    this.likePending = false;
  }



  /**
   * Stores this browser's liked recipe IDs so one browser cannot add unlimited hearts.
   * @param liked Updated browser like state.
   */
  private persistLikedState(liked: boolean): void {
    if (!this.recipe) return;
    const ids = this.readLikedRecipeIds();
    if (liked) ids.add(this.recipe.id);
    else ids.delete(this.recipe.id);
    writeBrowserValue('code-a-cuisine-liked-recipes', [...ids]);
  }



  /**
   * Reads the recipe IDs liked by this browser.
   * @returns {Set<string>} The result of this operation.
   */
  private readLikedRecipeIds(): Set<string> {
    const stored = readBrowserValue<unknown>('code-a-cuisine-liked-recipes', []);
    const ids = Array.isArray(stored) ? stored.filter(/** Checks whether the current item matches the filter. @param id Current callback input. */ (id): id is string => typeof id === 'string') : [];
    return new Set(ids);
  }
}
