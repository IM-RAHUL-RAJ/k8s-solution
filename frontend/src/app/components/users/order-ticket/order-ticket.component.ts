import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { AccountService } from '../../../core/services/account.service';
import { OrderService } from '../../../core/services/order.service';
import { OrderDraft, OrderDraftService } from '../../../core/services/order-draft.service';
import { CURRENCIES, convertAmount, isSupportedCurrency, rateBetween } from '../../../core/config/currency-rates';
import { AccountResponse, BalanceResponse } from '../../../core/models/account.model';
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
  private readonly accountService = inject(AccountService);
  private readonly draftService = inject(OrderDraftService);

  readonly currencies = CURRENCIES;

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
    price: ['', [Validators.required, priceValidator]],
    // Converter only, never sent to the API. `currency` starts as the account currency.
    currency: ['USD'],
    convertTo: ['EUR']
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** What the customer is about to send, echoed back live. An estimate only: cash and holdings are checked by the API. */
  readonly summary = computed(() => {
    const value = this.formValue();
    const quantity = Number((value.quantity ?? '').trim());
    const price = Number((value.price ?? '').trim());
    const symbol = (value.symbol ?? '').trim().toUpperCase();
    const validNumbers =
      Number.isInteger(quantity) && quantity > 0 && Number.isFinite(price) && price > 0;

    return {
      side: value.side === 'SELL' ? 'Sell' : 'Buy',
      symbol,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
      price: Number.isFinite(price) && price > 0 ? price : null,
      estimate: validNumbers ? quantity * price : null
    };
  });


  // Account reference: the customer sees what statements and support quote, never the
  // internal numeric id. The id is only used inside requests.
  readonly account = signal<AccountResponse | null>(null);
  readonly accountFailed = signal(false);

  readonly accountReference = computed(() => {
    const account = this.account();
    if (account) {
      return account.accountId;
    }
    return this.accountFailed() ? 'Unavailable' : 'Loading...';
  });

  // The account's own currency. The trade API reads the limit price in it and converts to the
  // instrument's currency itself. Learned quietly on load; the amount is only shown on request.
  readonly accountCurrency = signal<string | null>(null);

  // Balance, on demand.
  readonly balance = signal<BalanceResponse | null>(null);
  readonly balanceLoading = signal(false);
  readonly balanceError = signal<string | null>(null);

  // Currency converter, using the same rate table as the trade API.
  /** What the user typed into the converter. Null means: follow the order estimate. */
  private readonly fxAmountOverride = signal<string | null>(null);

  readonly fxAmountText = computed(() => {
    const override = this.fxAmountOverride();
    if (override !== null) {
      return override;
    }
    const estimate = this.summary().estimate;
    return estimate !== null ? estimate.toFixed(2) : '';
  });

  readonly fxAmountIsEstimate = computed(() => this.fxAmountOverride() === null);
  readonly fxFrom = computed(() => this.formValue().currency ?? 'USD');
  readonly fxTo = computed(() => this.formValue().convertTo ?? 'EUR');
  readonly fxRate = computed(() => rateBetween(this.fxFrom(), this.fxTo()));

  readonly converted = computed(() => {
    const amount = Number(this.fxAmountText().trim());
    return Number.isFinite(amount) && amount > 0 ? convertAmount(this.fxFrom(), this.fxTo(), amount) : null;
  });

  /** The limit price as the instrument sees it, when the user has picked its currency. */
  readonly convertedPrice = computed(() => {
    const price = this.summary().price;
    return price !== null ? convertAmount(this.fxFrom(), this.fxTo(), price) : null;
  });

  constructor() {
    this.restoreDraft();

    // Remember the ticket while the user visits other tabs.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.draftService.save(this.form.getRawValue() as OrderDraft);
    });

    this.loadAccount();
  }

  private restoreDraft(): void {
    const draft = this.draftService.load();
    if (!draft) {
      return;
    }
    this.form.patchValue(
      {
        symbol: typeof draft.symbol === 'string' ? draft.symbol.slice(0, 20) : '',
        side: draft.side === 'SELL' ? 'SELL' : 'BUY',
        quantity: typeof draft.quantity === 'string' ? draft.quantity.slice(0, 12) : '',
        price: typeof draft.price === 'string' ? draft.price.slice(0, 16) : '',
        currency: isSupportedCurrency(draft.currency) ? draft.currency : 'USD',
        convertTo: isSupportedCurrency(draft.convertTo) ? draft.convertTo : 'EUR'
      }
    );
    if (draft.currency) {
      this.form.controls.currency.markAsDirty();
    }
  }

  private loadAccount(): void {
    const accountId = this.accountContextService.getCurrentAccount().accountNumericId;

    this.accountService.getAccount(accountId).subscribe({
      next: (account) => this.account.set(account),
      error: () => this.accountFailed.set(true)
    });

    this.accountService.getBalance(accountId).subscribe({
      next: (balance) => this.adoptAccountCurrency(balance.currency),
      error: () => undefined
    });
  }

  private adoptAccountCurrency(code: string): void {
    const currency = code?.trim().toUpperCase();
    if (!isSupportedCurrency(currency)) {
      return;
    }
    this.accountCurrency.set(currency);
    // Start the converter from the account currency unless the user already chose one.
    if (!this.form.controls.currency.dirty) {
      this.form.controls.currency.setValue(currency);
      if (this.form.controls.convertTo.value === currency) {
        this.form.controls.convertTo.setValue(currency === 'USD' ? 'EUR' : 'USD');
      }
    }
  }

  getBalance(): void {
    if (this.balanceLoading()) {
      return;
    }
    this.balanceLoading.set(true);
    this.balanceError.set(null);

    this.accountService.getBalance(this.accountContextService.getCurrentAccount().accountNumericId).subscribe({
      next: (balance) => {
        this.balance.set(balance);
        this.balanceLoading.set(false);
        this.adoptAccountCurrency(balance.currency);
      },
      error: (error: unknown) => {
        this.balanceError.set(this.apiErrorMessageService.getMessage(error));
        this.balanceLoading.set(false);
      }
    });
  }

  onFxAmountInput(value: string): void {
    this.fxAmountOverride.set(value);
  }

  useEstimate(): void {
    this.fxAmountOverride.set(null);
  }

  swapCurrencies(): void {
    const { currency, convertTo } = this.form.getRawValue();
    this.form.patchValue({ currency: convertTo, convertTo: currency });
    this.form.controls.currency.markAsDirty();
  }

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
          this.draftService.clear();
          if (this.balance() !== null) {
            this.getBalance();
          }
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
    const home = this.accountCurrency() ?? 'USD';
    this.form.reset({
      symbol: '',
      side: 'BUY',
      quantity: '',
      price: '',
      currency: home,
      convertTo: home === 'USD' ? 'EUR' : 'USD'
    });
    this.form.controls.currency.markAsPristine();
    this.draftService.clear();
    this.fxAmountOverride.set(null);
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
