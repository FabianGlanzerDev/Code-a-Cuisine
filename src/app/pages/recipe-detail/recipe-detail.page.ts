import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { Recipe, RecipeDirection } from '../../models/recipe.model';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeStoreService } from '../../services/recipe-store.service';

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

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: RecipeApiService,
    private readonly store: RecipeStoreService,
  ) { }

  /** Resolves the requested recipe from memory or Firebase. */
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return this.showRecipeError('The requested recipe could not be found.');

    const cached = this.store.findRecipe(id);
    if (cached) return this.setRecipe(cached);

    this.api.getById(id).subscribe({
      next: (recipe) => recipe ? this.setRecipe(recipe) : this.showRecipeError('This recipe no longer exists.'),
      error: () => this.showRecipeError('The recipe could not be loaded. Please try again.'),
    });
  }

  /** Returns one task-list entry group per configured cook. */
  get cookNumbers(): number[] {
    return Array.from({ length: this.recipe?.cooksAmount ?? 1 }, (_, index) => index + 1);
  }

  /** Returns all directions assigned to one cook. */
  directionsForCook(cook: number): RecipeDirection[] {
    return this.recipe?.directions.filter((direction) => direction.cook === cook) ?? [];
  }

  /** Adds or removes this browser's heart and persists the shared like count in Firebase. */
  toggleLike(): void {
    if (!this.recipe || this.likePending) return;

    const nextLikedState = !this.likedByThisBrowser;
    this.likePending = true;
    this.likeError = '';
    this.api.changeLikes(this.recipe.id, nextLikedState ? 1 : -1).subscribe({
      next: (likes) => this.finishLikeUpdate(likes, nextLikedState),
      error: () => this.failLikeUpdate(),
    });
  }

  /** Stores the active recipe and restores this browser's previous heart state. */
  private setRecipe(recipe: Recipe): void {
    this.recipe = recipe;
    this.loading = false;
    this.errorMessage = '';
    this.likedByThisBrowser = this.readLikedRecipeIds().has(recipe.id);
  }

  /** Displays a stable empty/error state instead of rendering incomplete recipe data. */
  private showRecipeError(message: string): void {
    this.recipe = null;
    this.loading = false;
    this.errorMessage = message;
  }

  /** Finishes a successful Firebase heart update. */
  private finishLikeUpdate(likes: number, liked: boolean): void {
    if (this.recipe) this.recipe.likes = likes;
    this.likedByThisBrowser = liked;
    this.persistLikedState(liked);
    this.likePending = false;
  }

  /** Restores the heart button after a failed Firebase update. */
  private failLikeUpdate(): void {
    this.likeError = 'Could not update the heart. Please try again.';
    this.likePending = false;
  }

  /** Stores this browser's liked recipe IDs so one browser cannot add unlimited hearts. */
  private persistLikedState(liked: boolean): void {
    if (!this.recipe || typeof localStorage === 'undefined') return;
    const ids = this.readLikedRecipeIds();
    if (liked) ids.add(this.recipe.id);
    else ids.delete(this.recipe.id);
    localStorage.setItem('code-a-cuisine-liked-recipes', JSON.stringify([...ids]));
  }

  /** Reads the recipe IDs liked by this browser. */
  private readLikedRecipeIds(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set<string>();
    try {
      const stored = JSON.parse(localStorage.getItem('code-a-cuisine-liked-recipes') ?? '[]');
      const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
      return new Set(ids);
    } catch {
      return new Set<string>();
    }
  }
}
