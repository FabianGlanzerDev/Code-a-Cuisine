const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fixture, request } = require('./helpers.cjs');
const files = ['generate-recipe.workflow.json', 'quota-status.workflow.json', 'error-handler.workflow.json'];
const workflows = files.map(/** Maps the current item to its output value. @param file Current callback input. */ (file) => JSON.parse(fs.readFileSync('n8n/' + file, 'utf8')));

/** Executes an exported Code node with deterministic n8n input stubs. */
function runCode(name, input, history = {}) {
  const node = workflows[0].nodes.find(/** Checks whether the current item is the requested match. @param node Current callback input. */ (node) => node.name === name);
  const lookup = /** Handles the current value in the enclosing operation. @param key Current callback input. */ (key) => ({ first: /** Handles the current value in the enclosing operation. */ () => ({ json: history[key] }) });
  return new Function('$input', '$', '$execution', node.parameters.jsCode)({ first: /** Handles the current value in the enclosing operation. */ () => ({ json: input }) }, lookup, { id: 'offline-test' })[0].json;
}



test('all exported connections resolve to documented nodes and contain no credentials', /** Verifies: all exported connections resolve to documented nodes and contain no credentials. */ () => {
  for (const workflow of workflows) {
    const names = new Set(workflow.nodes.map(/** Maps the current item to its output value. @param node Current callback input. */ (node) => node.name));
    assert.equal(names.size, workflow.nodes.length);
    for (const node of workflow.nodes) { assert.ok(node.notes); assert.equal(node.credentials, undefined); }
    for (const [name, connections] of Object.entries(workflow.connections)) {
      assert.ok(names.has(name));
      for (const outputs of Object.values(connections)) for (const output of outputs) for (const edge of output) assert.ok(names.has(edge.node));
    }
  }
});



test('exported validation rejects an unconfigured ingress before quota or model requests', /** Verifies: exported validation rejects an unconfigured ingress before quota or model requests. */ () => {
  const output = runCode('Validate Request', { trustedIpHeader: '', modelName: '' },
    { 'Recipe Request': { body: request(), headers: { 'x-real-ip': '192.0.2.1' } } });
  assert.equal(output.valid, false);
});



test('exported model request contains one bounded response and separates user data', /** Verifies: exported model request contains one bounded response and separates user data. */ () => {
  const output = runCode('Build Model Request', {}, { 'Validate Request': { request: request() } });
  assert.equal(output.generationConfig.candidateCount, 1);
  assert.equal(output.generationConfig.maxOutputTokens, 8192);
  assert.deepEqual(JSON.parse(output.contents[0].parts[0].text), request());
  const node = workflows[0].nodes.find(/** Checks whether the current item is the requested match. @param node Current callback input. */ (node) => node.name === 'Create Three Recipes');
  assert.equal(node.type, 'n8n-nodes-base.httpRequest');
  assert.equal(node.retryOnFail, false);
});



test('exported response validation accepts complete Gemini JSON and rejects truncation', /** Verifies: exported response validation accepts complete Gemini JSON and rejects truncation. */ () => {
  const history = { 'Prepare Reservation': { request: request(), quota: { ipRemaining: 0 } } };
  const candidate = { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(fixture()) }] } };
  assert.equal(runCode('Validate Recipe Output', { candidates: [candidate] }, history).valid, true);
  candidate.finishReason = 'MAX_TOKENS';
  assert.equal(runCode('Validate Recipe Output', { candidates: [candidate] }, history).valid, false);
});



test('conditional quota writes always require an ETag and handled failures reach the logger', /** Verifies: conditional quota writes always require an ETag and handled failures reach the logger. */ () => {
  const workflow = workflows[0];
  const write = workflow.nodes.find(/** Checks whether the current item is the requested match. @param node Current callback input. */ (node) => node.name === 'Commit Reservation');
  assert.equal(write.parameters.headerParameters.parameters[0].name, 'if-match');
  assert.equal(workflow.connections['Return Backend Error'].main[0][0].node, 'Log Technical Failure');
  assert.equal(workflow.connections['Return Recipe Validation Error'].main[0][0].node, 'Log Technical Failure');
  assert.equal(workflows[2].nodes.find(/** Checks whether the current item is the requested match. @param node Current callback input. */ (node) => node.name === 'Send Error Email').disabled, true);
});



test('backend persists three recipes before responding, with stable retry keys', /** Verifies: backend persists three recipes before responding, with stable retry keys. */ () => {
  const data = { recipes: fixture(), quota: {} };
  const first = runCode('Prepare Recipe Storage', data);
  assert.deepEqual(runCode('Prepare Recipe Storage', data).updates, first.updates);
  assert.equal(new Set(Object.keys(first.updates).map(/** Maps the current item to its output value. @param key Current callback input. */ (key) => key.split('/')[0])).size, 3);
  assert.ok(!Object.keys(first.updates).some(/** Checks whether this item meets the condition. @param key Current callback input. */ (key) => key.endsWith('/likes')));
  assert.equal(workflows[0].connections['Recipe Output Valid?'].main[0][0].node, 'Prepare Recipe Storage');
  assert.equal(workflows[0].connections['Store Recipes Atomically'].main[0][0].node, 'Return Recipes and Quota');
  const storage = workflows[0].nodes.find(/** Finds the storage request. @param node Workflow node. */ (node) => node.name === 'Store Recipes Atomically');
  assert.equal(storage.retryOnFail, true);
  assert.equal(storage.maxTries, 3);
  assert.equal(workflows[0].settings.saveDataErrorExecution, 'all');
});



test('confirmed model configuration still fails closed without a trusted IP header', /** Checks deployment defaults without invoking Gemini. */ () => {
  const config = runCode('Backend Configuration', {});
  assert.equal(config.modelName, 'models/gemini-3.6-flash');
  assert.equal(config.trustedIpHeader, '');
  assert.equal(runCode('Validate Request', config, { 'Recipe Request': { body: request(), headers: { 'cf-connecting-ip': '192.0.2.1', 'x-real-ip': '192.0.2.1' } } }).valid, false);
});
