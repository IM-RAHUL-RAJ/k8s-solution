import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { AccountContextService } from '../../../core/services/account-context.service';
import { OrderService } from '../../../core/services/order.service';
import { OrderResponse, OrderSide } from '../../../core/models/order.model';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';

// The trade contract bounds a symbol at 1 to 20 characters. Anything richer is the API's call.
const SYMBOL_PATTERN = /^\S{1,20}$/;

function positiveIntegerValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  return /^\d+$/.test(value) && Number(value) > 0 ? null : { invalidQuantity: true };
}

function priceValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return { invalidPrice: true };
  }
  if ((value.split('.')[1] ?? '').length > 2) {
    return { tooManyDecimals: true };
  }
  return Number(value) > 0 ? null : { invalidPrice: true };
}

function symbolValidator(control: AbstractControl<string>): ValidationErrors | null {
  return SYMBOL_PATTERN.test(control.value.trim()) ? null : { invalidSymbol: true };
}

@Component({
  selector: 'app-order-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  templateUrl: './order-ticket.component.html',
  styleUrl: './order-ticket.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderTicketComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly accountContextService = inject(AccountContextService);
  private readonly orderService = inject(OrderService);
  private readonly apiErrorMessageService = inject(ApiErrorMessageService);

  // Reused only when the outcome of a post is unknown (the response never arrived), so a
  // retry cannot place a second order. Any definite answer clears it.
  private pendingIdempotencyKey: string | null = null;

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly success = signal<OrderResponse | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    symbol: ['', [Validators.required, symbolValidator]],
    side: ['BUY' as OrderSide, [Validators.required]],
    quantity: ['', [Validators.required, positiveIntegerValidator]],
    price: ['', [Validators.required, priceValidator]]
  });

  /** The account the session may trade, rendered read-only. Never an editable field. */
  readonly accountReference = computed(() => this.accountContextService.getCurrentAccount().accountReference);

  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.success.set(null);

    this.pendingIdempotencyKey ??= this.newIdempotencyKey();

    this.orderService
      .placeOrder({
        accountId: this.accountContextService.getCurrentAccount().accountNumericId,
        symbol: this.form.controls.symbol.value.trim().toUpperCase(),
        side: this.form.controls.side.value,
        quantity: Number(this.form.controls.quantity.value),
        price: Number(this.form.controls.price.value),
        idempotencyKey: this.pendingIdempotencyKey
      })
      .subscribe({
        next: (response) => {
          // What comes back is the state at acceptance, usually NEW. It is shown as it is:
          // execution is asynchronous and the blotter brings the row up to date.
          this.pendingIdempotencyKey = null;
          this.success.set(response);
          this.isSubmitting.set(false);
        },
        error: (error: unknown) => {
          const outcomeUnknown = error instanceof HttpErrorResponse && error.status === 0;
          if (!outcomeUnknown) {
            this.pendingIdempotencyKey = null;
          }
          this.errorMessage.set(this.apiErrorMessageService.getMessage(error));
          this.isSubmitting.set(false);
        }
      });
  }

  onReset(): void {
    this.form.reset({ symbol: '', side: 'BUY', quantity: '', price: '' });
    this.pendingIdempotencyKey = null;
    this.errorMessage.set(null);
    this.success.set(null);
  }

  selectSide(side: OrderSide): void {
    this.form.controls.side.setValue(side);
  }

  toggleSide(): void {
    this.selectSide(this.form.controls.side.value === 'BUY' ? 'SELL' : 'BUY');
  }

  getSymbolError(): string | null {
    const control = this.form.controls.symbol;
    if (!control.touched || control.valid) {
      return null;
    }
    return 'Enter a symbol of up to 20 characters, with no spaces.';
  }

  getQuantityError(): string | null {
    const control = this.form.controls.quantity;
    if (!control.touched || control.valid) {
      return null;
    }
    return 'Enter a whole number above zero.';
  }

  getPriceError(): string | null {
    const control = this.form.controls.price;
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('tooManyDecimals')) {
      return 'Use at most two decimal places.';
    }
    return 'Enter a price above zero.';
  }

  private newIdempotencyKey(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  }
}
