import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { GeneratedRecipe, Recipe, StoredRecipe } from '../models/recipe.model';

interface FirebaseCreateResponse {
  name: string;
}

type FirebaseRecipeMap = Record<string, StoredRecipe> | null;

@Injectable({ providedIn: 'root' })
export class RecipeApiService {
  constructor(private readonly http: HttpClient) {}

  /** Persists generated recipes and returns them with their Firebase IDs. */
  saveGeneratedRecipes(recipes: GeneratedRecipe[]): Observable<Recipe[]> {
    if (!recipes.length) return of([]);
    return forkJoin(recipes.map((recipe) => this.saveOne(recipe)));
  }

  /** Loads all recipes matching a cuisine. */
  getByCuisine(cuisine: string): Observable<Recipe[]> {
    const query = `?orderBy=%22cuisine%22&equalTo=${encodeURIComponent(JSON.stringify(cuisine))}`;
    return this.http
      .get<FirebaseRecipeMap>(`${environment.databaseUrl}recipes.json${query}`)
      .pipe(map((response) => this.toRecipeList(response)));
  }

  /** Loads the most-liked recipes for the horizontal cookbook strip. */
  getMostLiked(limit = 12): Observable<Recipe[]> {
    return this.http.get<FirebaseRecipeMap>(`${environment.databaseUrl}recipes.json`).pipe(
      map((response) =>
        this.toRecipeList(response)
          .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
          .slice(0, limit),
      ),
    );
  }

  /** Loads one recipe by its Firebase key, or null when the key no longer exists. */
  getById(id: string): Observable<Recipe | null> {
    return this.http.get<StoredRecipe | null>(`${environment.databaseUrl}recipes/${id}.json`).pipe(
      map((recipe) => (recipe ? { ...recipe, id } : null)),
    );
  }

  /** Changes one recipe's shared heart count and returns the persisted count. */
  changeLikes(id: string, delta: 1 | -1): Observable<number> {
    const url = `${environment.databaseUrl}recipes/${id}/likes.json`;
    return this.http.get<number | null>(url).pipe(
      switchMap((currentLikes) => {
        const nextLikes = Math.max(0, Number(currentLikes ?? 0) + delta);
        return this.http.put<number>(url, nextLikes).pipe(map(() => nextLikes));
      }),
    );
  }

  /** Saves one generated recipe and attaches its returned Firebase key. */
  private saveOne(recipe: GeneratedRecipe): Observable<Recipe> {
    const stored: StoredRecipe = { ...recipe, cuisine: recipe.preferences.cuisine, likes: 0 };
    return this.http
      .post<FirebaseCreateResponse>(`${environment.databaseUrl}recipes.json`, stored)
      .pipe(map((response) => ({ ...stored, id: response.name })));
  }

  /** Converts Firebase's keyed object response to a recipe array. */
  private toRecipeList(response: FirebaseRecipeMap): Recipe[] {
    if (!response) return [];
    return Object.entries(response).map(([id, recipe]) => ({ ...recipe, id }));
  }
}
