const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quantityGate } = require('../lib/quantity.cjs');
const workflow = require('../exports/generate-recipe-input-popup.json');
const request = require('./fixtures/execution-136/validated-request.json').request;

test('no approved quantity policy: original #136 and arbitrary units remain unassessed', /** Checks no invented sufficient-portion claim. */ () => {
  for (const servingSize of ['1g', '100ml', '2']) {
    const context = { request: { ...request, ingredients: [{ ingredient: 'Carrot', servingSize }] } };
    const result = quantityGate(context);
    assert.equal(result.quantityAssessment, 'not_assessed'); assert.equal(result.quantityRejected, false);
    assert.deepEqual(result.request, context.request);
  }
  assert.equal(quantityGate({ request }).quantityAssessment, 'not_assessed');
});

test('only trusted approved policy decisions can reject; request-supplied flags cannot', /** Tests routing with synthetic decisions, not a real nutrition rule. */ () => {
  const context = { request: { ...request, quantityRejected: true, approved: true } };
  assert.equal(quantityGate(context).quantityRejected, false);
  for (const assessment of ['sufficient', 'insufficient', 'not_assessed']) {
    const policy = { id: 'TEST-ONLY', approved: true, assess: /** Supplies a simulated decision, without invented amounts. */ () => assessment };
    assert.equal(quantityGate(context, policy).quantityRejected, assessment === 'insufficient');
  }
  assert.equal(quantityGate(context, { approved: false }).quantityRejected, false);
});

test('quantity rejection ends before quota reads, writes or model execution', /** Walks the actual exported rejection route, without HTTP. */ () => {
  const validTarget = workflow.connections['Request Valid?'].main[0][0].node;
  assert.equal(validTarget, 'Assess Ingredient Quantities');
  const decision = quantityGate({ request }, { id: 'TEST-ONLY', approved: true, assess: /** Simulates confirmed shortage. */ () => 'insufficient' });
  const next = workflow.connections['Quantity Rejected?'].main[decision.quantityRejected ? 0 : 1][0].node;
  assert.equal(next, 'Return Quantity Error'); assert.equal(workflow.connections[next], undefined);
  const node = workflow.nodes.find(/** Finds the actual response node. */ n => n.name === next);
  assert.equal(node.parameters.options.responseCode, 422);
  const body = new Function('$json', 'return ' + node.parameters.responseBody.slice(3, -2))(decision);
  assert.equal(JSON.parse(body).code, 'INSUFFICIENT_INGREDIENT_QUANTITIES');
  assert.equal(JSON.parse(body).portionsAmount, request.portionsAmount);
});

test('policy defects are technical failures and never reach the quantity popup branch', /** Tests fail-closed internal policy integration. */ () => {
  assert.throws(/** Simulates a malformed policy result. */ () => quantityGate({ request }, { id: 'TEST-ONLY', approved: true, assess: /** Returns unsupported data. */ () => 'unknown' }), /Invalid quantity/);
  assert.equal(workflow.connections['Assess Ingredient Quantities'].main[1][0].node, 'Return Backend Error');
});
