import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { Cuisine } from '../../models/cuisine.model';
import { RecipeApiService } from '../../services/recipe-api.service';
import { RecipeStoreService } from '../../services/recipe-store.service';

@Component({
  selector: 'app-cookbook-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './cookbook.page.html',
  styleUrl: './cookbook.page.css',
})
export class CookbookPage implements OnInit, OnDestroy {
  loading = true;
  errorMessage = '';
  readonly cookbookCuisines: Cuisine[];
  private dragStartX = 0;
  private dragStartScrollLeft = 0;
  private draggingLikedRecipes = false;
  private blockNextLikedClick = false;
  private likedDragFrame: number | null = null;
  private pendingLikedScrollLeft = 0;
  private activeLikedPointerId: number | null = null;

  /**
   * Initializes the component or service with its required dependencies.
   * @param store Shared recipe collections.
   * @param api Recipe persistence service.
   */
  constructor(
    public readonly store: RecipeStoreService,
    private readonly api: RecipeApiService,
  ) {
    const order = ['italian', 'german', 'japanese', 'gourmet', 'indian', 'fusion'];
    this.cookbookCuisines = [...this.store.cuisines]
      .sort(/** Compares two items to determine their order. @param a Current callback input. @param b Current callback input. */ (a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }



  /**
   * Loads the most-liked recipes and exposes a readable loading or failure state.
   */
  ngOnInit(): void {
    this.api.getMostLiked().subscribe({
      next: /** Applies a successful asynchronous result. @param recipes Current callback input. */ (recipes) => { this.store.setCurrentRecipes(recipes); this.loading = false; },
      error: /** Handles a failed asynchronous operation. */ () => { this.errorMessage = 'Most liked recipes could not be loaded.'; this.loading = false; },
    });
  }



  /**
   * Starts a possible drag without stealing a normal card click.
   * @param event Pointer or mouse event.
   * @param scroller Element containing the recipe cards.
   */
  startLikedDrag(event: PointerEvent, scroller: HTMLElement): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.activeLikedPointerId = event.pointerId;
    this.draggingLikedRecipes = false;
    this.blockNextLikedClick = false;
    this.dragStartX = event.clientX;
    this.dragStartScrollLeft = scroller.scrollLeft;
    this.pendingLikedScrollLeft = scroller.scrollLeft;
  }



  /**
   * Starts real dragging only after movement, so a simple click can navigate.
   * @param event Pointer or mouse event.
   * @param scroller Element containing the recipe cards.
   */
  moveLikedDrag(event: PointerEvent, scroller: HTMLElement): void {
    if (this.activeLikedPointerId !== event.pointerId) return;
    const distance = event.clientX - this.dragStartX;

    if (!this.draggingLikedRecipes && Math.abs(distance) <= 5) return;
    this.activateLikedDrag(event, scroller);
    event.preventDefault();
    this.pendingLikedScrollLeft = this.dragStartScrollLeft - distance;
    this.scheduleLikedScroll(scroller);
  }



  /**
   * Captures the pointer after the movement threshold has been reached.
   * @param event Pointer or mouse event.
   * @param scroller Element containing the recipe cards.
   */
  private activateLikedDrag(event: PointerEvent, scroller: HTMLElement): void {
    if (this.draggingLikedRecipes) return;
    this.draggingLikedRecipes = true;
    this.blockNextLikedClick = true;
    scroller.setPointerCapture(event.pointerId);
    scroller.classList.add('is-dragging');
  }



  /**
   * Coalesces pointer movement into one scroll update per animation frame.
   * @param scroller Element containing the recipe cards.
   */
  private scheduleLikedScroll(scroller: HTMLElement): void {
    if (this.likedDragFrame !== null) return;
    this.likedDragFrame = requestAnimationFrame(/** Applies the pending update in the next animation frame. */ () => {
      scroller.scrollLeft = this.pendingLikedScrollLeft;
      this.likedDragFrame = null;
    });
  }



  /**
   * Finishes the horizontal drag interaction.
   * @param event Pointer or mouse event.
   * @param scroller Element containing the recipe cards.
   */
  endLikedDrag(event: PointerEvent, scroller: HTMLElement): void {
    if (this.activeLikedPointerId !== event.pointerId) return;
    this.flushLikedScroll(scroller);
    if (this.draggingLikedRecipes) {
      scroller.classList.remove('is-dragging');
      if (scroller.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
      setTimeout(/** Completes the deferred state update. */ () => { this.blockNextLikedClick = false; }, 0);
    }

    this.draggingLikedRecipes = false;
    this.activeLikedPointerId = null;
  }



  /**
   * Applies the final queued scroll position before releasing pointer capture.
   * @param scroller Element containing the recipe cards.
   */
  private flushLikedScroll(scroller: HTMLElement): void {
    if (!this.draggingLikedRecipes || this.likedDragFrame === null) return;
    cancelAnimationFrame(this.likedDragFrame);
    this.likedDragFrame = null;
    scroller.scrollLeft = this.pendingLikedScrollLeft;
  }



  /**
   * Prevents opening a recipe when the user was swiping instead of clicking.
   * @param event Pointer or mouse event.
   */
  handleLikedCardClick(event: MouseEvent): void {
    if (!this.blockNextLikedClick) return;
    event.preventDefault();
    this.blockNextLikedClick = false;
  }



  /**
   * Clears transient hero recipes when leaving the cookbook.
   */
  ngOnDestroy(): void {
    if (this.likedDragFrame !== null) cancelAnimationFrame(this.likedDragFrame);
    this.store.setCurrentRecipes([]);
  }
}
