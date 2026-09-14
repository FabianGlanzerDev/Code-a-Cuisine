import { canonicalIngredient, ingredientSuggestions } from './ingredient-catalog';

describe('Canonical ingredient suggestions', /** Shares identities across both UI languages. */ () => {
  it('deduplicates salt aliases and offers common salad ingredients', /** Checks the reported search cases. */ () => {
    expect(ingredientSuggestions('salz')).toEqual(['Salt']);
    expect(new Set(ingredientSuggestions('sal')).size).toBe(ingredientSuggestions('sal').length);
    expect(ingredientSuggestions('salami')).toEqual(['Salami']);
    expect(ingredientSuggestions('salat')).toEqual(['Lettuce']);
    expect(ingredientSuggestions('eisberg')).toEqual(['Iceberg lettuce']);
  });
  it('keeps pepper vegetables separate from the spice', /** Paprika is a German vegetable alias. */ () => {
    expect(canonicalIngredient('Paprika')).toBe('Bell pepper');
    expect(canonicalIngredient('Paprikapulver')).toBe('Paprika powder');
    expect(canonicalIngredient('Salz')).toBe(canonicalIngredient('Salt'));
  });
});
