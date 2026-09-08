import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy } from '@angular/core';

@Directive({ selector: '[appFocusDialog]' })
export class FocusDialogDirective implements AfterViewInit, OnDestroy {
  private previousFocus: HTMLElement | null = null;

  /**
   * Receives the dialog element whose keyboard focus is managed.
   * @param element Dialog element reference.
   */
  constructor(private readonly element: ElementRef<HTMLElement>) {}



  /** Moves keyboard focus into the newly opened dialog. */
  ngAfterViewInit(): void {
    this.previousFocus = this.element.nativeElement.ownerDocument.activeElement as HTMLElement | null;
    this.focusableElements()[0]?.focus();
  }



  /**
   * Keeps Tab and Shift+Tab within the active modal.
   * @param event Keyboard event from the dialog.
   */
  @HostListener('keydown', ['$event'])
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const elements = this.focusableElements();
    const active = this.element.nativeElement.ownerDocument.activeElement as HTMLElement;
    const index = elements.indexOf(active);
    const next = event.shiftKey ? index - 1 : index + 1;
    if (next >= 0 && next < elements.length) return;
    event.preventDefault();
    (event.shiftKey ? elements.at(-1) : elements[0])?.focus();
  }



  /** Restores focus to the previous control when the modal closes. */
  ngOnDestroy(): void {
    this.previousFocus?.focus();
  }



  /**
   * Lists enabled interactive elements in keyboard order.
   * @returns The dialog's enabled focus targets.
   */
  private focusableElements(): HTMLElement[] {
    return Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
    ));
  }
}
