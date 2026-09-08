import { Injectable } from '@angular/core';
import { COOKING_TIMES, CUISINES, DIET_PREFERENCES } from '../data/preferences.data';
import { Cuisine } from '../models/cuisine.model';
import { Recipe } from '../models/recipe.model';
import { readBrowserValue, writeBrowserValue } from './browser-storage';

const GENERATED_RECIPES_KEY = 'code-a-cuisine-generated-recipes';
const PENDING_RECIPES_KEY = 'code-a-cuisine-pending-recipes';

@Injectable({ providedIn: 'root' })
export class RecipeStoreService {
  currentRecipes: Recipe[] = [];
  generatedRecipes: Recipe[] = this.readRecipeSet(GENERATED_RECIPES_KEY);
  pendingRecipes: Recipe[] = this.readRecipeSet(PENDING_RECIPES_KEY);
  pendingPersisted = true;
  selectedRecipes: Recipe[] = [];
  readonly cookingTimes = COOKING_TIMES;
  readonly cuisines = CUISINES;
  readonly dietPreferences = DIET_PREFERENCES;

  /**
   * Replaces recipes used by transient views such as the cookbook hero.
   * @param recipes Recipe set to process.
   */
  setCurrentRecipes(recipes: Recipe[]): void {
    this.currentRecipes = recipes;
  }



  /**
   * Stores the latest generated recipe set for returning from recipe details.
   * @param recipes Recipe set to process.
   */
  setGeneratedRecipes(recipes: Recipe[]): void {
    this.generatedRecipes = recipes;
    writeBrowserValue(GENERATED_RECIPES_KEY, recipes);
  }



  /**
   * Retains generated recipes until backend storage can be confirmed without another AI call.
   * @param recipes Recipe set to process.
   */
  setPendingRecipes(recipes: Recipe[]): void {
    this.pendingRecipes = recipes;
    this.pendingPersisted = writeBrowserValue(PENDING_RECIPES_KEY, recipes);
  }



  /**
   * Replaces the recipes shown in a cookbook category.
   * @param recipes Recipe set to process.
   */
  setSelectedRecipes(recipes: Recipe[]): void {
    this.selectedRecipes = recipes;
  }



  /**
   * Finds a recipe already available in any recipe collection.
   * @param id Recipe identifier.
   * @returns {Recipe | undefined} The result of this operation.
   */
  findRecipe(id: string): Recipe | undefined {
    return this.generatedRecipes.find(/** Checks whether the current item is the requested match. @param recipe Current callback input. */ (recipe) => recipe.id === id)
      ?? this.currentRecipes.find(/** Checks whether the current item is the requested match. @param recipe Current callback input. */ (recipe) => recipe.id === id)
      ?? this.selectedRecipes.find(/** Checks whether the current item is the requested match. @param recipe Current callback input. */ (recipe) => recipe.id === id);
  }



  /**
   * Finds cuisine metadata by its route/query value.
   * @param name Ingredient or node name.
   * @returns {Cuisine | undefined} The result of this operation.
   */
  findCuisine(name: string | null): Cuisine | undefined {
    return this.cuisines.find(/** Checks whether the current item is the requested match. @param cuisine Current callback input. */ (cuisine) => cuisine.name === name);
  }



  /**
   * Restores structurally complete result sets without trusting arbitrary browser JSON.
   * @param key Storage key or preference property.
   * @returns {Recipe[]} The result of this operation.
   */
  private readRecipeSet(key: string): Recipe[] {
    const stored = readBrowserValue<unknown>(key, []);
    if (!Array.isArray(stored)) return [];
    return stored.filter(/** Checks whether the current item matches the filter. @param recipe Current callback input. */ (recipe) => recipe && typeof recipe.id === 'string'
      && typeof recipe.title === 'string' && recipe.preferences && recipe.ingredients
      && Array.isArray(recipe.directions) && recipe.nutritionalInformation);
  }
}
