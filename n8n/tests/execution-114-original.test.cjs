const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { library } = require('../workflow-tools.cjs');
const model = require('./fixtures/execution-114/114-model-response.json')[0];
const request = require('./fixtures/execution-114/114-validate-request.json').request;
const source = fs.readFileSync('n8n/tests/fixtures/execution-114/114-original-validator.txt', 'utf8');
const original = new Function(source.slice(0, source.indexOf("const context = $('Prepare Reservation')")) + 'return {validateRecipes, validateRecipe};')();
const current = new Function(library(['ingredients', 'nutrition', 'directions', 'recipes']) + 'return {validateRecipes, validateRecipeIngredients, safeValidationIssue};')();

/** Parses a fresh copy of the unchanged original model text. */
function recipes() { return JSON.parse(model.candidates[0].content.parts[0].text); }



/** Captures a safe diagnostic from the current full validator. */
function issue(value) {
  try { current.validateRecipes(JSON.stringify(value), request); } catch (error) { return current.safeValidationIssue(error); }
  return null;
}



 test('original #114: original validator rejects vegetable oil in each recipe', /** Reproduces the original allowlist mismatch. */ () => {
  const value = recipes();
  for (const recipe of value) {
    recipe.ingredients.extraIngredients = recipe.ingredients.extraIngredients.filter(/** Isolates oil from broth. */ entry => entry.ingredient !== 'Vegetable broth');
    assert.throws(/** Runs the original single-recipe validator. */ () => original.validateRecipe(recipe, request), /pantry basics/);
  }
  assert.throws(/** Replays the original complete response. */ () => original.validateRecipes(model.candidates[0].content.parts[0].text, request), /pantry basics/);
});

test('original #114: unchanged output retains an exact broth diagnostic', /** Uses the original response, not reconstructed data. */ () => {
  assert.deepEqual(issue(recipes()), { code: 'EXTRA_INGREDIENT_NOT_ALLOWED', recipeIndex: 0, field: 'ingredients.extraIngredients[0]' });
});

test('original #114: staged test-only corrections expose dependency, flags and duration', /** Never patches production model output. */ () => {
  const value = recipes(); value[0].ingredients.extraIngredients.shift();
  assert.equal(issue(value).code, 'DEPENDENCY_NOT_FINISHED');
  assert.equal(issue(value).field, 'directions[3].dependsOn');
  value[0].directions[3].startMinute = 28;
  assert.equal(issue(value).code, 'PARALLEL_FLAG_MISMATCH');
  value[0].directions[2].parallel = false; value[0].directions[3].parallel = false;
  assert.equal(issue(value).code, 'SCHEDULE_EXCEEDS_COOKING_TIME');
  value[0].cookingTime = '33 min';
  assert.equal(issue(value), null);
  assert.deepEqual(value[0].directions[3].dependsOn, [3]);
});

test('original #114: all own quantities fit independently and oil aliases pass', /** Distinguishes model defects from user quantities. */ () => {
  for (const recipe of recipes()) {
    recipe.ingredients.extraIngredients = recipe.ingredients.extraIngredients.filter(/** Isolates quantity validation from unapproved broth. */ entry => entry.ingredient !== 'Vegetable broth');
    assert.doesNotThrow(/** Checks real quantities without summing alternatives. */ () => current.validateRecipeIngredients(recipe, request));
    assert.ok(recipe.ingredients.extraIngredients.some(/** Confirms normalized oil. */ entry => entry.ingredient === 'oil'));
  }
});

test('prepared real workflow returns the shared technical code with safe diagnostics', /** Executes the actual importable code node offline. */ () => {
  const workflow = require('../exports/generate-recipe-input-popup.json');
  assert.equal(workflow.id, 'nVrQ3KLEq6mJNb44');
  const node = workflow.nodes.find(/** Finds the prepared validator. */ node => node.name === 'Validate Recipe Output');
  const lookup = /** Supplies context without writes. */ () => ({ first: /** Returns original request. */ () => ({ json: { request, quota: { ipUsed: 3, systemUsed: 3 } } }) });
  const result = new Function('$input', '$', node.parameters.jsCode)({ first: /** Returns original model output. */ () => ({ json: model }) }, lookup)[0].json;
  assert.equal(result.code, 'MODEL_OUTPUT_INVALID'); assert.equal(result.validationIssue.code, 'EXTRA_INGREDIENT_NOT_ALLOWED');
  assert.equal(JSON.stringify(result).includes('Carrot'), false);
});
