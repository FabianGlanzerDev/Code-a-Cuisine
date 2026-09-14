const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, request } = require('./helpers.cjs');

/** Validates a catalog input with a synthetic trusted IP, never contacting a model. @param names Food names. @param diet Requested diet. */
function check(names, diet = 'vegan') {
  return validateRequest({ body: { ...request(), dietPreferences: diet, ingredients: names.map(/** Creates an independent input. @param ingredient Food name. */ ingredient => ({ ingredient, servingSize: '100g' })) }, headers: { 'cf-connecting-ip': '192.0.2.1' } }, { trustedIpHeader: 'cf-connecting-ip', modelName: 'models/gemini-test' });
}



test('aliases are deduplicated before any model or reservation', /** Same food cannot use two languages to bypass duplicate validation. */ () => {
  const result = check(['Salt', 'Salz']); assert.equal(result.valid, false); assert.equal(result.code, 'INVALID_RECIPE_INPUT');
  assert(result.errors.includes('Please combine duplicate ingredients.'));
});



test('new suggestions are accepted with their canonical names and diet rules', /** The shared list covers both UI languages. */ () => {
  for (const name of ['Salat', 'Lettuce', 'Iceberg lettuce', 'Rucola', 'Paprika', 'Paprikapulver']) assert.equal(check([name]).valid, true, name);
  assert.equal(check(['Paprika']).request.ingredients[0].ingredient, 'Bell pepper');
  assert.equal(check(['Paprikapulver']).request.ingredients[0].ingredient, 'Paprika powder');
  assert.equal(check(['Salami'], 'no preferences').valid, true);
  assert.equal(check(['Salami'], 'vegan').valid, false); assert.equal(check(['Salami'], 'vegetarian').valid, false);
});
