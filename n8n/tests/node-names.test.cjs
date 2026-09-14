const { test } = require('node:test');
const assert = require('node:assert/strict');
const names = require('../node-name-mapping.json');
const workflows = [require('../exports/generate-recipe-input-popup.json'), require('../quota-status.workflow.json'), require('../error-handler.workflow.json'), require('../exports/quota-status-reviewed.json'), require('../exports/error-logger-reviewed.json')];

/** Checks graph and expression targets after renaming without executing external nodes. */
function validReferences() {
  for (const workflow of workflows) {
    const available = new Set(workflow.nodes.map(/** Reads node identity. @param node Workflow node. */ node => node.name));
    for (const [source, outputs] of Object.entries(workflow.connections)) {
      assert(available.has(source));
      for (const target of Object.values(outputs).flat(2)) assert(available.has(target.node));
    }
    for (const node of workflow.nodes) {
      assert(!Object.hasOwn(names, node.name));
      for (const match of JSON.stringify(node.parameters).matchAll(/\$\('([^']+)'\)/g)) assert(available.has(match[1]), match[1]);
    }
  }
}



/** Preserves all original owner node IDs and credential references. */
function stableOwnerIdentity() {
  const previous = require('./fixtures/generate-owner-identity.json');
  const current = workflows[0];
  assert.equal(current.id, previous.id);
  for (const node of previous.nodes) {
    const renamed = current.nodes.find(/** Finds the unchanged technical identity. @param item Node. */ item => item.id === node.id);
    assert(renamed); assert.equal(renamed.name, names[node.name] ?? node.name);
    assert.deepEqual(renamed.credentials, node.credentials);
    if (node.type === 'n8n-nodes-base.webhook') assert.deepEqual(renamed.parameters, node.parameters);
  }
}



test('all three renamed workflow graphs and expression targets resolve', validReferences);
test('owner workflow IDs, credentials and webhook parameters remain unchanged', stableOwnerIdentity);



/** Compares owner configuration to the supplied export after reversing display-name changes.
 * @param workflow Updated owner workflow.
 * @param logger Whether its unsafe message code was deliberately replaced.
 */
function originalDigest(workflow, logger = false) {
  const copy = structuredClone(workflow);
  if (logger) copy.nodes.find(/** Selects the logger code. @param node Node. */ node => node.type === 'n8n-nodes-base.code').parameters.jsCode = '[sanitized logger code]';
  let serialized = JSON.stringify(copy);
  for (const [old, next] of Object.entries(names)) serialized = serialized.replaceAll(next, old);
  return require('node:crypto').createHash('sha256').update(serialized).digest('hex');
}



/** Protects every owner setting, graph, node ID, credential reference and webhook path. */
function ownerConfiguration() {
  assert.equal(originalDigest(workflows[3]), '626d3463324001648c73b3e6506f1c9f85845109ce0901a5024e80d67be0d563');
  assert.equal(originalDigest(workflows[4], true), '4747ad9c18866ab13b789a034f055710413f9f458078f66127a8a9253bfe5a31');
  assert.equal(workflows[3].settings.errorWorkflow, workflows[4].id);
}



/** Ensures raw errors, headers and request bodies cannot reach the table or mail payload. */
function safeLogger() {
  const node = workflows[4].nodes.find(/** Locates the sanitizing node. @param item Node. */ item => item.type === 'n8n-nodes-base.code');
  const hostile = { workflow: { name: 'Test' }, execution: { id: 136, error: { message: 'Bearer secret-token request-body' } }, headers: { authorization: 'secret-token' } };
  const output = new Function('$input', node.parameters.jsCode)({ first: /** Supplies an isolated event. */ () => ({ json: hostile }) });
  assert(!JSON.stringify(output).includes('secret-token'));
  assert(!JSON.stringify(output).includes('request-body'));
  assert.equal(output[0].json.execution, '136');
  assert.deepEqual(Object.keys(output[0].json), ['logKey', 'timestamp', 'workflow', 'execution', 'message']);
}



test('supplied owner exports retain every configuration value outside documented changes', ownerConfiguration);
test('owner logger does not forward raw exception messages or request details', safeLogger);

