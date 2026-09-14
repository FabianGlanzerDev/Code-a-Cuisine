const VALIDATION_RULES = {
  "Extra ingredients must be missing pantry basics.": [
    "EXTRA_INGREDIENT_NOT_ALLOWED",
    "ingredients.extraIngredients"
  ],
  "Insufficient ingredient quantities for selected servings.": [
    "MODEL_QUANTITY_EXCEEDS_AVAILABLE",
    "ingredients.yourIngredients"
  ],
  "Step starts before its dependency finishes.": [
    "DEPENDENCY_NOT_FINISHED",
    "directions.dependsOn"
  ],
  "Invalid step dependency.": [
    "INVALID_DEPENDENCY",
    "directions.dependsOn"
  ],
  "One cook has overlapping tasks.": [
    "COOK_TIME_OVERLAP",
    "directions"
  ],
  "Parallel marker does not match the schedule.": [
    "PARALLEL_FLAG_MISMATCH",
    "directions"
  ],
  "Directions exceed the cooking time.": [
    "SCHEDULE_EXCEEDS_COOKING_TIME",
    "directions"
  ],
  "Incomplete model response.": [
    "MODEL_RESPONSE_INCOMPLETE",
    "candidates.finishReason"
  ],
  "Cooking time is outside the selected range.": [
    "COOKING_TIME_IS_OUTSIDE_THE_SELECTED_RANGE",
    "$"
  ],
  "Invalid recipe ingredient quantity.": [
    "INVALID_RECIPE_INGREDIENT_QUANTITY",
    "$"
  ],
  "Missing per-portion ingredient quantity.": [
    "MISSING_PER_PORTION_INGREDIENT_QUANTITY",
    "$"
  ],
  "Ingredient quantity does not scale with portions.": [
    "INGREDIENT_QUANTITY_DOES_NOT_SCALE_WITH_PORTIONS",
    "$"
  ],
  "Invalid ingredient lists.": [
    "INVALID_INGREDIENT_LISTS",
    "$"
  ],
  "Duplicate recipe ingredients.": [
    "DUPLICATE_RECIPE_INGREDIENTS",
    "$"
  ],
  "Ingredient coverage must be at least 70%.": [
    "INGREDIENT_COVERAGE_MUST_BE_AT_LEAST_70",
    "$"
  ],
  "Ingredients violate the selected diet.": [
    "INGREDIENTS_VIOLATE_THE_SELECTED_DIET",
    "$"
  ],
  "Portions or cooks do not match.": [
    "PORTIONS_OR_COOKS_DO_NOT_MATCH",
    "$"
  ],
  "Recipe preferences do not match.": [
    "RECIPE_PREFERENCES_DO_NOT_MATCH",
    "$"
  ],
  "Exactly three recipes are required.": [
    "EXACTLY_THREE_RECIPES_ARE_REQUIRED",
    "$"
  ],
  "Invalid recipe title.": [
    "INVALID_RECIPE_TITLE",
    "$"
  ],
  "Recipe titles must be unique.": [
    "RECIPE_TITLES_MUST_BE_UNIQUE",
    "$"
  ],
  "Recipes must differ in preparation, not only in title.": [
    "RECIPES_MUST_DIFFER_IN_PREPARATION_NOT_ONLY_IN_TITLE",
    "$"
  ],
  "Invalid step order or cook.": [
    "INVALID_STEP_ORDER_OR_COOK",
    "$"
  ],
  "Incomplete direction.": [
    "INCOMPLETE_DIRECTION",
    "$"
  ],
  "Invalid step timing.": [
    "INVALID_STEP_TIMING",
    "$"
  ],
  "Directions are not chronological.": [
    "DIRECTIONS_ARE_NOT_CHRONOLOGICAL",
    "$"
  ],
  "Missing step dependencies or parallel marker.": [
    "MISSING_STEP_DEPENDENCIES_OR_PARALLEL_MARKER",
    "$"
  ],
  "Incomplete cook task allocation.": [
    "INCOMPLETE_COOK_TASK_ALLOCATION",
    "$"
  ],
  "Invalid directions.": [
    "INVALID_DIRECTIONS",
    "$"
  ],
  "Nutrition must include units.": [
    "NUTRITION_MUST_INCLUDE_UNITS",
    "$"
  ],
  "Invalid nutrition amount or unit.": [
    "INVALID_NUTRITION_AMOUNT_OR_UNIT",
    "$"
  ],
  "Invalid nutrition amount.": [
    "INVALID_NUTRITION_AMOUNT",
    "$"
  ],
  "Nutrition is missing.": [
    "NUTRITION_IS_MISSING",
    "$"
  ],
  "Nutrition energy is inconsistent.": [
    "NUTRITION_ENERGY_IS_INCONSISTENT",
    "$"
  ],
  "Macro percentages are inconsistent.": [
    "MACRO_PERCENTAGES_ARE_INCONSISTENT",
    "$"
  ],
  "Total nutrition does not match portions.": [
    "TOTAL_NUTRITION_DOES_NOT_MATCH_PORTIONS",
    "$"
  ],
  "Keto recipes must have at most 10% carbohydrate energy.": [
    "KETO_RECIPES_MUST_HAVE_AT_MOST_10_CARBOHYDRATE_ENERGY",
    "$"
  ]
};

const PANTRY_BASICS = 'salt,pepper,black pepper,water,olive oil,oil,butter,flour,sugar,vinegar,garlic,onion,lemon,lemon juice,paprika powder,cumin,turmeric,curry powder,soy sauce,basil,oregano,parsley,salz,pfeffer,wasser,olivenöl,öl,mehl,zucker,essig,knoblauch,zwiebel,zitrone'.split(',');

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
  if (new Set(all.map(recipeFoodName)).size !== all.length) throw new Error('Duplicate recipe ingredients.');
  const supplied = new Map(request.ingredients.map(/** Maps the current item to its output value. @param entry Current callback input. */ (entry) => [recipeFoodName(entry), parseAmount(entry.servingSize)]));
  if (own.length < Math.ceil(supplied.size * 0.7) || own.some(/** Checks whether this item meets the condition. @param entry Current callback input. */ (entry) => !supplied.has(recipeFoodName(entry)))) throw new Error('Ingredient coverage must be at least 70%.');
  own.forEach(/** Processes the current item in the enclosing operation. @param entry Current callback input. */ (entry, index) => withValidationField(`ingredients.yourIngredients[${index}]`, /** Checks one supplied quantity. */ () => scaleIngredient(entry, request.portionsAmount, supplied.get(recipeFoodName(entry)))));
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
  const basics = new Set(PANTRY_BASICS.map(/** Uses the same identity for pantry aliases. @param ingredient Food name. */ ingredient => foodName({ ingredient })));
  for (const [index, entry] of extras.entries()) {
    withValidationField(`ingredients.extraIngredients[${index}]`, /** Checks one extra. */ () => {
    if (entry.ingredient?.trim().toLowerCase() === 'paprika') entry.ingredient = 'paprika powder';
    if (!basics.has(recipeFoodName(entry)) || supplied.has(recipeFoodName(entry))) throw new Error('Extra ingredients must be missing pantry basics.');
    entry.ingredient = recipeFoodName(entry);
    scaleIngredient(entry, portions);
    });
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
  withValidationField('ingredients', /** Checks all ingredient constraints. */ () => validateRecipeIngredients(recipe, request));
  withValidationField('nutritionalInformation', /** Checks nutrition consistency. */ () => validateNutrition(recipe, request));
  withValidationField('directions', /** Checks the schedule. */ () => validateDirections(recipe, request.cooksAmount, minutes));
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
  recipes.forEach(/** Processes the current item in the enclosing operation. @param recipe Current callback input. */ (recipe, index) => { try { validateRecipe(recipe, request); } catch (error) { error.recipeIndex = index; throw error; } });
  const methods = recipes.map(/** Maps the current item to its output value. @param recipe Current callback input. */ (recipe) => JSON.stringify(recipe.directions.map(/** Maps the current item to its output value. @param step Current callback input. */ (step) => step.description.trim().toLowerCase())));
  if (new Set(methods).size !== 3) throw new Error('Recipes must differ in preparation, not only in title.');
  return recipes;
}



/** Normalizes only the unambiguous vegetable-oil alias for recipe checks. */
function recipeFoodName(entry) {
  const name = foodName(entry);
  return name === 'vegetable oil' ? 'oil' : name;
}



/** Adds a static field path without exposing model or request contents. */
function withValidationField(field, validate) {
  try { return validate(); } catch (error) { error.validationField ??= field; throw error; }
}



/** Returns only allowlisted diagnostic metadata; recipeIndex is zero-based. */
function safeValidationIssue(error) {
  const rule = VALIDATION_RULES[error.message] ?? [error instanceof SyntaxError ? 'INVALID_JSON' : 'SCHEMA_REJECTED', '$'];
  const field = error.validationField?.includes('[') ? error.validationField : rule[1] !== '$' ? rule[1] : error.validationField ?? '$';
  return { code: rule[0], recipeIndex: Number.isSafeInteger(error.recipeIndex) ? error.recipeIndex : null, field };
}



module.exports = { PANTRY_BASICS, validTitle, cookingMinutes, scaleIngredient, validateRecipeIngredients, validateRecipes };
