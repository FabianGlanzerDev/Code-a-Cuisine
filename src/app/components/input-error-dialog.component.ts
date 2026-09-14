import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FocusDialogDirective } from './focus-dialog.directive';

@Component({
  selector: 'app-input-error-dialog',
  imports: [FocusDialogDirective],
  templateUrl: './input-error-dialog.component.html',
  styleUrl: './input-error-dialog.component.css',
})
export class InputErrorDialogComponent {
  @Input() message = 'It looks like some ingredient quantities aren’t sufficient for your selected servings. Please add or adjust quantities and try again.';
  @Input() returnFocus: HTMLElement | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
}
