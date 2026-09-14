const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateNutrition } = require('../lib/nutrition.cjs');
const { validateDirections } = require('../lib/directions.cjs');
const { library } = require('../workflow-tools.cjs');
const request = require('./fixtures/execution-136/validated-request.json').request;
const current = new Function(library(['ingredients', 'nutrition', 'directions', 'recipes']) + 'return {validateRecipes};')();
const original = require('./fixtures/execution-136/recipes.json');
const oldSource = fs.readFileSync('n8n/tests/fixtures/execution-114/114-original-validator.txt', 'utf8');
const old = new Function(oldSource.slice(0, oldSource.indexOf("const context = $('Prepare Reservation')")) + 'return {validateSnapshot};')();

test('original #136: third recipe reproduces the old percentage rejection', /** Uses unchanged extracted response data, without any substituted request. */ () => {
  assert.throws(/** Runs the previous snapshot validator only. */ () => old.validateSnapshot(original[2].nutritionalInformation.perPortion), /Macro percentages/);
});

test('original #136: all nutrition passes internal checks using response-declared portions only', /** Isolates snapshot consistency; full request agreement is tested separately. */ () => {
  const recipes = structuredClone(original);
  for (const recipe of recipes) validateNutrition(recipe, { portionsAmount: recipe.portionsAmount });
  for (const key of ['perPortion', 'total']) {
    const snapshot = recipes[2].nutritionalInformation[key];
    assert.deepEqual([snapshot.proteinsPercent, snapshot.fatsPercent, snapshot.carbsPercent], ['8.60%', '13.56%', '77.84%']);
  }
  for (let i = 0; i < recipes.length; i++) for (const key of ['perPortion', 'total']) for (const field of ['calories', 'proteins', 'fats', 'carbs']) {
    assert.equal(recipes[i].nutritionalInformation[key][field], original[i].nutritionalInformation[key][field]);
  }
});

test('original #136: schedules are internally consistent with response-declared cooks and time', /** Checks further independent constraints, not agreement with a request. */ () => {
  for (const recipe of original) assert.doesNotThrow(/** Checks dependencies, overlap, parallel flags and duration. */ () => validateDirections(recipe, recipe.cooksAmount, parseInt(recipe.cookingTime, 10)));
});

test('original #136: complete batch passes with the original three-ingredient request', /** Replays all validators without substituting request #114. */ () => {
  assert.deepEqual(request.ingredients.map(/** Checks the exact supplied names. */ entry => entry.ingredient), ['Carrot', 'Potato', 'Onion']);
  const recipes = current.validateRecipes(JSON.stringify(original), request);
  assert.equal(recipes.length, 3);
  assert.deepEqual(recipes.map(/** Preserves the original recipe identities. */ recipe => recipe.title), original.map(/** Reads original titles. */ recipe => recipe.title));
});

test('original #136: importable workflow validator accepts the complete original batch offline', /** Executes only the validation node; no model, quota or storage calls. */ () => {
  const workflow = require('../exports/generate-recipe-input-popup.json');
  const node = workflow.nodes.find(/** Finds the exported validator. */ node => node.name === 'Validate Recipe Output');
  const model = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(original) }] } }] };
  const lookup = /** Supplies the original request and inert quota context. */ () => ({ first: /** Supplies local context. */ () => ({ json: { request, quota: {} } }) });
  const result = new Function('$input', '$', node.parameters.jsCode)({ first: /** Supplies the unchanged recipe data in a minimal response envelope. */ () => ({ json: model }) }, lookup)[0].json;
  assert.equal(result.valid, true); assert.equal(result.recipes.length, 3);
  assert.equal(result.recipes[2].nutritionalInformation.perPortion.fatsPercent, '13.56%');
});
