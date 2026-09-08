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
 * Checks macro energy shares and returns the numeric per-portion nutrition.
 * @param snapshot Nutrition snapshot.
 */
function validateSnapshot(snapshot) {
  if (!snapshot) throw new Error('Nutrition is missing.');
  const calories = nutrient(snapshot.calories, 'kcal');
  const values = ['proteins', 'fats', 'carbs'].map(/** Maps the current item to its output value. @param key Current callback input. */ (key) => nutrient(snapshot[key], 'g'));
  const energy = values.map(/** Maps the current item to its output value. @param value Current callback input. @param index Current callback input. */ (value, index) => value * (index === 1 ? 9 : 4));
  const totalEnergy = energy.reduce(/** Combines the accumulated value with the current item. @param sum Current callback input. @param value Current callback input. */ (sum, value) => sum + value, 0);
  if (calories <= 0 || totalEnergy <= 0 || Math.abs(calories - totalEnergy) > Math.max(10, calories * 0.1)) throw new Error('Nutrition energy is inconsistent.');
  ['proteins', 'fats', 'carbs'].forEach(/** Processes the current item in the enclosing operation. @param key Current callback input. @param index Current callback input. */ (key, index) => {
    const percent = nutrient(snapshot[key + 'Percent'], '%');
    if (percent > 100 || Math.abs(percent - energy[index] / totalEnergy * 100) > 2) throw new Error('Macro percentages are inconsistent.');
  });
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
  if (request.dietPreferences === 'keto' && nutrient(recipe.nutritionalInformation.perPortion.carbsPercent, '%') > 10) {
    throw new Error('Keto recipes must have at most 10% carbohydrate energy.');
  }
}



module.exports = { nutrient, validateSnapshot, validateNutrition };
