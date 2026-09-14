/**
 * Parses a nonnegative nutrition value with an exact unit.
 * @param value Value to validate or store.
 * @param unit Expected ingredient or nutrition unit.
 */
function nutrient(value, unit) {
  if (typeof value !== 'string') throw new Error('Nutrition must include units.');
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kcal|g|%)$/);
  if (!match || match[2] !== unit) throw new Error('Invalid nutrition amount or unit.');
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount > 100000) throw new Error('Invalid nutrition amount.');
  return amount;
}



/**
 * Validates source amounts and energy; ignores model-supplied percentage fields.
 * @param snapshot Nutrition snapshot.
 */
function validateSnapshot(snapshot) {
  if (!snapshot) throw new Error('Nutrition is missing.');
  const calories = nutrient(snapshot.calories, 'kcal');
  const values = ['proteins', 'fats', 'carbs'].map(/** Maps the current item to its output value. @param key Current callback input. */ (key) => nutrient(snapshot[key], 'g'));
  const energy = values.map(/** Maps the current item to its output value. @param value Current callback input. @param index Current callback input. */ (value, index) => value * (index === 1 ? 9 : 4));
  const totalEnergy = energy.reduce(/** Combines the accumulated value with the current item. @param sum Current callback input. @param value Current callback input. */ (sum, value) => sum + value, 0);
  if (calories <= 0 || totalEnergy <= 0 || Math.abs(calories - totalEnergy) > Math.max(10, calories * 0.1)) throw new Error('Nutrition energy is inconsistent.');
  return [calories, ...values];
}



/**
 * Verifies total nutrition scales with portions and enforces the documented keto limit.
 * @param recipe Recipe to process.
 * @param request Validated recipe requirements.
 */
function validateNutrition(recipe, request) {
  const portion = validateSnapshot(recipe.nutritionalInformation?.perPortion);
  const total = validateSnapshot(recipe.nutritionalInformation?.total);
  portion.forEach(/** Processes the current item in the enclosing operation. @param value Current callback input. @param index Current callback input. */ (value, index) => {
    const expected = value * request.portionsAmount;
    if (Math.abs(total[index] - expected) > Math.max(1, expected * 0.02)) throw new Error('Total nutrition does not match portions.');
  });
  if (request.dietPreferences === 'keto' && macroShares(portion)[2] > 10) {
    throw new Error('Keto recipes must have at most 10% carbohydrate energy.');
  }
  storeMacroShares(recipe.nutritionalInformation.perPortion, portion);
  storeMacroShares(recipe.nutritionalInformation.total, total);
}



/** Computes unrounded energy shares from already validated numeric amounts. @param values Calories followed by protein, fat and carbohydrate grams. */
function macroShares(values) {
  const energy = values.slice(1).map(/** Converts grams to energy. */ (value, index) => value * (index === 1 ? 9 : 4));
  const sum = energy.reduce(/** Adds macro energy. */ (total, value) => total + value, 0);
  return energy.map(/** Calculates the unrounded percentage. */ value => value / sum * 100);
}



/** Formats derived shares for the existing display contract only after validation. @param snapshot Validated output snapshot. @param values Validated numeric amounts. */
function storeMacroShares(snapshot, values) {
  const shares = macroShares(values);
  ['proteins', 'fats', 'carbs'].forEach(/** Stores display rounding without changing grams or calories. */ (key, index) => {
    snapshot[key + 'Percent'] = shares[index].toFixed(2) + '%';
  });
}



module.exports = { nutrient, validateSnapshot, validateNutrition };
