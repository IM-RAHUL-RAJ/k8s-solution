import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, output, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

/**
 * A centred dialog over a blurred backdrop. Escape and a click on the backdrop close it; focus moves in
 * on open and Tab stays inside. Put the form in the body and the buttons in an element with class modal__actions.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="modal-backdrop" (mousedown)="onBackdrop($event)" data-testid="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId" #panel>
        <div class="modal__head">
          <h2 [id]="titleId">{{ title() }}</h2>
          <button type="button" class="icon-btn" (click)="closed.emit()" aria-label="Close" data-tip="Close" data-testid="modal-close">
            <app-icon name="close" />
          </button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .modal__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalComponent implements AfterViewInit {
  readonly title = input.required<string>();
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${nextId++}`;
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly previouslyFocused = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);

  ngAfterViewInit(): void {
    const first = this.focusable()[0];
    (first ?? this.panel().nativeElement).focus();
  }

  protected onBackdrop(event: MouseEvent): void {
    // Only a press on the backdrop itself, not one that started inside the dialog.
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closed.emit();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const items = this.focusable();
    if (items.length === 0) {
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Hands focus back to what opened the dialog. */
  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  private focusable(): HTMLElement[] {
    return Array.from(
      this.panel().nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')
    );
  }
}
