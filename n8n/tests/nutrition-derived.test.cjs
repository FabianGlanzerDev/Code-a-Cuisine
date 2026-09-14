const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateNutrition } = require('../lib/nutrition.cjs');
const { fixture, request, validateRecipes } = require('./helpers.cjs');

/** Creates synthetic nutrition, explicitly not the original #136 response. */
function sample() {
  return { nutritionalInformation: { perPortion: { calories: '100 kcal', proteins: '2.15g', fats: '1.5066666666666666g', carbs: '19.46g', proteinsPercent: '9%', fatsPercent: '11%', carbsPercent: '80%' }, total: { calories: '200 kcal', proteins: '4.3g', fats: '3.013333333333333g', carbs: '38.92g' } } };
}



test('reconstructed #136 ratios are derived, not accepted from model estimates', /** Tests deterministic display output without altering source amounts. */ () => {
  const recipe = sample(); const before = structuredClone(recipe);
  validateNutrition(recipe, request());
  for (const key of ['perPortion', 'total']) {
    const value = recipe.nutritionalInformation[key];
    assert.deepEqual([value.proteinsPercent, value.fatsPercent, value.carbsPercent], ['8.60%', '13.56%', '77.84%']);
    for (const field of ['calories', 'proteins', 'fats', 'carbs']) assert.equal(value[field], before.nutritionalInformation[key][field]);
  }
});

test('absent, nonnumeric and out-of-range model percentages cannot reject valid grams', /** Ignores untrusted derived fields. */ () => {
  const recipes = fixture();
  for (const recipe of recipes) for (const snapshot of Object.values(recipe.nutritionalInformation)) {
    snapshot.proteinsPercent = '-900%'; snapshot.fatsPercent = null; delete snapshot.carbsPercent;
  }
  assert.equal(validateRecipes(JSON.stringify(recipes), request()).length, 3);
});

test('invalid source units, negative/nonfinite amounts and inconsistent calories still fail', /** Keeps source validation authoritative. */ () => {
  for (const bad of ['-1g', 'Infinityg', 'NaNg', '2ml', 2, '100001g']) {
    const recipe = sample(); recipe.nutritionalInformation.perPortion.proteins = bad;
    assert.throws(/** Rejects invalid source values. */ () => validateNutrition(recipe, request()));
  }
  const recipe = sample(); recipe.nutritionalInformation.perPortion.calories = '900 kcal';
  assert.throws(/** Rejects inconsistent calories. */ () => validateNutrition(recipe, request()), /energy/);
});

test('portion scaling remains mandatory even when individual snapshots have valid energy', /** Tests independent scaling validation. */ () => {
  const recipe = sample(); recipe.nutritionalInformation.total = structuredClone(recipe.nutritionalInformation.perPortion);
  assert.throws(/** Rejects incorrect recipe totals. */ () => validateNutrition(recipe, request()), /portions/);
});

test('keto uses the unrounded calculated share, never model values or display rounding', /** Checks the precise boundary around ten percent. */ () => {
  for (const carbs of [2.25, 2.251]) {
    const recipe = { nutritionalInformation: { perPortion: { calories: '90 kcal', proteins: '0g', fats: '9g', carbs: carbs + 'g', carbsPercent: '0%' }, total: { calories: '180 kcal', proteins: '0g', fats: '18g', carbs: (carbs * 2) + 'g' } } };
    if (carbs === 2.25) assert.doesNotThrow(/** Allows the exact boundary. */ () => validateNutrition(recipe, { ...request(), dietPreferences: 'keto' }));
    else assert.throws(/** Rejects a share above ten even though it rounds to ten. */ () => validateNutrition(recipe, { ...request(), dietPreferences: 'keto' }), /Keto/);
  }
});
