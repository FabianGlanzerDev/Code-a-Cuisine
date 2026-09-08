/**
 * Parses a bounded positive amount in the units accepted by the ingredient form.
 * @param value Value to validate or store.
 */
function parseAmount(value) {
  if (typeof value !== 'string' || value.length > 30) return null;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(g|ml|piece|pieces)?$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.'));
  const unit = (match[2] || '').toLowerCase().replace(/^pieces?$/, '');
  return Number.isFinite(amount) && amount > 0 && amount <= 10000 ? { amount, unit } : null;
}



/**
 * Returns whether an ingredient contains a valid name and positive quantity.
 * @param entry Ingredient entry to validate.
 */
function validIngredient(entry) {
  if (typeof entry?.ingredient !== 'string') return false;
  const name = entry.ingredient.trim();
  return name.length > 0 && name.length <= 80 && /[\p{L}]/u.test(name)
    && /^[\p{L}\p{N} .,'’()\-/]+$/u.test(name) && !!parseAmount(entry.servingSize);
}



/**
 * Normalizes a food name for exact ingredient coverage and duplicate checks.
 * @param entry Ingredient entry to validate.
 */
function foodName(entry) {
  return String(entry?.ingredient ?? '').trim().toLowerCase();
}



/**
 * Rejects known animal ingredients for vegetarian and vegan requests.
 * @param entry Ingredient entry to validate.
 * @param diet Selected dietary preference.
 */
function violatesDiet(entry, diet) {
  const name = foodName(entry);
  const meat = /\b(chicken|beef|pork|bacon|ham|salami|pastrami|lamb|turkey|duck|fish|salmon|tuna|shrimp|prawn|anchov\w*|gelatin\w*|lard|meat|sausage|huhn|hähnchen|rind\w*|schwein\w*|speck|schinken|fisch|lachs|thunfisch|garnele\w*|wurst)\b/i;
  const dairy = /\b(egg\w*|milk|cream|butter|cheese|yogu?rt|honey|whey|casein|ghee|parmesan|mozzarella|feta|ei|eier|milch|sahne|käse|honig|joghurt|quark)\b/i;
  const plantDairy = /\b(soy|soja|oat|hafer|almond|mandel|coconut|kokos|peanut|erdnuss|cashew|vegan|plant)\w*\b/i;
  if (!['vegetarian', 'vegan'].includes(diet)) return false;
  if (meat.test(name)) return true;
  return diet === 'vegan' && dairy.test(name) && !plantDairy.test(name);
}



module.exports = { parseAmount, validIngredient, foodName, violatesDiet };
