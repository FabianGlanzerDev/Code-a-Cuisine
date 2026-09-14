const fs = require('node:fs');
const path = require('node:path');
const { library, node, branch, response, quotaHttp, connect } = require('./workflow-tools.cjs');
const { PANTRY_BASICS } = require('./lib/recipes.cjs');
const renamedNodes = require('./node-name-mapping.json');
const checkOnly = process.argv.includes('--check');
const configCode = "return [{ json: { trustedIpHeader: '', modelName: 'models/gemini-3.6-flash', quotaUrl: 'https://code-a-cuisine-edd75-default-rtdb.europe-west1.firebasedatabase.app/privateQuota/v2/state.json', recipesUrl: 'https://code-a-cuisine-edd75-default-rtdb.europe-west1.firebasedatabase.app/recipes.json' } }];";
const failureBody = "={{ JSON.stringify({ detail: 'The backend could not finish this request. Recipe slots may remain reserved for today to prevent repeated charges.', quota: null }) }}";

/**
 * Creates shared webhook, validation, quota-read and technical-error branches.
 * @param statusOnly Whether only the quota endpoint is being validated.
 */
function commonWorkflow(statusOnly) {
  const workflow = { name: 'Code a Cuisine - ' + (statusOnly ? 'Quota Status' : 'Generate Recipe'), nodes: [], connections: {},
    settings: { executionOrder: 'v1', errorWorkflow: 'SET_ERROR_WORKFLOW_ID', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all' }, active: false };
  addEntryNodes(workflow, statusOnly);
  addErrorNodes(workflow);
  connect(workflow, 'Recipe Request', 'Backend Configuration');
  connect(workflow, 'Backend Configuration', 'Validate Request');
  connect(workflow, 'Validate Request', 'Request Valid?');
  connect(workflow, 'Request Valid?', 'Read Daily Recipe Slots', 'Return Validation Error');
  if (!statusOnly) addQuantityGate(workflow);
  connect(workflow, 'Read Daily Recipe Slots', statusOnly ? 'Calculate Remaining Recipe Slots' : 'Prepare Three-Slot Reservation', 'Return Backend Error');
  return workflow;
}



/** Adds a dormant, backend-only quantity branch before any quota read or reservation. @param workflow Workflow being built. */
function addQuantityGate(workflow) {
  workflow.nodes.push({ ...node('Assess Ingredient Quantities', 'code', { jsCode: library(['quantity']) + "return [{ json: quantityGate($input.first().json) }];" }, [700, -320], 'No approved portion policy configured: not_assessed. Never accepts policy decisions from request or model.'), onError: 'continueErrorOutput' },
    branch('Quantity Rejected?', '={{ $json.quantityRejected }}', [900, -320]),
    response('Return Quantity Error', "={{ JSON.stringify({ code: 'INSUFFICIENT_INGREDIENT_QUANTITIES', portionsAmount: $json.request.portionsAmount, detail: 'Ingredient quantities are insufficient for the selected servings.', quota: null }) }}", 422, [1100, -480]));
  connect(workflow, 'Request Valid?', 'Assess Ingredient Quantities', 'Return Validation Error');
  connect(workflow, 'Assess Ingredient Quantities', 'Quantity Rejected?', 'Return Backend Error');
  connect(workflow, 'Quantity Rejected?', 'Return Quantity Error', 'Read Daily Recipe Slots');
}



/**
 * Adds documented entry nodes while keeping the proxy header intentionally unconfigured.
 * @param workflow Workflow definition.
 * @param statusOnly Whether only the quota endpoint is being validated.
 */
function addEntryNodes(workflow, statusOnly) {
  const validation = library(['ip', 'ingredients', 'request'])
    + `return [{ json: validateRequest($('Recipe Request').first().json, $input.first().json, Date.now(), ${statusOnly}) }];`;
  workflow.nodes.push(node('Recipe Request', 'webhook', { httpMethod: statusOnly ? 'GET' : 'POST', path: statusOnly ? 'quota-status' : 'generate-recipe', responseMode: 'responseNode', options: {} }, [0, 0], 'Receives requests through the trusted ingress proxy.', 2.1),
    node('Backend Configuration', 'code', { jsCode: configCode }, [220, 0], 'Set trustedIpHeader only after proving the ingress overwrites that header. Empty means fail closed.'),
    node('Validate Request', 'code', { jsCode: validation }, [440, 0], 'Checks positive quantities, choices and a canonical IP before any AI cost.'),
    branch('Request Valid?', '={{ $json.valid }}', [660, 0]),
    response('Return Validation Error', "={{ JSON.stringify({ code: $json.code, detail: $json.errors.join(' '), quota: null }) }}", 400, [880, 240]),
    quotaHttp('Read Daily Recipe Slots', 'GET', [880, 0]));
}



/**
 * Adds a sanitized error response followed by a failed execution for the error logger.
 * @param workflow Workflow definition.
 */
function addErrorNodes(workflow) {
  workflow.nodes.push(response('Return Backend Error', failureBody, 503, [1100, 600]),
    node('Log Technical Failure', 'stopAndError', { errorMessage: 'Code a Cuisine backend failure. Inspect the failing node; do not log credentials or request bodies.' }, [1320, 600],
      'Marks handled infrastructure/model failures as failed so the configured Error Workflow runs.', 1));
  connect(workflow, 'Return Backend Error', 'Log Technical Failure');
}



/**
 * Adds a reservation that atomically reserves three recipes and the rate timestamp.
 * @param workflow Workflow definition.
 */
function addReservation(workflow) {
  const code = library(['quota']) + "const context = $('Validate Request').first().json;\nconst result = $input.first().json;\nconst state = quotaRead(result);\nreturn [{ json: { ...context, ...reserveQuota(state, context), etag: result.headers.etag } }];";
  workflow.nodes.push({ ...node('Prepare Three-Slot Reservation', 'code', { jsCode: code }, [1100, 0], 'Reserves 3 recipe slots per request: IP 3/day, system 12/day; rate window 10 seconds.'), onError: 'continueErrorOutput' },
    branch('Enough Daily Recipe Slots?', '={{ $json.allowed }}', [1320, 0]), quotaHttp('Reserve Three Recipe Slots', 'PUT', [1540, 0]),
    branch('Recipe Slots Reserved?', '={{ $json.statusCode === 200 }}', [1760, 0]),
    branch('Reservation Write Conflict?', '={{ $json.statusCode === 412 }}', [1760, 240]),
    response('Return Quota Error', '={{ JSON.stringify({ detail: $json.detail, quota: $json.quota }) }}', 429, [1540, 360]),
    response('Return Concurrent Request', '={{ JSON.stringify({ detail: "Another request changed the quota. Please wait 10 seconds and try again. No generation was started.", quota: null }) }}', 429, [1980, 360]));
  connect(workflow, 'Prepare Three-Slot Reservation', 'Enough Daily Recipe Slots?', 'Return Backend Error');
  connect(workflow, 'Enough Daily Recipe Slots?', 'Reserve Three Recipe Slots', 'Return Quota Error');
  connect(workflow, 'Reserve Three Recipe Slots', 'Recipe Slots Reserved?', 'Return Backend Error');
  connect(workflow, 'Recipe Slots Reserved?', 'Build Model Request', 'Reservation Write Conflict?');
  connect(workflow, 'Reservation Write Conflict?', 'Return Concurrent Request', 'Return Backend Error');
}



/**
 * Adds one direct Gemini HTTP request without hidden SDK retries or tool loops.
 * @param workflow Workflow definition.
 */
function addGeneration(workflow) {
  const prompt = fs.readFileSync(path.join(__dirname, 'prompts/recipes.txt'), 'utf8').slice(1).replace(/\{\{[^\n]+\}\}/, '').replace('{{PANTRY_BASICS}}', PANTRY_BASICS.join(', '));
  const code = `return [{ json: { systemInstruction: { parts: [{ text: ${JSON.stringify(prompt)} }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify($('Validate Request').first().json.request) }] }], generationConfig: { candidateCount: 1, responseMimeType: 'application/json', maxOutputTokens: 8192 } } }];`;
  workflow.nodes.push(node('Build Model Request', 'code', { jsCode: code }, [1980, -240], 'Separates fixed instructions from user input and caps one model response.'),
    { ...node('Create Three Recipes', 'httpRequest', modelParameters(), [1980, 0],
      'Select the real Google Gemini(PaLM) API credential. One direct request; automatic retries are disabled.', 4.2), onError: 'continueErrorOutput', retryOnFail: false });
  addOutputValidation(workflow);
  connect(workflow, 'Build Model Request', 'Create Three Recipes');
  workflow.nodes.push(response('Return Model Error', "={{ JSON.stringify({ code: 'MODEL_UNAVAILABLE', detail: 'The model request failed. Reserved recipe slots remain used today to bound costs. No automatic retry was made.', quota: $('Prepare Three-Slot Reservation').first().json.quota }) }}", 502, [2200, 480]));
  connect(workflow, 'Create Three Recipes', 'Validate Recipe Output', 'Return Model Error');
  connect(workflow, 'Return Model Error', 'Log Technical Failure');
}



/**
 * Returns direct Gemini request parameters using only n8n-managed authentication.
 */
function modelParameters() {
  return { method: 'POST', url: "={{ 'https://generativelanguage.googleapis.com/v1beta/' + $('Backend Configuration').first().json.modelName + ':generateContent' }}",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi', sendBody: true,
    specifyBody: 'json', jsonBody: '={{ $json }}', options: { timeout: 120000 } };
}



/**
 * Adds strict recipe checks and logs rejected model output without leaking the raw response.
 * @param workflow Workflow definition.
 */
function addOutputValidation(workflow) {
  const code = library(['ingredients', 'nutrition', 'directions', 'recipes'])
    + "const context = $('Prepare Three-Slot Reservation').first().json;\ntry {\n  const candidate = $input.first().json.candidates?.[0];\n  if (candidate?.finishReason !== 'STOP') throw new Error('Incomplete model response.');\n  const raw = candidate.content.parts.filter(/** Checks whether the current item matches the filter. @param part Current callback input. */ (part) => !part.thought).map(/** Maps the current item to its output value. @param part Current callback input. */ (part) => part.text || '').join('');\n  const recipes = validateRecipes(raw, context.request);\n  return [{ json: { recipes, quota: context.quota, valid: true } }];\n} catch (error) {\n  return [{ json: { code: 'MODEL_OUTPUT_INVALID', validationFailure: error instanceof SyntaxError ? 'INVALID_JSON' : 'SCHEMA_REJECTED', validationIssue: safeValidationIssue(error), detail: 'Generated recipes failed validation. The three reserved recipe slots remain used today to prevent repeated charges.', quota: context.quota, valid: false } }];\n}";
  workflow.nodes.push(node('Validate Recipe Output', 'code', { jsCode: code }, [2200, 0], 'Checks diet exclusions, ingredient scaling, nutrition and chronological dependencies.'),
    branch('Recipe Output Valid?', '={{ $json.valid }}', [2420, 0]),
    response('Return Recipes and Quota', "={{ JSON.stringify({ recipes: $('Prepare Recipe Storage').first().json.recipes, quota: $('Prepare Recipe Storage').first().json.quota, persisted: true }) }}", 200, [3300, 0]),
    response('Return Recipe Validation Error', '={{ JSON.stringify({ code: $json.code, detail: $json.detail, quota: $json.quota }) }}', 502, [2640, 240]));
  connect(workflow, 'Validate Recipe Output', 'Recipe Output Valid?');
  connect(workflow, 'Recipe Output Valid?', 'Prepare Recipe Storage', 'Return Recipe Validation Error');
  connect(workflow, 'Return Recipe Validation Error', 'Log Technical Failure');
}



/**
 * Persists validated recipes before returning so browser disconnects do not lose them.
 * @param workflow Generation workflow to extend.
 */
function addPersistence(workflow) {
  const code = "const data = $input.first().json;\nconst recipes = data.recipes.map(/** Maps the current item to its output value. @param recipe Current callback input. @param index Current callback input. */ (recipe, index) => ({ ...recipe, id: `generated-${$execution.id}-${index}`, cuisine: recipe.preferences.cuisine, likes: 0 }));\nconst updates = Object.fromEntries(recipes.flatMap(/** Maps and flattens the current item. @param { id, likes, ...recipe } Current callback input. */ ({ id, likes, ...recipe }) => Object.entries(recipe).map(/** Maps the current item to its output value. @param [key, value] Current callback input. */ ([key, value]) => [`${id}/${key}`, value])));\nreturn [{ json: { recipes, updates, quota: data.quota } }];";
  workflow.nodes.push(node('Prepare Recipe Storage', 'code', { jsCode: code }, [2640, 0], 'Assigns stable execution-based IDs and one atomic multipath update.'),
    { ...node('Store Recipes Atomically', 'httpRequest', { method: 'PATCH', url: "={{ $('Backend Configuration').first().json.recipesUrl }}",
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleFirebaseRealtimeDatabaseOAuth2Api', sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.updates }}', options: { timeout: 15000 } },
      [2860, 0], 'Select the real Firebase credential. Saves all three recipes atomically; up to three storage-only attempts preserve IDs and likes.', 4.2), onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 },
    response('Return Unsaved Recipes', "={{ JSON.stringify({ recipes: $('Prepare Recipe Storage').first().json.recipes, quota: $('Prepare Recipe Storage').first().json.quota, persisted: false }) }}", 200, [3080, 240]));
  connect(workflow, 'Prepare Recipe Storage', 'Store Recipes Atomically');
  connect(workflow, 'Store Recipes Atomically', 'Return Recipes and Quota', 'Return Unsaved Recipes');
  connect(workflow, 'Return Unsaved Recipes', 'Log Technical Failure');
}



/**
 * Builds the read-only status workflow using the same quota state and IP normalization.
 */
function statusWorkflow() {
  const workflow = commonWorkflow(true);
  const code = library(['quota']) + "const context = $('Validate Request').first().json;\nreturn [{ json: quotaStatus(quotaRead($input.first().json), context) }];";
  workflow.nodes.push({ ...node('Calculate Remaining Recipe Slots', 'code', { jsCode: code }, [1100, 0], 'Reports remaining recipe slots from the same state used by reservations.'), onError: 'continueErrorOutput' },
    response('Return Quota Status', '={{ $json }}', 200, [1320, 0]));
  connect(workflow, 'Calculate Remaining Recipe Slots', 'Return Quota Status', 'Return Backend Error');
  return workflow;
}



/**
 * Writes deterministic exports, or fails when checked-in exports have drifted.
 * @param filename Source or export filename.
 * @param workflow Workflow definition.
 */
function writeWorkflow(filename, workflow) {
  const target = path.join(__dirname, filename);
  preserveDeployment(target, workflow);
  const content = JSON.stringify(workflow, null, 2) + '\n';
  if (checkOnly && fs.readFileSync(target, 'utf8') !== content) throw new Error('Stale workflow export: ' + filename);
  if (!checkOnly) fs.writeFileSync(target, content);
}



/** Preserves configured identity and credentials when regenerating an existing export.
 * @param target Existing export path.
 * @param workflow Generated workflow to update.
 */
function preserveDeployment(target, workflow) {
  if (!fs.existsSync(target)) return;
  const previous = JSON.parse(fs.readFileSync(target, 'utf8'));
  for (const key of ['id', 'active', 'versionId']) if (key in previous) workflow[key] = previous[key];
  if (previous.settings?.errorWorkflow && !previous.settings.errorWorkflow.startsWith('SET_')) workflow.settings.errorWorkflow = previous.settings.errorWorkflow;
  for (const next of workflow.nodes) {
    const old = previous.nodes.find(/** Matches a stable node name. @param node Existing node. */ node => node.name === next.name || renamedNodes[node.name] === next.name);
    if (!old) continue;
    next.id = old.id;
    if (old.credentials) next.credentials = old.credentials;
    if (old.webhookId) next.webhookId = old.webhookId;
    if (next.name === 'Backend Configuration') next.parameters = old.parameters;
  }
}



const generate = commonWorkflow(false);
addReservation(generate);
addGeneration(generate);
addPersistence(generate);
writeWorkflow('generate-recipe.workflow.json', generate);
writeWorkflow('quota-status.workflow.json', statusWorkflow());
