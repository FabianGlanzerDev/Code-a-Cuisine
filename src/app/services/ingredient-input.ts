/** Applies the same basic rules when adding, editing and restoring free-text ingredients. @param name Food name. @param amount Numeric quantity. @param unit Supported unit abbreviation. */
export function ingredientInputError(name: string, amount: number, unit: string): string {
  if (!name.trim() || name.trim().length > 80 || !/\p{L}/u.test(name) || /[\u0000-\u001f\u007f]/u.test(name)) return 'Please enter a valid ingredient name (up to 80 characters, without control characters).';
  if (!['', 'g', 'ml'].includes(unit)) return `For "${name}": please select g, ml or pieces.`;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) return `For "${name}": please enter an amount greater than 0 and at most 10000.`;
  return '';
}
