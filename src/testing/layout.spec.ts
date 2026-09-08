import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { WelcomePage } from '../app/pages/welcome/welcome.page';
import { IngredientEntryPage } from '../app/pages/ingredient-entry/ingredient-entry.page';
import { PreferencesPage } from '../app/pages/preferences/preferences.page';
import { RecipeDetailPage } from '../app/pages/recipe-detail/recipe-detail.page';
import { RecipeListPage } from '../app/pages/recipe-list/recipe-list.page';
import { RecipeResultsPage } from '../app/pages/recipe-results/recipe-results.page';
import { CookbookPage } from '../app/pages/cookbook/cookbook.page';
import { ImprintPage } from '../app/pages/imprint/imprint.page';
import { RecipeStoreService } from '../app/services/recipe-store.service';
import { generatedRecipes } from './recipe.fixture';

let frame: HTMLIFrameElement;
let fixture: ComponentFixture<unknown>;
const pages: Type<unknown>[] = [WelcomePage, IngredientEntryPage, PreferencesPage, RecipeDetailPage,
  RecipeListPage, RecipeResultsPage, CookbookPage, ImprintPage];

/**
 * Creates a real nested viewport so CSS media queries use the tested width.
 * @param width Viewport width in pixels.
 * @returns {Document} The result of this operation.
 */
function createViewport(width: number): Document {
  frame = document.createElement('iframe');
  frame.style.cssText = `width:${width}px;height:900px;border:0`;
  document.body.appendChild(frame);
  const target = frame.contentDocument!;
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(/** Processes the current item in the enclosing operation. @param style Current callback input. */ (style) => target.head.appendChild(style.cloneNode(true)));
  return target;
}



/**
 * Configures real Angular rendering in the iframe with fake recipes and intercepted HTTP.
 * @param target Target document or node.
 */
function configureLayout(target: Document): void {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
    { provide: DOCUMENT, useValue: target }, { provide: ActivatedRoute, useValue: {
      snapshot: { paramMap: new Map([['id', 'layout-0']]), queryParamMap: new Map([['cuisine', 'german']]) },
    } }] });
  const store = TestBed.inject(RecipeStoreService);
  const recipes = generatedRecipes().map(/** Maps the current item to its output value. @param recipe Current callback input. @param index Current callback input. */ (recipe, index) => ({ ...recipe, id: 'layout-' + index, likes: 123,
    cooksAmount: 3, title: 'Mediterranean vegetables with creamy chickpeas and herbs' }));
  store.generatedRecipes = recipes;
  store.pendingRecipes = [];
  store.currentRecipes = recipes;
  store.selectedRecipes = recipes;
}



/**
 * Completes all component HTTP requests with local fixture data only.
 */
function flushLayoutRequests(): void {
  const http = TestBed.inject(HttpTestingController);
  const recipes = TestBed.inject(RecipeStoreService).generatedRecipes;
  http.match(/** Handles the current value in the enclosing operation. */ () => true).forEach(/** Processes the current item in the enclosing operation. @param request Current callback input. */ (request) => request.flush(request.request.url.includes('quota')
    ? { ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 0, systemRemaining: 12 }
    : Object.fromEntries(recipes.map(/** Maps the current item to its output value. @param recipe Current callback input. */ (recipe) => [recipe.id, recipe]))));
  http.verify();
}



/**
 * Waits for fonts and image dimensions before checking horizontal overflow.
 * @param page Page component to render.
 * @param width Viewport width in pixels.
 * @returns {Promise<void>} The result of this operation.
 */
async function checkLayout(page: Type<unknown>, width: number): Promise<void> {
  const target = createViewport(width);
  configureLayout(target);
  fixture = TestBed.createComponent(page);
  fixture.detectChanges(); flushLayoutRequests(); fixture.detectChanges();
  expect(target.querySelector('main')).withContext('Component must render in the nested viewport').not.toBeNull();
  expect(frame.contentWindow!.innerWidth).toBe(width);
  expect(frame.contentWindow!.getComputedStyle(target.body).fontFamily).toContain('Quicksand');
  await decodeImages(target);
  await target.fonts.ready;
  expect(target.documentElement.scrollWidth).withContext(`${page.name} at ${width}px`).toBeLessThanOrEqual(width + 1);
}



/**
 * Fails visibly when a real project asset cannot be decoded by the test browser.
 * @param target Target document or node.
 * @returns {Promise<void>} The result of this operation.
 */
async function decodeImages(target: Document): Promise<void> {
  await Promise.all(Array.from(target.images).map(/** Maps the current item to its output value. @param image Current callback input. */ (image) => image.decode().catch(/** Handles a rejected asynchronous operation. */ () => {
    throw new Error('Cannot decode fixture image: ' + image.src);
  })));
}



/**
 * Removes the isolated viewport after each layout test.
 */
function cleanupLayout(): void {
  fixture?.destroy();
  frame?.remove();
}



/** Checks modal focus, keyboard containment and small-screen width. */
async function checkQuantityDialog(): Promise<void> {
  await checkLayout(PreferencesPage, 320);
  const page = fixture.componentInstance as PreferencesPage;
  page.showQuantityPopup = true; fixture.detectChanges();
  const target = frame.contentDocument!;
  const dialog = target.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.contains(target.activeElement)).toBeTrue();
  expect(target.querySelector('main')!.hasAttribute('inert')).toBeTrue();
  target.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  expect(target.activeElement).toBe(dialog.querySelectorAll('button')[1]);
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(page.showQuantityPopup).toBeFalse();
}



/**
 * Registers all pages at small-phone, phone, tablet, laptop and desktop widths.
 */
function layoutSuite(): void {
  beforeEach(/** Initializes isolated state for the next test. */ () => {
    spyOn(Storage.prototype, 'getItem').and.returnValue(null);
    spyOn(Storage.prototype, 'setItem').and.stub();
  });
  afterEach(cleanupLayout);
  it('keeps keyboard focus in the quantity modal and closes with Escape', checkQuantityDialog);
  for (const page of pages) for (const width of [320, 480, 768, 1024, 1440]) {
    it(`${page.name} fits ${width}px`, /** Verifies the behavior named by this test. */ () => checkLayout(page, width));
  }
}



describe('Responsive layouts (isolated fixtures)', layoutSuite);
