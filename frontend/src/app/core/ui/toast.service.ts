import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

/** Short messages that confirm an action ("Saved", "Funds added") and fade by themselves. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly list = signal<Toast[]>([]);
  readonly toasts = this.list.asReadonly();

  show(message: string, tone: Toast['tone'] = 'success', milliseconds = 3500): void {
    const toast: Toast = { id: this.nextId++, message, tone };
    // Most recent three only: a burst of saves must not pile up over the page.
    this.list.update((toasts) => [...toasts.slice(-2), toast]);
    setTimeout(() => this.dismiss(toast.id), milliseconds);
  }

  error(message: string): void {
    this.show(message, 'error', 6000);
  }

  dismiss(id: number): void {
    this.list.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}
