import { Routes } from '@angular/router';
import { CookbookPage } from './pages/cookbook/cookbook.page';
import { ImprintPage } from './pages/imprint/imprint.page';
import { IngredientEntryPage } from './pages/ingredient-entry/ingredient-entry.page';
import { PreferencesPage } from './pages/preferences/preferences.page';
import { RecipeDetailPage } from './pages/recipe-detail/recipe-detail.page';
import { RecipeListPage } from './pages/recipe-list/recipe-list.page';
import { RecipeResultsPage } from './pages/recipe-results/recipe-results.page';
import { WelcomePage } from './pages/welcome/welcome.page';

export const routes: Routes = [
  { path: '', component: WelcomePage },
  { path: 'imprint', component: ImprintPage },
  { path: 'generate-recipe', component: IngredientEntryPage },
  { path: 'choose-preferences', component: PreferencesPage },
  { path: 'recipe-results', component: RecipeResultsPage },
  { path: 'recipe-results/:id', component: RecipeDetailPage },
  { path: 'cookbook', component: CookbookPage },
  { path: 'recipes-list', component: RecipeListPage },
  { path: '**', redirectTo: '' },
];
