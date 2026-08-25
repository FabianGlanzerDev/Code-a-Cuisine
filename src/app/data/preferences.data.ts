import { Cuisine } from '../models/cuisine.model';

export interface CookingTimeOption {
  value: string;
  label: string;
  hint: string;
}

export const COOKING_TIMES: CookingTimeOption[] = [
  { value: 'quick', label: 'Quick', hint: 'up to 20min' },
  { value: 'medium', label: 'Medium', hint: '20–45min' },
  { value: 'complex', label: 'Complex', hint: 'over 45min' },
];

export const DIET_PREFERENCES = ['vegetarian', 'vegan', 'keto', 'no preferences'] as const;

export const CUISINES: Cuisine[] = [
  { name: 'german', thumbnailImage: 'img/category-thumbnails/card-4.webp', headerImage: 'img/category-headers/Property 1=German.png', emoji: '🥨' },
  { name: 'italian', thumbnailImage: 'img/category-thumbnails/card-5.webp', headerImage: 'img/category-headers/Property 1=Italian.png', emoji: '🤌' },
  { name: 'indian', thumbnailImage: 'img/category-thumbnails/card-1.webp', headerImage: 'img/category-headers/Property 1=Fusion.png', emoji: '🍛' },
  { name: 'japanese', thumbnailImage: 'img/category-thumbnails/card-3.webp', headerImage: 'img/category-headers/Property 1=Japanese.png', emoji: '🥢' },
  { name: 'gourmet', thumbnailImage: 'img/category-thumbnails/card-2.webp', headerImage: 'img/category-headers/Property 1=Gourmet.png', emoji: '✨' },
  { name: 'fusion', thumbnailImage: 'img/category-thumbnails/card.webp', headerImage: 'img/category-headers/Property 1=Fusion.png', emoji: '🍢' },
];
