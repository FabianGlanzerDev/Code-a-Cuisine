const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, request } = require('./helpers.cjs');
const workflow = require('../exports/generate-recipe-input-popup.json');
const config = { trustedIpHeader: 'x-real-ip', modelName: 'models/gemini-test' };

/** Applies the real backend validator with an example non-production IP. @param body Input. @param settings Backend settings. */
function check(body, settings = config) {
  return validateRequest({ body, headers: { 'x-real-ip': '192.0.2.1' } }, settings);
}



/** Proves rejected input reaches a terminal response without reaching quota or model nodes. */
function rejectsBeforeQuota() {
  for (const ingredients of [[], [{ ingredient: 'Carrot', servingSize: '0g' }], [{ ingredient: 'Carrot', servingSize: '1bucket' }]]) {
    const result = check({ ...request(), ingredients });
    assert.equal(result.valid, false); assert.equal(result.code, 'INVALID_RECIPE_INPUT');
    const target = workflow.connections['Request Valid?'].main[1][0].node;
    assert.equal(target, 'Return Validation Error'); assert.equal(workflow.connections[target], undefined);
    const node = workflow.nodes.find(/** Finds the terminal response. @param n Node. */ n => n.name === target);
    const body = JSON.parse(new Function('$json', 'return ' + node.parameters.responseBody.slice(3, -2))(result));
    assert.equal(body.code, 'INVALID_RECIPE_INPUT'); assert.equal(body.quota, null);
  }
}



/** Keeps configuration faults separate even when user input is also invalid. */
function rejectsConfiguration() {
  assert.equal(check(request(), { ...config, modelName: '' }).code, 'BACKEND_CONFIGURATION_ERROR');
  assert.equal(check({ ...request(), ingredients: [] }, { ...config, trustedIpHeader: '' }).code, 'BACKEND_CONFIGURATION_ERROR');
}



/** Never invents meal-size thresholds or converts pieces into grams. */
function acceptsPositiveUnits() {
  for (const servingSize of ['0.5g', '1ml', '1']) {
    const result = check({ ...request(), portionsAmount: 12, ingredients: [{ ingredient: 'Carrot', servingSize }] });
    assert.equal(result.valid, true); assert.equal(result.code, null);
  }
}



test('input errors terminate before any quota reservation or model call', rejectsBeforeQuota);
test('configuration faults are never classified as invalid input', rejectsConfiguration);
test('positive supported units have no invented portion minimum', acceptsPositiveUnits);
