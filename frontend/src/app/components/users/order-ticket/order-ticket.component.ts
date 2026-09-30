import {
ChangeDetectionStrategy,
Component,
inject,
signal
} from '@angular/core';

import { CommonModule } from '@angular/common';

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
import { OrderResponse } from '../../../core/models/order.model';

@Component({
selector: 'app-order-ticket',
standalone: true,
imports: [CommonModule, ReactiveFormsModule],
templateUrl: './order-ticket.component.html',
styleUrl: './order-ticket.component.css',
changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderTicketComponent {
private readonly formBuilder = inject(FormBuilder);
private readonly accountContextService = inject(AccountContextService);
private readonly orderService = inject(OrderService);
private readonly apiErrorMessageService = inject(ApiErrorMessageService);

readonly isSubmitting = signal(false);
readonly errorMessage = signal<string | null>(null);
readonly success = signal<OrderResponse | null>(null);

readonly form = this.formBuilder.nonNullable.group({
symbol: [
'',
[
Validators.required,
this.nonWhitespaceValidator
]
],


side: [
  'BUY' as 'BUY' | 'SELL',
  [Validators.required]
],

quantity: [
  '',
  [
    Validators.required,
    this.positiveIntegerValidator
  ]
],

price: [
  '',
  [
    Validators.required,
    this.priceValidator
  ]
]


});

get accountReference(): string {
return this.accountContextService
.getCurrentAccount()
.accountReference;
}

onSubmit(): void {
this.form.markAllAsTouched();


if (this.form.invalid || this.isSubmitting()) {
  return;
}

this.isSubmitting.set(true);
this.errorMessage.set(null);
this.success.set(null);

const idempotencyKey =
  typeof crypto !== 'undefined' &&
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

this.orderService
  .placeOrder({
    accountId:
      this.accountContextService
        .getCurrentAccount()
        .accountNumericId,

    symbol:
      this.form.controls.symbol.value
        .trim()
        .toUpperCase(),

    side: this.form.controls.side.value,

    quantity:
      Number(this.form.controls.quantity.value),

    price:
      Number(this.form.controls.price.value),

    idempotencyKey
  })
  .subscribe({
    next: (response) => {
      this.success.set(response);
      this.isSubmitting.set(false);
    },

    error: (error: unknown) => {
      this.errorMessage.set(
        this.apiErrorMessageService.getMessage(error)
      );

      this.isSubmitting.set(false);
    }
  });


}

onReset(): void {
this.form.reset({
symbol: '',
side: 'BUY',
quantity: '',
price: ''
});


this.errorMessage.set(null);
this.success.set(null);


}

getSymbolError(): string | null {
const control = this.form.controls.symbol;


if (!control.touched) {
  return null;
}

if (
  control.hasError('required') ||
  control.hasError('whitespace')
) {
  return 'Symbol is required.';
}

return null;


}

getQuantityError(): string | null {
const control = this.form.controls.quantity;


if (!control.touched) {
  return null;
}

if (
  control.hasError('required') ||
  control.hasError('invalidQuantity')
) {
  return 'Enter a whole number greater than zero.';
}

return null;


}

getPriceError(): string | null {
const control = this.form.controls.price;


if (!control.touched) {
  return null;
}

if (
  control.hasError('required') ||
  control.hasError('invalidPrice')
) {
  return 'Enter a price greater than zero with up to two decimal places.';
}

if (control.hasError('tooManyDecimals')) {
  return 'Use at most two decimal places.';
}

return null;


}

private nonWhitespaceValidator(
control: AbstractControl<string>
): ValidationErrors | null {
return control.value.trim().length > 0
? null
: { whitespace: true };
}

private positiveIntegerValidator(
control: AbstractControl<string>
): ValidationErrors | null {
const value = control.value.trim();


if (!/^\d+$/.test(value)) {
  return { invalidQuantity: true };
}

return Number(value) > 0
  ? null
  : { invalidQuantity: true };


}

private priceValidator(
control: AbstractControl<string>
): ValidationErrors | null {
const value = control.value.trim();


if (!/^\d+(\.\d+)?$/.test(value)) {
  return { invalidPrice: true };
}

const decimalMatch = value.match(/\.(\d+)/);

if (
  decimalMatch &&
  decimalMatch[1].length > 2
) {
  return { tooManyDecimals: true };
}

return Number(value) > 0
  ? null
  : { invalidPrice: true };

}
}
