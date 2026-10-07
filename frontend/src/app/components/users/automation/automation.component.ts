import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AutomationStatus, OrderOutcome } from '../../../core/models/advice.model';
import { AdviceService } from '../../../core/services/advice.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { IconComponent } from '../shared/icon/icon.component';
import { MascotComponent } from '../shared/mascot/mascot.component';

const OUTCOME: Record<OrderOutcome, { label: string; hint: string }> = {
  STRATEGY_TRIGGERED: { label: 'Triggered', hint: 'The rule fired. No order yet.' },
  ORDER_SUBMITTED: { label: 'Order sent', hint: 'The trading service accepted the order.' },
  ORDER_REJECTED: { label: 'Rejected', hint: 'The trading service refused the order.' },
  ORDER_SUBMISSION_FAILED: { label: 'Failed', hint: 'The order could not be sent; its outcome is unknown.' }
};

/**
 * What automated trading is set to do for the customer's accounts, and what it has done lately. Read only:
 * strategies are set by configuration, and every order goes through the same trading service as one placed by hand.
 */
@Component({
  selector: 'app-automation',
  standalone: true,
  imports: [DatePipe, IconComponent, MascotComponent, EmptyStateComponent],
  templateUrl: './automation.component.html',
  styleUrl: './automation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AutomationComponent {
  private readonly service = inject(AdviceService);
  private readonly errors = inject(ApiErrorMessageService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<AutomationStatus | null>(null);

  protected readonly strategies = computed(() => this.status()?.strategies ?? []);
  protected readonly results = computed(() => this.status()?.results ?? []);

  constructor() {
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

  protected outcome(value: OrderOutcome): { label: string; hint: string } {
    return OUTCOME[value];
  }

  protected typeLabel(type: string | null): string {
    return type === 'MA_CROSSOVER' ? 'Moving-average crossover' : type === 'BOLLINGER_BANDS' ? 'Bollinger bands' : 'Unknown';
  }

  /** "Active" only when automation is running, the strategy is on, and the definition is valid. */
  protected stateOf(strategy: { enabled: boolean; problems: string[] }): 'Active' | 'Off' | 'Invalid' {
    if (strategy.problems.length > 0) {
      return 'Invalid';
    }
    return strategy.enabled && this.status()?.running ? 'Active' : 'Off';
  }
}
