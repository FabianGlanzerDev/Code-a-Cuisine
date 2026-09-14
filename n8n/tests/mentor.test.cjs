const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, request, reserveQuota, fixture, validateRecipes } = require('./helpers.cjs');

test('direct webhook validation accepts names outside the optional suggestion catalog', /** Verifies free-text acceptance. */ () => {
  for (const ingredient of ['Salatblatt', 'Purple sprouting broccoli', 'Fresh garden sorrel']) {
    const body = request();
    body.ingredients[0].ingredient = ingredient;
    const result = validateRequest({ body, headers: { 'x-real-ip': '192.0.2.1' } },
      { trustedIpHeader: 'x-real-ip', modelName: 'models/gemini-test' });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  }
});

test('English and German catalog entries remain usable', /** Verifies both supported languages. */ () => {
  for (const ingredient of ['Carrot', 'Karotte', 'Kichererbsen', 'Baby spinach']) {
    const body = request();
    body.ingredients[0].ingredient = ingredient;
    assert.equal(validateRequest({ body, headers: { 'x-real-ip': '192.0.2.1' } },
      { trustedIpHeader: 'x-real-ip', modelName: 'models/gemini-test' }).valid, true);
  }
});

test('global and personal exhaustion have distinct messages without modifying state', /** Verifies quota error identity. */ () => {
  const context = { dayKey: '2026-09-09', ipKey: 'test' };
  const state = { days: { '2026-09-09': { used: 12, ips: {} } }, lastRequests: {} };
  assert.match(reserveQuota(state, context).detail, /Global/);
  assert.deepEqual(state.days[context.dayKey].ips, {});
  state.days[context.dayKey] = { used: 3, ips: { test: 3 } };
  assert.match(reserveQuota(state, context).detail, /Your IP/);
});



test('valid schedules support one, two and three cooks', /** Verifies every supported team size. */ () => {
  for (const cooks of [1, 2, 3]) {
    const body = request(); body.cooksAmount = cooks;
    const recipes = fixture();
    for (const recipe of recipes) {
      recipe.cooksAmount = cooks;
      if (cooks === 3) recipe.directions[2].cook = 3;
      if (cooks === 1) recipe.directions.forEach(/** Schedules one cook without overlap. @param step Cooking step. @param index Step index. */ (step, index) => {
        step.cook = 1; step.parallel = false; step.startMinute = index * 2; step.durationMinutes = 2;
      });
    }
    assert.equal(validateRecipes(JSON.stringify(recipes), body).length, 3);
  }
});
