/**
 * Validates request choices without coercing arbitrary values to valid input.
 * @param request Validated recipe requirements.
 */
function requestErrors(request) {
  const errors = [];
  if (!Number.isInteger(request.portionsAmount) || request.portionsAmount < 1 || request.portionsAmount > 12) errors.push('Portions must be between 1 and 12.');
  if (!Number.isInteger(request.cooksAmount) || request.cooksAmount < 1 || request.cooksAmount > 3) errors.push('Cooks must be between 1 and 3.');
  if (!['quick', 'medium', 'complex'].includes(request.cookingTime)) errors.push('Invalid cooking time.');
  if (!['german', 'italian', 'japanese', 'indian', 'gourmet', 'fusion'].includes(request.cuisine)) errors.push('Invalid cuisine.');
  if (!['vegetarian', 'vegan', 'keto', 'no preferences'].includes(request.dietPreferences)) errors.push('Invalid diet preference.');
  return [...errors, ...ingredientErrors(request)];
}



/**
 * Checks ingredient bounds, duplicate names and achievable diet-compatible coverage.
 * @param request Validated recipe requirements.
 */
function ingredientErrors(request) {
  const entries = request.ingredients;
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 30) return ['Please provide between 1 and 30 ingredients.'];
  if (entries.some(/** Checks whether this item meets the condition. @param entry Current callback input. */ (entry) => !validIngredient(entry))) return ['Every ingredient needs a valid name and a positive amount (g, ml or pieces).'];
  if (new Set(entries.map(foodName)).size !== entries.length) return ['Please combine duplicate ingredients.'];
  const compatible = entries.filter(/** Checks whether the current item matches the filter. @param entry Current callback input. */ (entry) => !violatesDiet(entry, request.dietPreferences));
  return compatible.length < Math.ceil(entries.length * 0.7)
    ? ['Your ingredients do not allow 70% coverage with the selected diet. Please adjust ingredients or diet.'] : [];
}



/**
 * Builds a sanitized request context; absent proxy configuration fails closed.
 * @param item Webhook input item.
 * @param config Configuration for this operation.
 * @param now Current time in milliseconds.
 * @param statusOnly Whether only the quota endpoint is being validated.
 */
function validateRequest(item, config, now = Date.now(), statusOnly = false) {
  const request = item.body && typeof item.body === 'object' ? item.body : {};
  const errors = statusOnly ? [] : requestErrors(request);
  const ip = clientIp(item.headers ?? {}, config.trustedIpHeader);
  if (!ip) errors.push('A verified client IP is unavailable. Please contact the site operator.');
  if (!statusOnly && !/^models\/gemini-[\w.-]+$/.test(config.modelName ?? '')) errors.push('The recipe model is not configured. Please contact the site operator.');
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const ipKey = ip?.replaceAll('.', '_').replaceAll(':', '_') ?? '';
  return { request, ipKey, dayKey, valid: errors.length === 0, errors };
}



module.exports = { requestErrors, ingredientErrors, validateRequest };
