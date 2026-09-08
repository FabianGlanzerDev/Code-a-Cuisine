import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GeneratedRecipe, Recipe, StoredRecipe } from '../models/recipe.model';

type FirebaseRecipeMap = Record<string, StoredRecipe> | null;

@Injectable({ providedIn: 'root' })
export class RecipeApiService {
  /**
   * Initializes the component or service with its required dependencies.
   * @param http Injected HTTP client.
   */
  constructor(private readonly http: HttpClient) {}



  /**
   * Assigns stable keys before saving so a failed batch can be retried without duplicates.
   * @param recipes Recipe set to process.
   * @returns {Recipe[]} The result of this operation.
   */
  prepareGeneratedRecipes(recipes: GeneratedRecipe[]): Recipe[] {
    return recipes.map(/** Maps the current item to its output value. @param recipe Current callback input. */ (recipe) => ({ ...recipe, cuisine: recipe.preferences.cuisine,
      likes: 0, id: recipe.id && /^[a-zA-Z0-9_-]+$/.test(recipe.id) ? recipe.id : crypto.randomUUID() }));
  }



  /**
   * Confirms all backend-written contents after an uncertain save, without public writes.
   * @param recipes Locally retained recipes with the original backend IDs.
   * @returns Stored recipes, including their current likes, after complete confirmation.
   */
  confirmStoredRecipes(recipes: Recipe[]): Observable<Recipe[]> {
    if (recipes.length !== 3 || new Set(recipes.map(/** Returns the stable recipe key. @param recipe Pending recipe. */ (recipe) => recipe.id)).size !== 3
      || recipes.some(/** Rejects unsafe database keys. @param recipe Pending recipe. */ (recipe) => !/^[a-zA-Z0-9_-]+$/.test(recipe.id))) {
      return throwError(/** Reports invalid recovery identifiers. */ () => new Error('Missing saved recipe identifiers.'));
    }
    return forkJoin(recipes.map(/** Reads one original backend key. @param recipe Pending recipe. */ (recipe) => this.getById(recipe.id))).pipe(
      map(/** Requires all three complete records before accepting persistence. @param stored Database records. */ (stored) => {
        if (stored.some(/** Detects missing or partially stored contents. @param recipe Database record. @param index Batch position. */ (recipe, index) => !recipe || this.recipeContents(recipe) !== this.recipeContents(recipes[index]))) {
          throw new Error('Recipe storage is not yet complete.');
        }
        return stored as Recipe[];
      }),
    );
  }



  /**
   * Loads all recipes matching a cuisine.
   * @param cuisine Cuisine category to load.
   * @returns {Observable<Recipe[]>} The result of this operation.
   */
  getByCuisine(cuisine: string): Observable<Recipe[]> {
    const query = `?orderBy=%22cuisine%22&equalTo=${encodeURIComponent(JSON.stringify(cuisine))}`;
    return this.http
      .get<FirebaseRecipeMap>(`${environment.databaseUrl}recipes.json${query}`)
      .pipe(map(/** Maps the current item to its output value. @param response Current callback input. */ (response) => this.toRecipeList(response)));
  }



  /**
   * Loads the most-liked recipes for the horizontal cookbook strip.
   * @param limit Maximum number of returned recipes.
   * @returns {Observable<Recipe[]>} The result of this operation.
   */
  getMostLiked(limit = 12): Observable<Recipe[]> {
    return this.http.get<FirebaseRecipeMap>(`${environment.databaseUrl}recipes.json`).pipe(
      map(/** Maps the current item to its output value. @param response Current callback input. */ (response) =>
        this.toRecipeList(response)
          .sort(/** Compares two items to determine their order. @param a Current callback input. @param b Current callback input. */ (a, b) => (b.likes ?? 0) - (a.likes ?? 0))
          .slice(0, limit),
      ),
    );
  }



  /**
   * Loads one recipe by its Firebase key, or null when the key no longer exists.
   * @param id Recipe identifier.
   * @returns {Observable<Recipe | null>} The result of this operation.
   */
  getById(id: string): Observable<Recipe | null> {
    return this.http.get<StoredRecipe | null>(`${environment.databaseUrl}recipes/${id}.json`).pipe(
      map(/** Maps the current item to its output value. @param recipe Current callback input. */ (recipe) => (recipe ? { ...recipe, likes: recipe.likes ?? 0, id } : null)),
    );
  }



  /**
   * Changes one recipe's shared heart count and returns the persisted count.
   * @param id Recipe identifier.
   * @param delta Signed amount of change.
   * @param attempts Remaining retries after confirmed conflicts.
   * @returns {Observable<number>} The result of this operation.
   */
  changeLikes(id: string, delta: 1 | -1, attempts = 3): Observable<number> {
    const url = `${environment.databaseUrl}recipes/${id}/likes.json`;
    return this.http.get<number | null>(url, { observe: 'response', headers: { 'X-Firebase-ETag': 'true' } }).pipe(
      switchMap(/** Continues with the dependent asynchronous operation. @param response Current callback input. */ (response) => {
        const etag = response.headers.get('ETag');
        if (!etag) return throwError(/** Handles the current value in the enclosing operation. */ () => new Error('Like updates are unavailable.'));
        const likes = Math.max(0, Number(response.body ?? 0) + delta);
        if (delta === -1 && !response.body) return of(0);
        return this.http.put<number>(url, likes, { headers: { 'if-match': etag } });
      }),
      catchError(/** Handles the request failure and selects its recovery path. @param error Current callback input. */ (error) => error.status === 412 && attempts > 1
        ? this.changeLikes(id, delta, attempts - 1) : throwError(/** Handles the current value in the enclosing operation. */ () => error)),
    );
  }



  /**
   * Compares immutable contents independently of key order and mutable likes.
   * @param recipe Expected or stored recipe.
   * @returns Canonical Firebase representation of the recipe contents.
   */
  private recipeContents(recipe: Recipe): string {
    const { id, likes, ...stored } = recipe;
    return JSON.stringify(this.firebaseValue(stored));
  }



  /**
   * Normalizes arrays and omitted empty nodes to Firebase's keyed JSON representation.
   * @param value Nested recipe value.
   * @returns Canonical value, or undefined for an empty node.
   */
  private firebaseValue(value: unknown): unknown {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'object') return value;
    const entries = Object.entries(value).sort(/** Sorts keys consistently. @param a First entry. @param b Second entry. */ (a, b) => a[0].localeCompare(b[0]))
      .map(/** Normalizes a nested value. @param entry Key and nested value. */ ([key, child]) => [key, this.firebaseValue(child)])
      .filter(/** Omits empty Firebase nodes. @param entry Normalized entry. */ (entry) => entry[1] !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }



  /**
   * Converts Firebase's keyed object response to a recipe array.
   * @param response HTTP response to inspect.
   * @returns {Recipe[]} The result of this operation.
   */
  private toRecipeList(response: FirebaseRecipeMap): Recipe[] {
    if (!response) return [];
    return Object.entries(response).map(/** Maps the current item to its output value. @param [id, recipe] Current callback input. */ ([id, recipe]) => ({ ...recipe, likes: recipe.likes ?? 0, id }));
  }
}
