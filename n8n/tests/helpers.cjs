const { library } = require('../workflow-tools.cjs');
const fs = require('node:fs');
const path = require('node:path');
const names = ['ip', 'ingredients', 'request', 'quota', 'nutrition', 'directions', 'recipes'];
const api = new Function(library(names) + 'return { normalizeIp, clientIp, parseAmount, validateRequest, reserveQuota, quotaStatus, quotaRead, validateRecipes };')();

/**
 * Loads a fresh offline recipe fixture for each validation test.
 */
function fixture() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'recipes.fixture.json'), 'utf8'));
}



/**
 * Creates a valid ingredient request for offline tests only.
 */
function request() {
  return { ingredients: [{ ingredient: 'Carrot', servingSize: '100g' }], portionsAmount: 2,
    cooksAmount: 2, cuisine: 'german', cookingTime: 'quick', dietPreferences: 'vegan' };
}



module.exports = { ...api, fixture, request };
