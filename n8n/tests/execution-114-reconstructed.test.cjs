const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, validateRecipes } = require('./helpers.cjs');
const workflow = require('../exports/generate-recipe-input-popup.json');

/** Reconstructs only the reported request; this is not an execution export. */
function reportedRequest() {
  return { ingredients: [{ ingredient: 'Carrot', servingSize: '500g' }, { ingredient: 'Potato', servingSize: '600g' },
    { ingredient: 'Onion', servingSize: '200g' }, { ingredient: 'Chickpeas', servingSize: '400g' }],
  portionsAmount: 2, cooksAmount: 2, cuisine: 'german', cookingTime: 'medium', dietPreferences: 'vegan' };
}



/** Reconstructs quantities and oil findings using synthetic titles, nutrition and directions. */
function reconstructedRecipes() {
  return fixture().map(/** Creates one alternative using the full available amounts independently. */ recipe => ({ ...recipe,
    cookingTime: '30 min', preferences: { ...recipe.preferences, cookingTime: 'medium' },
    ingredients: { yourIngredients: reportedRequest().ingredients.map(/** Scales one supplied ingredient. */ entry => ({ ...entry,
      perPortionServingSize: (parseInt(entry.servingSize) / 2) + 'g' })),
    extraIngredients: [{ ingredient: 'Vegetable oil', servingSize: '20ml', perPortionServingSize: '10ml' }] } }));
}



/** Executes the actual exported validator with no model, quota write or Firebase call. */
function output(recipes) {
  const code = workflow.nodes.find(/** Selects the validation node. */ node => node.name === 'Validate Recipe Output').parameters.jsCode;
  const input = { first: /** Returns the reconstructed model result. */ () => ({ json: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(recipes) }] } }] } }) };
  const lookup = /** Supplies a reserved request without changing counters. */ () => ({ first: /** Returns test context. */ () => ({ json: { request: reportedRequest(), quota: { ipUsed: 3, systemUsed: 3 } } }) });
  return new Function('$input', '$', code)(input, lookup)[0].json;
}



/** Builds the reported invalid finish-to-start dependency in a synthetic schedule. */
function badSchedule(recipe) {
  recipe.directions = [{ order: 1, cook: 1, startMinute: 0, durationMinutes: 4, dependsOn: [], parallel: true },
    { order: 2, cook: 2, startMinute: 0, durationMinutes: 4, dependsOn: [], parallel: true },
    { order: 3, cook: 1, startMinute: 8, durationMinutes: 20, dependsOn: [1], parallel: false },
    { order: 4, cook: 2, startMinute: 23, durationMinutes: 2, dependsOn: [3], parallel: false }]
    .map(/** Adds explicitly synthetic step text. */ step => ({ ...step, title: 'Reconstructed step', description: 'Synthetic timing regression step ' + step.order }));
}



 test('reconstructed #114: vegetable oil normalizes; alternatives do not sum quantities', /** Verifies independent alternatives. */ () => {
  const recipes = validateRecipes(JSON.stringify(reconstructedRecipes()), reportedRequest());
  assert.equal(recipes.length, 3);
  for (const recipe of recipes) { assert.equal(recipe.ingredients.extraIngredients[0].ingredient, 'oil'); assert.equal(recipe.ingredients.yourIngredients[0].servingSize, '500g'); }
});

test('reconstructed #114: broth stays rejected, with safe recipe and field diagnostics', /** Keeps broth distinct from water. */ () => {
  const recipes = reconstructedRecipes();
  recipes[2].ingredients.extraIngredients.push({ ingredient: 'Vegetable broth', servingSize: '200ml', perPortionServingSize: '100ml' });
  badSchedule(recipes[2]);
  const result = output(recipes);
  assert.equal(result.code, 'MODEL_OUTPUT_INVALID');
  assert.deepEqual(result.validationIssue, { code: 'EXTRA_INGREDIENT_NOT_ALLOWED', recipeIndex: 2, field: 'ingredients.extraIngredients[1]' });
  assert.equal(JSON.stringify(result).includes('Vegetable broth'), false);
  assert.equal(JSON.stringify(result).includes('Carrot'), false);
});

test('reconstructed #114: minute 23 cannot depend on a step finishing at 28', /** Keeps real dependencies mandatory. */ () => {
  const recipes = reconstructedRecipes(); badSchedule(recipes[2]);
  assert.deepEqual(output(recipes).validationIssue, { code: 'DEPENDENCY_NOT_FINISHED', recipeIndex: 2, field: 'directions[3].dependsOn' });
  recipes[2].directions[3].startMinute = 28;
  assert.equal(output(recipes).valid, true);
  assert.deepEqual(recipes[2].directions[3].dependsOn, [3]);
});

test('model quantity excess is a technical output error, not proof of insufficient inputs', /** Preserves the error boundary. */ () => {
  const recipes = reconstructedRecipes();
  Object.assign(recipes[1].ingredients.yourIngredients[0], { servingSize: '502g', perPortionServingSize: '251g' });
  const result = output(recipes);
  assert.equal(result.code, 'MODEL_OUTPUT_INVALID');
  assert.deepEqual(result.validationIssue, { code: 'MODEL_QUANTITY_EXCEEDS_AVAILABLE', recipeIndex: 1, field: 'ingredients.yourIngredients[0]' });
});

test('aliases cannot bypass duplicate, pantry or vegan checks', /** Checks strict alias boundaries. */ () => {
  for (const ingredient of ['Chicken broth', 'Vegetable broth', 'Vegetable oil with bacon', 'Butter']) {
    const recipes = reconstructedRecipes(); recipes[0].ingredients.extraIngredients[0].ingredient = ingredient;
    assert.equal(output(recipes).valid, false);
  }
  const recipes = reconstructedRecipes(); recipes[0].ingredients.extraIngredients.push({ ingredient: 'oil', servingSize: '20ml', perPortionServingSize: '10ml' });
  assert.equal(output(recipes).valid, false);
});

test('prompt contains the validator pantry list and explicit schedule constraints', /** Checks the exported prompt, not a separate mock. */ () => {
  const code = workflow.nodes.find(/** Selects prompt construction. */ node => node.name === 'Build Model Request').parameters.jsCode;
  const lookup = /** Provides synthetic input. */ () => ({ first: /** Reads synthetic input. */ () => ({ json: { request: reportedRequest() } }) });
  const prompt = new Function('$', code)(lookup)[0].json.systemInstruction.parts[0].text;
  assert.ok(prompt.includes(require('../lib/recipes.cjs').PANTRY_BASICS.join(', ')));
  assert.ok(prompt.includes('finish-to-start'));
  assert.ok(prompt.includes('never add quantities across'));
  assert.ok(!prompt.includes('{{PANTRY_BASICS}}'));
});
