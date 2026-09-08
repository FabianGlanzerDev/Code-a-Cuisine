/**
 * Checks a recipe title without accepting empty, duplicate or placeholder headings.
 * @param title Input used by this operation.
 */
function validTitle(title) {
  return typeof title === 'string' && title.trim().length >= 5 && title.length <= 120
    && title.trim().split(/\s+/).length >= 2
    && !/\b(test\d*|recipe\s*xyz|lorem|placeholder|untitled)\b/i.test(title);
}



/**
 * Parses an explicit duration in minutes and enforces the selected category.
 * @param value Value to validate or store.
 * @param category Selected cooking-time category.
 */
function cookingMinutes(value, category) {
  const match = typeof value === 'string' && value.match(/^(\d+)\s*(min|minutes)$/i);
  const minutes = match ? Number(match[1]) : NaN;
  const valid = category === 'quick' ? minutes <= 20 : category === 'medium' ? minutes >= 20 && minutes <= 45 : minutes > 45;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440 || !valid) throw new Error('Cooking time is outside the selected range.');
  return minutes;
}



/**
 * Derives the final ingredient quantity from the supplied one-portion base.
 * @param entry Ingredient entry to validate.
 * @param portions Requested portion count.
 * @param available Available input ingredient quantity.
 */
function scaleIngredient(entry, portions, available) {
  if (!validIngredient(entry)) throw new Error('Invalid recipe ingredient quantity.');
  const base = parseAmount(entry.perPortionServingSize);
  const total = parseAmount(entry.servingSize);
  if (!base || base.unit !== total.unit) throw new Error('Missing per-portion ingredient quantity.');
  const scaled = Math.round(base.amount * portions * 1000) / 1000;
  if (scaled <= 0 || scaled > 10000 || Math.abs(scaled - total.amount) > 0.001) throw new Error('Ingredient quantity does not scale with portions.');
  if (available && (available.unit !== total.unit || scaled > available.amount + 0.001)) throw new Error('Insufficient ingredient quantities for selected servings.');
  entry.servingSize = `${scaled}${base.unit}`;
}



/**
 * Checks exact ingredient coverage, disjoint extras and positive scaled quantities.
 * @param recipe Recipe to process.
 * @param request Validated recipe requirements.
 */
function validateRecipeIngredients(recipe, request) {
  const own = recipe.ingredients?.yourIngredients;
  const extras = recipe.ingredients?.extraIngredients;
  if (!Array.isArray(own) || !Array.isArray(extras) || extras.length > 3) throw new Error('Invalid ingredient lists.');
  const all = [...own, ...extras];
  if (new Set(all.map(foodName)).size !== all.length) throw new Error('Duplicate recipe ingredients.');
  const supplied = new Map(request.ingredients.map(/** Maps the current item to its output value. @param entry Current callback input. */ (entry) => [foodName(entry), parseAmount(entry.servingSize)]));
  if (own.length < Math.ceil(supplied.size * 0.7) || own.some(/** Checks whether this item meets the condition. @param entry Current callback input. */ (entry) => !supplied.has(foodName(entry)))) throw new Error('Ingredient coverage must be at least 70%.');
  own.forEach(/** Processes the current item in the enclosing operation. @param entry Current callback input. */ (entry) => scaleIngredient(entry, request.portionsAmount, supplied.get(foodName(entry))));
  validateExtras(extras, supplied, request.portionsAmount);
  if (all.some(/** Checks whether this item meets the condition. @param entry Current callback input. */ (entry) => violatesDiet(entry, request.dietPreferences))) throw new Error('Ingredients violate the selected diet.');
}



/**
 * Limits extra ingredients to common pantry basics and excludes supplied foods.
 * @param extras Input used by this operation.
 * @param supplied Input ingredient quantities indexed by name.
 * @param portions Requested portion count.
 */
function validateExtras(extras, supplied, portions) {
  const basics = /^(salt|pepper|black pepper|water|olive oil|oil|butter|flour|sugar|vinegar|garlic|onion|lemon|lemon juice|paprika|cumin|turmeric|curry powder|soy sauce|basil|oregano|parsley|salz|pfeffer|wasser|olivenöl|öl|mehl|zucker|essig|knoblauch|zwiebel|zitrone)$/i;
  for (const entry of extras) {
    if (!basics.test(foodName(entry)) || supplied.has(foodName(entry))) throw new Error('Extra ingredients must be missing pantry basics.');
    scaleIngredient(entry, portions);
  }
}



/**
 * Validates the selected preferences and every structured part of one recipe.
 * @param recipe Recipe to process.
 * @param request Validated recipe requirements.
 */
function validateRecipe(recipe, request) {
  if (recipe.portionsAmount !== request.portionsAmount || recipe.cooksAmount !== request.cooksAmount) throw new Error('Portions or cooks do not match.');
  for (const key of ['cuisine', 'dietPreferences', 'cookingTime']) {
    if (recipe.preferences?.[key] !== request[key]) throw new Error('Recipe preferences do not match.');
  }
  const minutes = cookingMinutes(recipe.cookingTime, request.cookingTime);
  validateRecipeIngredients(recipe, request);
  validateNutrition(recipe, request);
  validateDirections(recipe, request.cooksAmount, minutes);
}



/**
 * Validates all three AI suggestions before returning or persisting any result.
 * @param raw Raw JSON recipe response.
 * @param request Validated recipe requirements.
 */
function validateRecipes(raw, request) {
  const recipes = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/gi, '').trim());
  if (!Array.isArray(recipes) || recipes.length !== 3) throw new Error('Exactly three recipes are required.');
  if (recipes.some(/** Checks whether this item meets the condition. @param recipe Current callback input. */ (recipe) => !validTitle(recipe?.title))) throw new Error('Invalid recipe title.');
  if (new Set(recipes.map(/** Maps the current item to its output value. @param recipe Current callback input. */ (recipe) => recipe.title.trim().toLowerCase())).size !== 3) throw new Error('Recipe titles must be unique.');
  recipes.forEach(/** Processes the current item in the enclosing operation. @param recipe Current callback input. */ (recipe) => validateRecipe(recipe, request));
  const methods = recipes.map(/** Maps the current item to its output value. @param recipe Current callback input. */ (recipe) => JSON.stringify(recipe.directions.map(/** Maps the current item to its output value. @param step Current callback input. */ (step) => step.description.trim().toLowerCase())));
  if (new Set(methods).size !== 3) throw new Error('Recipes must differ in preparation, not only in title.');
  return recipes;
}



module.exports = { validTitle, cookingMinutes, scaleIngredient, validateRecipeIngredients, validateRecipes };
