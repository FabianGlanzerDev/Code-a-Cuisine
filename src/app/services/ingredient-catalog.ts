import aliases from '../data/ingredient-aliases.json';
import ingredients from '../data/ingredients.json';

/** Resolves German and English aliases to one English catalog label. @param value Entered food name. */
export function canonicalIngredient(value: string): string {
  const key = value.trim().toLowerCase();
  return (aliases as Record<string, string>)[key] ?? ingredients.find(/** Matches canonical spelling. @param item Catalog name. */ item => item.toLowerCase() === key) ?? value.trim();
}



/** Matches aliases but shows each food identity once. @param value Search text. */
export function ingredientSuggestions(value: string): string[] {
  const query = value.trim().toLowerCase();
  if (!query) return [];
  return [...new Set(ingredients.filter(/** Finds names in either language. @param item Catalog name. */ item => item.toLowerCase().startsWith(query)).map(canonicalIngredient))].slice(0, 3);
}
