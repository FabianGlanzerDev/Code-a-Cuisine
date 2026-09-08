const RECIPE_COST = 3;
const IP_LIMIT = 3;
const SYSTEM_LIMIT = 12;
const RATE_WINDOW_MS = 10000;

/**
 * Validates a persisted quota counter; corrupted state must never reset silently.
 * @param value Value to validate or store.
 */
function quotaCount(value) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid quota state.');
  return value;
}



/**
 * Returns a UTC-day snapshot with all counters expressed in recipes.
 * @param state Persisted quota state.
 * @param context Request identity and quota context.
 */
function quotaStatus(state, context) {
  const day = state?.days?.[context.dayKey];
  const ipUsed = quotaCount(day?.ips?.[context.ipKey]);
  const systemUsed = quotaCount(day?.used);
  return { ipLimit: IP_LIMIT, ipUsed, ipRemaining: Math.max(0, IP_LIMIT - ipUsed),
    systemLimit: SYSTEM_LIMIT, systemUsed, systemRemaining: Math.max(0, SYSTEM_LIMIT - systemUsed) };
}



/**
 * Builds a reservation proposal that can only be committed with the matching Firebase ETag.
 * @param state Persisted quota state.
 * @param context Request identity and quota context.
 * @param now Current time in milliseconds.
 */
function reserveQuota(state, context, now = Date.now()) {
  const quota = quotaStatus(state, context);
  const lastRequest = quotaCount(state?.lastRequests?.[context.ipKey]);
  if (lastRequest && now - lastRequest < RATE_WINDOW_MS) return { allowed: false, quota, detail: 'Too many requests. Please wait 10 seconds.' };
  if (quota.ipRemaining < RECIPE_COST || quota.systemRemaining < RECIPE_COST) {
    return { allowed: false, quota, detail: 'Daily recipe quota exceeded. Each request reserves 3 recipes. Please try again tomorrow (UTC).' };
  }
  const nextState = incrementReservation(state, context, now);
  return { allowed: true, nextState, quota: quotaStatus(nextState, context) };
}



/**
 * Copies all existing state and increments both quotas and the throttle atomically.
 * @param state Persisted quota state.
 * @param context Request identity and quota context.
 * @param now Current time in milliseconds.
 */
function incrementReservation(state, context, now) {
  const next = JSON.parse(JSON.stringify(state ?? { days: {}, lastRequests: {} }));
  next.days ??= {};
  next.lastRequests ??= {};
  const day = next.days[context.dayKey] ?? { used: 0, ips: {} };
  day.ips ??= {};
  day.used = quotaCount(day.used) + RECIPE_COST;
  day.ips[context.ipKey] = quotaCount(day.ips[context.ipKey]) + RECIPE_COST;
  next.days[context.dayKey] = day;
  next.lastRequests[context.ipKey] = now;
  return next;
}



/**
 * Rejects failed, malformed or unversioned Firebase reads before any paid operation.
 * @param response HTTP response to inspect.
 */
function quotaRead(response) {
  if (response.statusCode !== 200 || !response.headers?.etag) throw new Error('Quota storage is unavailable.');
  const state = response.body;
  if (state !== null && (!state || typeof state !== 'object' || Array.isArray(state))) throw new Error('Invalid quota state.');
  if (state !== null && (!state.days || !state.lastRequests)) throw new Error('Incomplete quota state.');
  return state;
}



module.exports = { quotaStatus, reserveQuota, quotaRead };
