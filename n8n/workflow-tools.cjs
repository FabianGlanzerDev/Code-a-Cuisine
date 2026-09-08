const fs = require('node:fs');
const path = require('node:path');

/**
 * Loads pure validation code without the CommonJS export used by offline tests.
 * @param names Library modules to include.
 */
function library(names) {
  return names.map(/** Maps the current item to its output value. @param name Current callback input. */ (name) => fs.readFileSync(path.join(__dirname, 'lib', name + '.cjs'), 'utf8')
    .replace(/module\.exports = [\s\S]*$/, '').trimEnd()).join('\n\n\n\n') + '\n\n\n\n';
}



/**
 * Creates a documented n8n node with a stable, non-credential identifier.
 * @param name Ingredient or node name.
 * @param type Input used by this operation.
 * @param parameters Node configuration parameters.
 * @param position Node position in the workflow editor.
 * @param notes Maintenance notes displayed in n8n.
 * @param version Supported n8n node version.
 */
function node(name, type, parameters, position, notes, version = 2) {
  return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name,
    type: 'n8n-nodes-base.' + type, typeVersion: version, position, parameters,
    notes, notesInFlow: true };
}



/**
 * Creates a boolean branch node.
 * @param name Ingredient or node name.
 * @param expression Boolean n8n expression.
 * @param position Node position in the workflow editor.
 */
function branch(name, expression, position) {
  const conditions = [{ leftValue: expression, rightValue: true,
    operator: { type: 'boolean', operation: 'true', singleValue: true } }];
  return node(name, 'if', { conditions: { options: { typeValidation: 'strict', version: 2 },
    conditions, combinator: 'and' }, options: {} }, position, 'Routes only a confirmed successful check.', 2.2);
}



/**
 * Creates a JSON webhook response with an explicit status code and no caching.
 * @param name Ingredient or node name.
 * @param body JSON response body.
 * @param code HTTP response status.
 * @param position Node position in the workflow editor.
 */
function response(name, body, code, position) {
  return node(name, 'respondToWebhook', { respondWith: 'json', responseBody: body,
    options: { responseCode: code, responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } },
    position, 'Returns a readable API result without exposing internal errors.', 1.4);
}



/**
 * Creates an authenticated Firebase conditional-read/write node without invented credentials.
 * @param name Ingredient or node name.
 * @param method HTTP request method.
 * @param position Node position in the workflow editor.
 */
function quotaHttp(name, method, position) {
  const parameters = { method, url: "={{ $('Backend Configuration').first().json.quotaUrl }}",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleFirebaseRealtimeDatabaseOAuth2Api',
    sendHeaders: true, headerParameters: { parameters: [{ name: 'X-Firebase-ETag', value: 'true' }] },
    options: { timeout: 15000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } } };
  if (method === 'PUT') Object.assign(parameters, { sendBody: true, specifyBody: 'json',
    jsonBody: '={{ $json.nextState }}', headerParameters: { parameters: [{ name: 'if-match', value: '={{ $json.etag }}' }] } });
  return { ...node(name, 'httpRequest', parameters, position,
    'Select the real Firebase OAuth2 credential in n8n. Never enable automatic retries of a reservation.', 4.2), onError: 'continueErrorOutput' };
}



/**
 * Connects each supplied output to one following main-input node.
 * @param workflow Workflow definition.
 * @param from Source node name.
 * @param targets Following node names.
 */
function connect(workflow, from, ...targets) {
  workflow.connections[from] = { main: targets.map(/** Maps the current item to its output value. @param target Current callback input. */ (target) => target ? [{ node: target, type: 'main', index: 0 }] : []) };
}



module.exports = { library, node, branch, response, quotaHttp, connect };
