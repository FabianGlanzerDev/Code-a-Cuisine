import { Injectable } from '@angular/core';
import { COOKING_TIMES, CUISINES, DIET_PREFERENCES } from '../data/preferences.data';
import { Cuisine } from '../models/cuisine.model';
import { Recipe } from '../models/recipe.model';

const GENERATED_RECIPES_KEY = 'code-a-cuisine-generated-recipes';

@Injectable({ providedIn: 'root' })
export class RecipeStoreService {
  currentRecipes: Recipe[] = [];
  generatedRecipes: Recipe[] = this.readGeneratedRecipes();
  selectedRecipes: Recipe[] = [];
  readonly cookingTimes = COOKING_TIMES;
  readonly cuisines = CUISINES;
  readonly dietPreferences = DIET_PREFERENCES;

  /** Replaces recipes used by transient views such as the cookbook hero. */
  setCurrentRecipes(recipes: Recipe[]): void {
    this.currentRecipes = recipes;
  }

  /** Stores the latest generated recipe set for returning from recipe details. */
  setGeneratedRecipes(recipes: Recipe[]): void {
    this.generatedRecipes = recipes;
    this.writeGeneratedRecipes(recipes);
  }

  /** Replaces the recipes shown in a cookbook category. */
  setSelectedRecipes(recipes: Recipe[]): void {
    this.selectedRecipes = recipes;
  }

  /** Finds a recipe already available in any recipe collection. */
  findRecipe(id: string): Recipe | undefined {
    return this.generatedRecipes.find((recipe) => recipe.id === id)
      ?? this.currentRecipes.find((recipe) => recipe.id === id)
      ?? this.selectedRecipes.find((recipe) => recipe.id === id);
  }

  /** Finds cuisine metadata by its route/query value. */
  findCuisine(name: string | null): Cuisine | undefined {
    return this.cuisines.find((cuisine) => cuisine.name === name);
  }

  /** Saves the latest result set in both browser stores. */
  private writeGeneratedRecipes(recipes: Recipe[]): void {
    const value = JSON.stringify(recipes);

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(GENERATED_RECIPES_KEY, value);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GENERATED_RECIPES_KEY, value);
    }
  }

  /** Restores the latest generated results, preferring the current tab session. */
  private readGeneratedRecipes(): Recipe[] {
    const sessionRecipes = this.readRecipesFromStorage(
      typeof sessionStorage === 'undefined' ? null : sessionStorage,
    );
    if (sessionRecipes.length) return sessionRecipes;

    return this.readRecipesFromStorage(
      typeof localStorage === 'undefined' ? null : localStorage,
    );
  }

  /** Safely parses one browser-storage result set. */
  private readRecipesFromStorage(storage: Storage | null): Recipe[] {
    if (!storage) return [];

    try {
      const stored = JSON.parse(storage.getItem(GENERATED_RECIPES_KEY) ?? '[]');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }
}
