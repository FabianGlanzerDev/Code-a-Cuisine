import { RecipeRequirements, IngredientEntry } from '../models/recipe.model';
import { COOKING_TIMES, CUISINES, DIET_PREFERENCES } from '../data/preferences.data';

/** Checks stored quantities without inventing portion-size rules. @param entry Untrusted ingredient. */
export function validEntry(entry: IngredientEntry): boolean {
  if (!entry || typeof entry.ingredient !== 'string' || !entry.ingredient.trim() || typeof entry.servingSize !== 'string') return false;
  const amount = entry.servingSize.match(/^(\d+(?:\.\d+)?)(g|ml)?$/);
  return !!amount && Number(amount[1]) > 0 && Number(amount[1]) <= 10000 && typeof entry.isEditMode === 'boolean';
}



/** Validates restored or current preferences and ingredient quantities. @param value Untrusted draft. */
export function validRequirements(value: unknown): value is RecipeRequirements {
  if (!value || typeof value !== 'object') return false;
  const item = value as RecipeRequirements;
  return Array.isArray(item.ingredients) && item.ingredients.length <= 30 && item.ingredients.every(validEntry)
    && Number.isInteger(item.portionsAmount) && item.portionsAmount >= 1 && item.portionsAmount <= 12
    && Number.isInteger(item.cooksAmount) && item.cooksAmount >= 1 && item.cooksAmount <= 3
    && COOKING_TIMES.some(/** Matches an allowed time. @param time Option. */ time => time.value === item.cookingTime)
    && CUISINES.some(/** Matches an allowed cuisine. @param cuisine Option. */ cuisine => cuisine.name === item.cuisine)
    && DIET_PREFERENCES.some(/** Matches an allowed diet. @param diet Option. */ diet => diet === item.dietPreferences);
}
