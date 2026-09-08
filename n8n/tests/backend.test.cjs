const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIp, clientIp, parseAmount, validateRequest, reserveQuota, quotaStatus, quotaRead, validateRecipes, fixture, request } = require('./helpers.cjs');
const context = { dayKey: '2026-09-08', ipKey: '192_0_2_1' };

test('IPv4 and mapped IPv6 share a quota identity', /** Verifies: IPv4 and mapped IPv6 share a quota identity. */ () => {
  for (const ip of ['192.0.2.1', '::ffff:192.0.2.1', '0:0:0:0:0:ffff:c000:201']) {
    assert.equal(normalizeIp(ip), '192.0.2.1');
  }
});



test('compressed, uppercase and expanded IPv6 normalize identically', /** Verifies: compressed, uppercase and expanded IPv6 normalize identically. */ () => {
  assert.equal(normalizeIp('2001:DB8::1'), normalizeIp('2001:0db8:0:0:0:0:0:0001'));
  assert.ok(normalizeIp('::'));
  assert.ok(normalizeIp('2001:db8::192.0.2.1'));
});



test('invalid and ambiguous IP spellings are rejected', /** Verifies: invalid and ambiguous IP spellings are rejected. */ () => {
  for (const ip of ['1.2.3.256', '01.2.3.4', '1.2.3', ':::', '1:::2', ':1:2:3:4:5:6:7:8', '1:2:3:4:5:6:7:8:', '1::2::3', '[::1]', 'fe80::1%eth0', '::ffff:999.0.0.1']) {
    assert.equal(normalizeIp(ip), null, ip);
  }
});



test('missing trusted ingress and spoofable forwarding lists fail closed', /** Verifies: missing trusted ingress and spoofable forwarding lists fail closed. */ () => {
  assert.equal(clientIp({ 'x-forwarded-for': '192.0.2.1' }, 'x-forwarded-for'), null);
  assert.equal(clientIp({ 'x-real-ip': '192.0.2.1, 192.0.2.2' }, 'x-real-ip'), null);
  assert.equal(clientIp({ 'x-real-ip': '192.0.2.1' }, ''), null);
  assert.equal(clientIp({ 'X-Real-IP': '192.0.2.1' }, 'x-real-ip'), '192.0.2.1');
});



test('amount validation rejects zero, negatives, non-numbers and unsupported units', /** Verifies: amount validation rejects zero, negatives, non-numbers and unsupported units. */ () => {
  for (const value of ['0g', '-1ml', 'NaN', 'Infinity', '1e2g', '10001g', 'some', '10kg', 10, '']) assert.equal(parseAmount(value), null);
  for (const value of ['0.5g', '0,5ml', '2', '3 pieces', '10000g']) assert.ok(parseAmount(value));
});



test('backend validates amounts, duplicates, preferences and incompatible diets before reservation', /** Verifies: backend validates amounts, duplicates, preferences and incompatible diets before reservation. */ () => {
  const item = { body: request(), headers: { 'x-real-ip': '192.0.2.1' } };
  const config = { trustedIpHeader: 'x-real-ip', modelName: 'models/gemini-test-fixture' };
  assert.equal(validateRequest(item, config).valid, true);
  item.body.ingredients[0].servingSize = '0g';
  assert.equal(validateRequest(item, config).valid, false);
  item.body = request(); item.body.ingredients.push({ ...item.body.ingredients[0] });
  assert.equal(validateRequest(item, config).valid, false);
  item.body = request(); item.body.ingredients[0].ingredient = 'Chicken';
  assert.equal(validateRequest(item, config).valid, false);
});



test('one request reserves all three IP recipe slots and the throttle together', /** Verifies: one request reserves all three IP recipe slots and the throttle together. */ () => {
  const result = reserveQuota(null, context, 100000);
  assert.equal(result.allowed, true);
  assert.equal(result.quota.ipUsed, 3);
  assert.equal(result.quota.systemUsed, 3);
  assert.equal(reserveQuota(result.nextState, context, 100001).allowed, false);
  assert.equal(reserveQuota(result.nextState, context, 200000).allowed, false);
});



test('only four IPs can reserve a batch per UTC day', /** Verifies: only four IPs can reserve a batch per UTC day. */ () => {
  let state = null;
  for (let index = 0; index < 4; index++) {
    const result = reserveQuota(state, { ...context, ipKey: 'ip_' + index }, 100000);
    assert.equal(result.allowed, true); state = result.nextState;
  }
  assert.equal(quotaStatus(state, context).systemUsed, 12);
  assert.equal(reserveQuota(state, context, 200000).allowed, false);
});



test('UTC rollover resets daily counters but preserves the ten-second rate limit', /** Verifies: UTC rollover resets daily counters but preserves the ten-second rate limit. */ () => {
  const state = reserveQuota(null, context, 100000).nextState;
  const tomorrow = { ...context, dayKey: '2026-09-09' };
  assert.equal(reserveQuota(state, tomorrow, 100001).allowed, false);
  assert.equal(reserveQuota(state, tomorrow, 110000).allowed, true);
  assert.equal(state.days[context.dayKey].used, 3);
});



test('failed or corrupted quota reads cannot enable the model', /** Verifies: failed or corrupted quota reads cannot enable the model. */ () => {
  assert.throws(/** Handles the current value in the enclosing operation. */ () => quotaRead({ statusCode: 403, headers: {}, body: null }));
  assert.throws(/** Handles the current value in the enclosing operation. */ () => quotaRead({ statusCode: 200, headers: {}, body: null }));
  assert.throws(/** Handles the current value in the enclosing operation. */ () => quotaRead({ statusCode: 200, headers: { etag: '1' }, body: {} }));
  assert.throws(/** Handles the current value in the enclosing operation. */ () => reserveQuota({ days: { [context.dayKey]: { used: -1 } } }, context));
});



test('concurrent conditional commits permit only one winner per ETag', /** Verifies: concurrent conditional commits permit only one winner per ETag. */ async () => {
  let state = null; let etag = 0;
  const contenders = Array.from({ length: 20 }, /** Creates one entry for the resulting array. @param _ Current callback input. @param index Current callback input. */ (_, index) => ({ etag, result: reserveQuota(state, { ...context, ipKey: 'ip_' + index }, 100000) }));
  const outcomes = await Promise.all(contenders.map(/** Maps the current item to its output value. @param candidate Current callback input. */ async (candidate) => {
    await Promise.resolve();
    if (candidate.etag !== etag) return 412;
    state = candidate.result.nextState; etag++; return 200;
  }));
  assert.equal(outcomes.filter(/** Checks whether the current item matches the filter. @param code Current callback input. */ (code) => code === 200).length, 1);
  assert.equal(quotaStatus(state, context).systemUsed, 3);
});



test('three complete recipes pass offline validation', /** Verifies: three complete recipes pass offline validation. */ () => {
  assert.equal(validateRecipes(JSON.stringify(fixture()), request()).length, 3);
});



test('incorrect portions, negative quantities, invented own ingredients and excess extras fail', /** Verifies: incorrect portions, negative quantities, invented own ingredients and excess extras fail. */ () => {
  const mutations = [
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.portionsAmount = 3,
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.ingredients.yourIngredients[0].servingSize = '-100g',
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.ingredients.yourIngredients[0].perPortionServingSize = '100g',
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.ingredients.yourIngredients[0].ingredient = 'Chicken',
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.ingredients.extraIngredients = Array(4).fill({ ingredient: 'salt', servingSize: '1g' }),
  ];
  for (const mutate of mutations) { const recipes = fixture(); mutate(recipes[0]); assert.throws(/** Handles the current value in the enclosing operation. */ () => validateRecipes(JSON.stringify(recipes), request())); }
});



test('nutrition scaling, keto macros and vegan dairy exclusions are enforced', /** Verifies: nutrition scaling, keto macros and vegan dairy exclusions are enforced. */ () => {
  const recipes = fixture(); recipes[0].nutritionalInformation.total.calories = '999 kcal';
  assert.throws(/** Handles the current value in the enclosing operation. */ () => validateRecipes(JSON.stringify(recipes), request()));
  const keto = fixture(); keto.forEach(/** Processes the current item in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.preferences.dietPreferences = 'keto');
  assert.throws(/** Handles the current value in the enclosing operation. */ () => validateRecipes(JSON.stringify(keto), { ...request(), dietPreferences: 'keto' }));
  const dairy = fixture(); dairy[0].ingredients.extraIngredients.push({ ingredient: 'butter', servingSize: '2g', perPortionServingSize: '1g' });
  assert.throws(/** Handles the current value in the enclosing operation. */ () => validateRecipes(JSON.stringify(dairy), request()));
});



test('positive calories without macro energy are rejected', /** Verifies that zero macro energy cannot bypass percentage checks. */ () => {
  const recipes = fixture();
  const portion = recipes[0].nutritionalInformation.perPortion;
  Object.assign(portion, { calories: '5 kcal', proteins: '0g', fats: '0g', carbs: '0g' });
  assert.throws(/** Checks the invalid nutrition response. */ () => validateRecipes(JSON.stringify(recipes), request()));
});



test('unordered steps, invalid cooks and impossible dependencies are rejected', /** Verifies: unordered steps, invalid cooks and impossible dependencies are rejected. */ () => {
  const mutations = [
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.directions.reverse(),
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.directions[0].cook = 1.5,
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.directions[0].cook = null,
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.directions[2].startMinute = 1,
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.directions[0].dependsOn = [3],
    /** Handles the current value in the enclosing operation. @param recipe Current callback input. */ (recipe) => recipe.directions[0].parallel = false,
  ];
  for (const mutate of mutations) { const recipes = fixture(); mutate(recipes[0]); assert.throws(/** Handles the current value in the enclosing operation. */ () => validateRecipes(JSON.stringify(recipes), request())); }
});
