import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ALERT_CONDITIONS, AlertCondition, PriceAlert } from '../../../core/models/alert.model';
import { InstrumentInfo } from '../../../core/models/instrument.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AlertService } from '../../../core/services/alert.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { ModalComponent } from '../shared/modal/modal.component';

function positiveAmount(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  return /^\d+(\.\d{1,4})?$/.test(value) && Number(value) > 0 ? null : { amount: true };
}

/**
 * Create or edit an alert, written as a sentence: "If price of [instrument] is [operator] than [price] USD".
 * It talks to the alert API itself and tells the page what was saved.
 */
@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './alert-dialog.component.html',
  styleUrl: './alert-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlertDialogComponent {
  private readonly alertService = inject(AlertService);
  private readonly accountContext = inject(AccountContextService);
  private readonly errorMessages = inject(ApiErrorMessageService);
  private readonly formBuilder = inject(FormBuilder);

  /** Present when editing. */
  readonly alert = input<PriceAlert | null>(null);
  readonly instruments = input.required<InstrumentInfo[]>();
  /** A symbol to start with, for "Set a price alert" links. */
  readonly initialSymbol = input('');
  readonly saved = output<PriceAlert>();
  readonly closed = output<void>();

  protected readonly conditions = ALERT_CONDITIONS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly listOpen = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    symbol: ['', [Validators.required]],
    condition: ['>=' as AlertCondition, [Validators.required]],
    price: ['', [Validators.required, positiveAmount]]
  });

  protected readonly editing = computed(() => this.alert() !== null);

  protected readonly matches = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.instruments()
      .filter((item) => term === '' || item.symbol.toLowerCase().includes(term) || item.name.toLowerCase().includes(term))
      .slice(0, 50);
  });

  private readonly chosenSymbol = signal('');
  protected readonly chosen = computed(() => this.instruments().find((item) => item.symbol === this.chosenSymbol()) ?? null);
  protected readonly currency = computed(() => this.chosen()?.currency ?? '');

  ngOnInit(): void {
    const existing = this.alert();
    if (existing) {
      this.form.setValue({ symbol: existing.symbol, condition: existing.condition, price: String(existing.price) });
      this.choose(existing.symbol);
    } else if (this.initialSymbol()) {
      this.choose(this.initialSymbol());
    }
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.listOpen.set(true);
    // Typing again un-chooses the instrument until one is picked from the list.
    if (this.chosenSymbol() !== '' && value.trim().toUpperCase() !== this.chosenSymbol()) {
      this.chosenSymbol.set('');
      this.form.controls.symbol.setValue('');
    }
  }

  protected choose(symbol: string): void {
    this.chosenSymbol.set(symbol);
    this.form.controls.symbol.setValue(symbol);
    this.search.set(symbol);
    this.listOpen.set(false);
  }

  protected save(): void {
    this.error.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const value = this.form.getRawValue();
    const accountId = this.accountContext.getCurrentAccount().accountNumericId;
    const body = { symbol: value.symbol.trim().toUpperCase(), condition: value.condition, price: Number(value.price) };
    const existing = this.alert();

    this.saving.set(true);
    const request = existing
      ? this.alertService.updateAlert(accountId, existing.id, body)
      : this.alertService.createAlert(accountId, body);
    request.subscribe({
      next: (alert) => {
        this.saving.set(false);
        this.saved.emit(alert);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.messageFor(error));
      }
    });
  }

  private messageFor(error: unknown): string {
    // The server says why a level is refused (already reached, too many alerts): that is worth showing as it is.
    if (error instanceof HttpErrorResponse && (error.status === 422 || error.status === 409) && typeof error.error?.message === 'string'
      && error.error.message !== 'Invalid input') {
      return error.error.message;
    }
    return this.errorMessages.getMessage(error);
  }
}
