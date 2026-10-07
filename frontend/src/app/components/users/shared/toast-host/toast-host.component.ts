import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../../core/ui/toast.service';

/** Draws the toasts. Placed once, in the app shell. Polite live region: a screen reader announces each without interrupting. */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `
    <div class="toasts" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [attr.data-tone]="toast.tone" role="status" data-testid="toast">
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toasts {
        position: fixed;
        z-index: 200;
        right: 16px;
        bottom: 16px;
        display: grid;
        gap: 8px;
        max-width: min(360px, calc(100vw - 32px));
      }
      .toast {
        padding: 12px 16px;
        border-radius: var(--r-md);
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-md);
        font-weight: 500;
        animation: toastIn 0.3s var(--ease);
      }
      .toast[data-tone='success'] {
        border-left: 4px solid var(--ok);
      }
      .toast[data-tone='error'] {
        border-left: 4px solid var(--reject);
      }
      .toast[data-tone='info'] {
        border-left: 4px solid var(--accent);
      }
      @keyframes toastIn {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.96);
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
