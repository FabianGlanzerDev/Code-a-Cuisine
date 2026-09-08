import { GeneratedRecipe, RecipeRequirements } from '../app/models/recipe.model';

export const requirements: RecipeRequirements = {
  ingredients: [{ ingredient: 'Carrot', servingSize: '100g', isEditMode: false }],
  portionsAmount: 2, cooksAmount: 1, cookingTime: 'quick', cuisine: 'german', dietPreferences: 'vegan',
};

/**
 * Returns fresh recipe data for HTTP and view tests without invoking a model.
 * @returns {GeneratedRecipe[]} The result of this operation.
 */
export function generatedRecipes(): GeneratedRecipe[] {
  return ['Carrot Bowl', 'Carrot Plate', 'Carrot Skillet'].map(/** Maps the current item to its output value. @param title Current callback input. */ (title) => ({
    title, cookingTime: '10 min', portionsAmount: 2, cooksAmount: 1,
    preferences: { cookingTime: 'quick', cuisine: 'german', dietPreferences: 'vegan' },
    ingredients: { yourIngredients: [{ ingredient: 'Carrot', servingSize: '100g' }], extraIngredients: [] },
    nutritionalInformation: { perPortion: nutrition(), total: nutrition(2) },
    directions: [{ order: 1, title: 'Prepare carrots', description: 'Wash and cook the carrots.', cook: 1 }],
  }));
}



/**
 * Returns a consistent nutrition snapshot for a selected scale.
 * @param scale Nutrition scale factor.
 */
function nutrition(scale = 1) {
  return { calories: `${210 * scale} kcal`, proteins: `${10 * scale}g`, proteinsPercent: '19.05%',
    fats: `${10 * scale}g`, fatsPercent: '42.86%', carbs: `${20 * scale}g`, carbsPercent: '38.1%' };
}
