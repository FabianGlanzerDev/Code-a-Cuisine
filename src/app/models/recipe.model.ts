export interface IngredientEntry {
  ingredient: string;
  servingSize: string;
  isEditMode: boolean;
}

export interface RecipeRequirements {
  ingredients: IngredientEntry[];
  portionsAmount: number;
  cooksAmount: number;
  cookingTime: string;
  cuisine: string;
  dietPreferences: string;
}

export interface NutritionSnapshot {
  calories: string;
  proteins: string;
  proteinsPercent: string;
  fats: string;
  fatsPercent: string;
  carbs: string;
  carbsPercent: string;
}

export interface Nutrition {
  perPortion?: NutritionSnapshot;
  total?: NutritionSnapshot;
  calories?: string;
  proteins?: string;
  fats?: string;
  carbs?: string;
}

export interface RecipeIngredient {
  ingredient: string;
  servingSize: string;
  perPortionServingSize?: string;
}

export interface RecipeDirection {
  order: number;
  title: string;
  description: string;
  cook: number;
  parallel?: boolean;
  timingNote?: string;
  startMinute?: number;
  durationMinutes?: number;
  dependsOn?: number[];
}

export interface QuotaStatus {
  ipLimit: number;
  ipUsed: number;
  ipRemaining: number;
  systemLimit: number;
  systemUsed: number;
  systemRemaining: number;
}

export interface GenerationError {
  detail: string;
  quota?: QuotaStatus;
}

export interface GenerationEnvelope {
  recipes: GeneratedRecipe[];
  quota: QuotaStatus;
  persisted?: boolean;
}

export type GenerationResponse = GeneratedRecipe[] | GenerationEnvelope | GenerationError;

export interface GeneratedRecipe {
  id?: string;
  title: string;
  cookingTime: string;
  portionsAmount?: number;
  nutritionalInformation: Nutrition;
  preferences: Omit<RecipeRequirements, 'ingredients' | 'portionsAmount' | 'cooksAmount'>;
  cooksAmount: number;
  ingredients: {
    yourIngredients: RecipeIngredient[];
    extraIngredients: RecipeIngredient[];
  };
  directions: RecipeDirection[];
}

export interface StoredRecipe extends GeneratedRecipe {
  likes: number;
  cuisine?: string;
}

export interface Recipe extends StoredRecipe {
  id: string;
}
