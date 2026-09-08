const fs = require('node:fs');
const path = require('node:path');
const { library, node, branch, response, quotaHttp, connect } = require('./workflow-tools.cjs');
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
  connect(workflow, 'Request Valid?', 'Read Atomic Quota', 'Return Validation Error');
  connect(workflow, 'Read Atomic Quota', statusOnly ? 'Build Quota Status' : 'Prepare Reservation', 'Return Backend Error');
  return workflow;
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
    response('Return Validation Error', "={{ JSON.stringify({ detail: $json.errors.join(' '), quota: null }) }}", 400, [880, 240]),
    quotaHttp('Read Atomic Quota', 'GET', [880, 0]));
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
  workflow.nodes.push({ ...node('Prepare Reservation', 'code', { jsCode: code }, [1100, 0], 'Reserves 3 recipe slots per request: IP 3/day, system 12/day; rate window 10 seconds.'), onError: 'continueErrorOutput' },
    branch('Quota Available?', '={{ $json.allowed }}', [1320, 0]), quotaHttp('Commit Reservation', 'PUT', [1540, 0]),
    branch('Reservation Committed?', '={{ $json.statusCode === 200 }}', [1760, 0]),
    branch('Reservation Conflict?', '={{ $json.statusCode === 412 }}', [1760, 240]),
    response('Return Quota Error', '={{ JSON.stringify({ detail: $json.detail, quota: $json.quota }) }}', 429, [1540, 360]),
    response('Return Concurrent Request', '={{ JSON.stringify({ detail: "Another request changed the quota. Please wait 10 seconds and try again. No generation was started.", quota: null }) }}', 429, [1980, 360]));
  connect(workflow, 'Prepare Reservation', 'Quota Available?', 'Return Backend Error');
  connect(workflow, 'Quota Available?', 'Commit Reservation', 'Return Quota Error');
  connect(workflow, 'Commit Reservation', 'Reservation Committed?', 'Return Backend Error');
  connect(workflow, 'Reservation Committed?', 'Build Model Request', 'Reservation Conflict?');
  connect(workflow, 'Reservation Conflict?', 'Return Concurrent Request', 'Return Backend Error');
}



/**
 * Adds one direct Gemini HTTP request without hidden SDK retries or tool loops.
 * @param workflow Workflow definition.
 */
function addGeneration(workflow) {
  const prompt = fs.readFileSync(path.join(__dirname, 'prompts/recipes.txt'), 'utf8').slice(1).replace(/\{\{[^\n]+\}\}/, '');
  const code = `return [{ json: { systemInstruction: { parts: [{ text: ${JSON.stringify(prompt)} }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify($('Validate Request').first().json.request) }] }], generationConfig: { candidateCount: 1, responseMimeType: 'application/json', maxOutputTokens: 8192 } } }];`;
  workflow.nodes.push(node('Build Model Request', 'code', { jsCode: code }, [1980, -240], 'Separates fixed instructions from user input and caps one model response.'),
    { ...node('Create Three Recipes', 'httpRequest', modelParameters(), [1980, 0],
      'Select the real Google Gemini(PaLM) API credential. One direct request; automatic retries are disabled.', 4.2), onError: 'continueErrorOutput', retryOnFail: false });
  addOutputValidation(workflow);
  connect(workflow, 'Build Model Request', 'Create Three Recipes');
  connect(workflow, 'Create Three Recipes', 'Validate Recipe Output', 'Return Backend Error');
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
    + "const context = $('Prepare Reservation').first().json;\ntry {\n  const candidate = $input.first().json.candidates?.[0];\n  if (candidate?.finishReason !== 'STOP') throw new Error('Incomplete model response.');\n  const raw = candidate.content.parts.filter(/** Checks whether the current item matches the filter. @param part Current callback input. */ (part) => !part.thought).map(/** Maps the current item to its output value. @param part Current callback input. */ (part) => part.text || '').join('');\n  const recipes = validateRecipes(raw, context.request);\n  return [{ json: { recipes, quota: context.quota, valid: true } }];\n} catch {\n  return [{ json: { detail: 'Generated recipes failed validation. The three reserved recipe slots remain used today to prevent repeated charges.', quota: context.quota, valid: false } }];\n}";
  workflow.nodes.push(node('Validate Recipe Output', 'code', { jsCode: code }, [2200, 0], 'Checks diet exclusions, ingredient scaling, nutrition and chronological dependencies.'),
    branch('Recipe Output Valid?', '={{ $json.valid }}', [2420, 0]),
    response('Return Recipes and Quota', "={{ JSON.stringify({ recipes: $('Prepare Recipe Storage').first().json.recipes, quota: $('Prepare Recipe Storage').first().json.quota, persisted: true }) }}", 200, [3300, 0]),
    response('Return Recipe Validation Error', '={{ JSON.stringify({ detail: $json.detail, quota: $json.quota }) }}', 502, [2640, 240]));
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
  workflow.nodes.push({ ...node('Build Quota Status', 'code', { jsCode: code }, [1100, 0], 'Reports remaining recipe slots from the same state used by reservations.'), onError: 'continueErrorOutput' },
    response('Return Quota Status', '={{ $json }}', 200, [1320, 0]));
  connect(workflow, 'Build Quota Status', 'Return Quota Status', 'Return Backend Error');
  return workflow;
}



/**
 * Writes deterministic exports, or fails when checked-in exports have drifted.
 * @param filename Source or export filename.
 * @param workflow Workflow definition.
 */
function writeWorkflow(filename, workflow) {
  const target = path.join(__dirname, filename);
  const content = JSON.stringify(workflow, null, 2) + '\n';
  if (checkOnly && fs.readFileSync(target, 'utf8') !== content) throw new Error('Stale workflow export: ' + filename);
  if (!checkOnly) fs.writeFileSync(target, content);
}



const generate = commonWorkflow(false);
addReservation(generate);
addGeneration(generate);
addPersistence(generate);
writeWorkflow('generate-recipe.workflow.json', generate);
writeWorkflow('quota-status.workflow.json', statusWorkflow());
