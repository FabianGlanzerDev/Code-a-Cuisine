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
  readonly cookbookCuisines: Cuisine[];
  private dragStartX = 0;
  private dragStartScrollLeft = 0;
  private draggingLikedRecipes = false;
  private blockNextLikedClick = false;
  private likedDragFrame: number | null = null;
  private pendingLikedScrollLeft = 0;
  private activeLikedPointerId: number | null = null;

  constructor(
    public readonly store: RecipeStoreService,
    private readonly api: RecipeApiService,
  ) {
    const order = ['italian', 'german', 'japanese', 'gourmet', 'indian', 'fusion'];
    this.cookbookCuisines = [...this.store.cuisines]
      .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }

  /** Loads the three most-liked recipes used in the cookbook hero. */
  ngOnInit(): void {
    this.api.getMostLiked().subscribe((recipes) => this.store.setCurrentRecipes(recipes));
  }

  /** Starts a possible drag without stealing a normal card click. */
  startLikedDrag(event: PointerEvent, scroller: HTMLElement): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.activeLikedPointerId = event.pointerId;
    this.draggingLikedRecipes = false;
    this.blockNextLikedClick = false;
    this.dragStartX = event.clientX;
    this.dragStartScrollLeft = scroller.scrollLeft;
    this.pendingLikedScrollLeft = scroller.scrollLeft;
  }

  /** Starts real dragging only after movement, so a simple click can navigate. */
  moveLikedDrag(event: PointerEvent, scroller: HTMLElement): void {
    if (this.activeLikedPointerId !== event.pointerId) return;
    const distance = event.clientX - this.dragStartX;

    if (!this.draggingLikedRecipes) {
      if (Math.abs(distance) <= 5) return;
      this.draggingLikedRecipes = true;
      this.blockNextLikedClick = true;
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add('is-dragging');
    }

    event.preventDefault();
    this.pendingLikedScrollLeft = this.dragStartScrollLeft - distance;
    if (this.likedDragFrame !== null) return;
    this.likedDragFrame = requestAnimationFrame(() => {
      scroller.scrollLeft = this.pendingLikedScrollLeft;
      this.likedDragFrame = null;
    });
  }

  /** Finishes the horizontal drag interaction. */
  endLikedDrag(event: PointerEvent, scroller: HTMLElement): void {
    if (this.activeLikedPointerId !== event.pointerId) return;

    if (this.draggingLikedRecipes && this.likedDragFrame !== null) {
      cancelAnimationFrame(this.likedDragFrame);
      this.likedDragFrame = null;
      scroller.scrollLeft = this.pendingLikedScrollLeft;
    }

    if (this.draggingLikedRecipes) {
      scroller.classList.remove('is-dragging');
      if (scroller.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
      setTimeout(() => { this.blockNextLikedClick = false; }, 0);
    }

    this.draggingLikedRecipes = false;
    this.activeLikedPointerId = null;
  }

  /** Prevents opening a recipe when the user was swiping instead of clicking. */
  handleLikedCardClick(event: MouseEvent): void {
    if (!this.blockNextLikedClick) return;
    event.preventDefault();
    this.blockNextLikedClick = false;
  }

  /** Clears transient hero recipes when leaving the cookbook. */
  ngOnDestroy(): void {
    if (this.likedDragFrame !== null) cancelAnimationFrame(this.likedDragFrame);
    this.store.setCurrentRecipes([]);
  }
}
