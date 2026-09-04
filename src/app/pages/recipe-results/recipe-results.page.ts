import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { RecipeGeneratorService } from '../../services/recipe-generator.service';
import { RecipeStoreService } from '../../services/recipe-store.service';

@Component({
  selector: 'app-recipe-results-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './recipe-results.page.html',
  styleUrl: './recipe-results.page.css',
})
export class RecipeResultsPage {
  constructor(
    public readonly generator: RecipeGeneratorService,
    public readonly store: RecipeStoreService,
  ) { }

  /** Uses the generated recipe data as fallback after a page reload. */
  get cuisine(): string {
    return this.store.generatedRecipes[0]?.preferences.cuisine
      || this.generator.requirements.cuisine;
  }

  /** Uses the generated recipe data as fallback after a page reload. */
  get cookingTime(): string {
    return this.store.generatedRecipes[0]?.preferences.cookingTime
      || this.generator.requirements.cookingTime;
  }

  /** Uses the generated recipe data as fallback after a page reload. */
  get dietPreference(): string {
    return this.store.generatedRecipes[0]?.preferences.dietPreferences
      || this.generator.requirements.dietPreferences;
  }
}
