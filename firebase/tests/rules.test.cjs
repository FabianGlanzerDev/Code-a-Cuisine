const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fixture, reserveQuota, quotaRead } = require('../../n8n/tests/helpers.cjs');
const rules = JSON.parse(fs.readFileSync('firebase/database.rules.json', 'utf8'));
const workflow = JSON.parse(fs.readFileSync('n8n/generate-recipe.workflow.json', 'utf8'));
const storageCode = workflow.nodes.find(/** Selects the real exported storage preparation. @param node Workflow node. */ (node) => node.name === 'Prepare Recipe Storage').parameters.jsCode;
let namespace;
let batch;

/**
 * Sends REST requests only to the local emulator, never to an environment URL.
 * @param path Database path without the JSON suffix.
 * @param method HTTP method.
 * @param body Optional JSON body.
 * @param admin Whether to use the emulator's reserved owner token (not a credential).
 * @param headers Additional REST headers.
 * @param query Additional query parameters.
 */
function request(path, method = 'GET', body, admin = false, headers = {}, query = '') {
  return fetch(`http://127.0.0.1:9000/${path}.json?ns=${namespace}${query}`, { method,
    headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer owner' } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
}



/** Loads production rules into a fresh demo namespace and prepares the actual n8n batch. */
async function configure() {
  namespace = 'demo-cuisine-' + crypto.randomUUID();
  const response = await request('.settings/rules', 'PUT', rules, true);
  assert.equal(response.status, 200, await response.text());
  batch = new Function('$input', '$execution', storageCode)({ first: /** Supplies validated offline fixtures. */ () => ({ json: { recipes: fixture(), quota: {} } }) }, { id: 'rules-test' })[0].json;
}



/** Stores the exported multipath payload as the trusted backend would. */
async function seedRecipes() {
  const response = await request('recipes', 'PATCH', batch.updates, true);
  assert.equal(response.status, 200, await response.text());
}



/** Requires a denied request. @param response Completed REST response. */
async function denied(response) {
  assert.ok([401, 403].includes(response.status), `Expected denied, received ${response.status}: ${await response.text()}`);
}



beforeEach(configure);
test('private quota and root remain inaccessible to anonymous clients', /** Checks every relevant ancestor and write method. */ async () => {
  for (const path of ['', 'privateQuota', 'privateQuota/v2/state']) {
    await denied(await request(path));
    await denied(await request(path, 'PUT', { used: 0 }));
    await denied(await request(path, 'DELETE'));
  }
  const response = await request('privateQuota/v2/state', 'GET', undefined, true, { 'X-Firebase-ETag': 'true' });
  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
  assert.ok(response.headers.get('etag'));
});



test('backend storage, public cookbook queries and read-only fallback work under locked rules', /** Checks the existing REST paths against real rules. */ async () => {
  await denied(await request('recipes', 'PATCH', batch.updates));
  await seedRecipes();
  const response = await request('recipes', 'GET', undefined, false, {}, '&orderBy=%22cuisine%22&equalTo=%22german%22');
  assert.equal(response.status, 200);
  assert.equal(Object.keys(await response.json()).length, 3);
  for (const recipe of batch.recipes) {
    const stored = await request('recipes/' + recipe.id);
    assert.equal(stored.status, 200);
    assert.equal((await stored.json()).directions.length, recipe.directions.length);
  }
});



test('public creation, content edits and deletion are denied atomically', /** Prevents direct writes from bypassing validation and quota. */ async () => {
  await seedRecipes();
  const id = batch.recipes[0].id;
  await denied(await request('recipes/new', 'PUT', batch.recipes[0]));
  await denied(await request('recipes', 'POST', batch.recipes[0]));
  await denied(await request('recipes/' + id, 'DELETE'));
  await denied(await request('recipes/' + id + '/title', 'PUT', 'forged'));
  await denied(await request('recipes', 'PATCH', { [`${id}/likes`]: 1, [`${id}/title`]: 'forged' }));
  const saved = await (await request('recipes/' + id)).json();
  assert.equal(saved.title, batch.recipes[0].title);
  assert.equal(saved.likes, undefined);
});



test('first like, unlike and repeated backend storage preserve valid counters', /** Exercises likes from an omitted initial value. */ async () => {
  await seedRecipes();
  const path = 'recipes/' + batch.recipes[0].id + '/likes';
  for (const value of [1, 2, 1, 0, 1]) assert.equal((await request(path, 'PUT', value)).status, 200);
  await seedRecipes();
  assert.equal(await (await request(path)).json(), 1);
  for (const value of [-1, 0.5, 100, '2', null, { count: 2 }]) await denied(await request(path, 'PUT', value));
  await denied(await request('recipes/missing/likes', 'PUT', 1));
});



test('concurrent anonymous likes return ETag conflicts and can be retried', /** Uses the same conditional writes as Angular. */ async () => {
  await seedRecipes();
  const path = 'recipes/' + batch.recipes[0].id + '/likes';
  const etag = (await request(path, 'GET', undefined, false, { 'X-Firebase-ETag': 'true' })).headers.get('etag');
  const responses = await Promise.all(Array.from({ length: 8 }, /** Races with one counter version. */ () => request(path, 'PUT', 1, false, { 'if-match': etag })));
  assert.equal(responses.filter(/** Counts successful commits. @param response REST response. */ (response) => response.status === 200).length, 1);
  assert.equal(responses.filter(/** Counts rejected stale versions. @param response REST response. */ (response) => response.status === 412).length, 7);
  const current = await request(path, 'GET', undefined, false, { 'X-Firebase-ETag': 'true' });
  assert.equal((await request(path, 'PUT', 2, false, { 'if-match': current.headers.get('etag') })).status, 200);
});



/** Makes competing quota commits using the exported algorithm and real emulator ETags. @param round Reservation round. */
async function reserveRound(round) {
  const path = 'privateQuota/v2/state';
  const response = await request(path, 'GET', undefined, true, { 'X-Firebase-ETag': 'true' });
  const etag = response.headers.get('etag');
  const state = quotaRead({ statusCode: response.status, headers: { etag }, body: await response.json() });
  const candidates = Array.from({ length: 8 }, /** Prepares competing identities. @param unused Unused array value. @param index Candidate number. */ (unused, index) => reserveQuota(state, { dayKey: '2026-09-08', ipKey: `ip_${round}_${index}` }, 100000));
  const responses = await Promise.all(candidates.map(/** Commits only allowed reservations. @param candidate Proposal. */ (candidate) => candidate.allowed
    ? request(path, 'PUT', candidate.nextState, true, { 'if-match': etag }) : Promise.resolve({ status: 429 })));
  const codes = responses.map(/** Extracts the outcome. @param response REST response. */ (response) => response.status);
  assert.equal(codes.filter(/** Counts accepted reservations. @param code HTTP status. */ (code) => code === 200).length, round < 4 ? 1 : 0);
  assert.equal(codes.filter(/** Requires only expected conflicts or exhausted quotas. @param code HTTP status. */ (code) => code === (round < 4 ? 412 : 429)).length, round < 4 ? 7 : 8);
}



test('real conditional quota writes stop parallel callers at twelve recipes', /** Races five batches without invoking a model. */ async () => {
  for (let round = 0; round < 5; round++) await reserveRound(round);
  const state = await (await request('privateQuota/v2/state', 'GET', undefined, true)).json();
  assert.equal(state.days['2026-09-08'].used, 12);
  for (const used of Object.values(state.days['2026-09-08'].ips)) assert.equal(used, 3);
  const ipKey = Object.keys(state.lastRequests)[0];
  assert.equal(reserveQuota(state, { dayKey: '2026-09-09', ipKey }, 100001).allowed, false);
});
