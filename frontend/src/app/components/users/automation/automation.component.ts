import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AutomationStatus, AutomationStrategy, CreateStrategyRequest, OrderOutcome } from '../../../core/models/advice.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AdviceService } from '../../../core/services/advice.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { HomeCurrencyService } from '../../../core/services/home-currency.service';
import { ToastService } from '../../../core/ui/toast.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { IconComponent } from '../shared/icon/icon.component';
import { MascotComponent } from '../shared/mascot/mascot.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { SelectComponent, SelectOption } from '../shared/select/select.component';

const OUTCOME: Record<OrderOutcome, { label: string; hint: string }> = {
  STRATEGY_TRIGGERED: { label: 'Triggered', hint: 'The rule fired. No order yet.' },
  ORDER_SUBMITTED: { label: 'Order sent', hint: 'The trading service accepted the order.' },
  ORDER_REJECTED: { label: 'Rejected', hint: 'The trading service refused the order.' },
  ORDER_SUBMISSION_FAILED: { label: 'Failed', hint: 'The order could not be sent; its outcome is unknown.' }
};

type StrategyType = CreateStrategyRequest['type'];

/**
 * Automated trading. A customer sets up a rule (it starts OFF), then switches it on; from then on it places real
 * orders through the same trading service as an order placed by hand. Switching on asks for an explicit confirmation.
 */
@Component({
  selector: 'app-automation',
  standalone: true,
  imports: [DatePipe, IconComponent, MascotComponent, EmptyStateComponent, ModalComponent, SelectComponent],
  templateUrl: './automation.component.html',
  styleUrl: './automation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AutomationComponent {
  private readonly service = inject(AdviceService);
  private readonly errors = inject(ApiErrorMessageService);
  private readonly accountContext = inject(AccountContextService);
  private readonly toast = inject(ToastService);
  private readonly home = inject(HomeCurrencyService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<AutomationStatus | null>(null);
  protected readonly busy = signal(false);

  protected readonly strategies = computed(() => this.status()?.strategies ?? []);
  protected readonly results = computed(() => this.status()?.results ?? []);
  protected readonly accountId = computed(() => this.accountContext.getCurrentAccount().accountNumericId);

  // ---- the new-strategy dialog
  protected readonly creating = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly type = signal<StrategyType>('MA_CROSSOVER');
  protected readonly symbol = signal('');
  protected readonly quantity = signal('10');
  protected readonly shortPeriod = signal('20');
  protected readonly longPeriod = signal('50');
  protected readonly period = signal('20');
  protected readonly multiplier = signal('2');

  protected readonly typeOptions: SelectOption[] = [
    { value: 'MA_CROSSOVER', label: 'Moving-average crossover', hint: 'Buys when the short average rises above the long one, sells when it falls below' },
    { value: 'BOLLINGER_BANDS', label: 'Bollinger bands', hint: 'Buys when the price drops below the lower band, sells above the upper band' }
  ];
  protected readonly symbolOptions = computed<SelectOption[]>(() =>
    this.home.instrumentList().filter((instrument) => instrument.tradable !== false).map((instrument) => ({
      value: instrument.symbol, label: instrument.symbol, hint: instrument.name
    }))
  );

  // ---- confirmations
  protected readonly confirmingOn = signal<AutomationStrategy | null>(null);
  protected readonly acknowledged = signal(false);
  protected readonly removing = signal<AutomationStrategy | null>(null);

  constructor() {
    this.home.ensureLoaded();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.automationStatus().subscribe({
      next: (status) => {
        this.status.set(status);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.errors.getMessage(error));
        this.loading.set(false);
      }
    });
  }

  /** Quietly refresh the list after a change, without the loading skeleton. */
  private refresh(): void {
    this.service.automationStatus().subscribe({ next: (status) => this.status.set(status), error: () => undefined });
  }

  protected outcome(value: OrderOutcome): { label: string; hint: string } {
    return OUTCOME[value];
  }

  protected typeLabel(type: string | null): string {
    return type === 'MA_CROSSOVER' ? 'Moving-average crossover' : type === 'BOLLINGER_BANDS' ? 'Bollinger bands' : 'Unknown';
  }

  /** What the rule does, in words a customer can check before turning it on. */
  protected rule(strategy: AutomationStrategy): string {
    return strategy.type === 'MA_CROSSOVER'
      ? `Buys ${strategy.quantity} when the short average crosses above the long one, sells ${strategy.quantity} when it crosses below`
      : `Buys ${strategy.quantity} when the price falls below the lower band, sells ${strategy.quantity} when it rises above the upper band`;
  }

  protected stateOf(strategy: AutomationStrategy): 'On' | 'Off' | 'Invalid' {
    if (strategy.problems.length > 0) {
      return 'Invalid';
    }
    return strategy.enabled ? 'On' : 'Off';
  }

  // ---- create
  protected openCreate(): void {
    this.formError.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected create(): void {
    const request = this.buildRequest();
    if (typeof request === 'string') {
      this.formError.set(request);
      return;
    }
    this.busy.set(true);
    this.service.createStrategy(request).subscribe({
      next: () => {
        this.busy.set(false);
        this.creating.set(false);
        this.toast.show('Strategy created. It is off until you switch it on.');
        this.refresh();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.formError.set(this.errors.getMessage(error));
      }
    });
  }

  private buildRequest(): CreateStrategyRequest | string {
    if (!this.symbol()) {
      return 'Choose an instrument.';
    }
    const quantity = Number(this.quantity());
    if (!Number.isInteger(quantity) || quantity < 1) {
      return 'Quantity must be a whole number, 1 or more.';
    }
    const base = { accountId: this.accountId(), symbol: this.symbol(), quantity };
    if (this.type() === 'MA_CROSSOVER') {
      const short = Number(this.shortPeriod());
      const long = Number(this.longPeriod());
      if (!Number.isInteger(short) || !Number.isInteger(long) || short < 1 || long <= short) {
        return 'The long period must be a whole number above the short period.';
      }
      return { ...base, type: 'MA_CROSSOVER', shortPeriod: short, longPeriod: long };
    }
    const period = Number(this.period());
    const multiplier = Number(this.multiplier());
    if (!Number.isInteger(period) || period < 2) {
      return 'The period must be a whole number, 2 or more.';
    }
    if (!(multiplier > 0)) {
      return 'The multiplier must be above zero.';
    }
    return { ...base, type: 'BOLLINGER_BANDS', period, multiplier };
  }

  protected set(field: 'quantity' | 'shortPeriod' | 'longPeriod' | 'period' | 'multiplier', value: string): void {
    this[field].set(value);
  }

  // ---- switch on / off
  protected toggle(strategy: AutomationStrategy): void {
    if (this.busy()) {
      return;
    }
    if (strategy.enabled) {
      this.apply(strategy, false);
      return;
    }
    this.acknowledged.set(false);
    this.confirmingOn.set(strategy);
  }

  protected confirmOn(): void {
    const strategy = this.confirmingOn();
    if (strategy && this.acknowledged()) {
      this.apply(strategy, true);
    }
  }

  private apply(strategy: AutomationStrategy, enabled: boolean): void {
    this.busy.set(true);
    this.service.setStrategyEnabled(strategy.id, enabled, enabled).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmingOn.set(null);
        this.toast.show(enabled ? `${strategy.symbol} strategy is on. It will place orders when its rule triggers.` : `${strategy.symbol} strategy is off.`,
          'success', 6000, enabled ? 'cheer' : 'wave');
        this.refresh();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.confirmingOn.set(null);
        this.toast.error(this.errors.getMessage(error));
        this.refresh();
      }
    });
  }

  // ---- remove
  protected askRemove(strategy: AutomationStrategy): void {
    this.removing.set(strategy);
  }

  protected confirmRemove(): void {
    const strategy = this.removing();
    if (!strategy) {
      return;
    }
    this.busy.set(true);
    this.service.removeStrategy(strategy.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.removing.set(null);
        this.toast.show('Strategy removed.');
        this.refresh();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.removing.set(null);
        this.toast.error(this.errors.getMessage(error));
      }
    });
  }
}
