import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { AccountContextService } from '../../../core/services/account-context.service';
import { OrderService } from '../../../core/services/order.service';
import { OrderHistoryEntry, OrderStatus } from '../../../core/models/order.model';

export type OrderFilter = 'ALL' | OrderStatus;
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';

// An order at NEW is the working state: the executor has not resolved it yet. The blotter
// re-reads order history while anything is working, and stops. Ten reads three seconds apart
// is a thirty second window (the executor normally resolves within seconds) and at most
// ten extra requests per placed order, not a load test that runs for as long as the tab is
// open. The user can press Refresh to open another window. Nothing here ever re-posts an order.
export const POLL_INTERVAL_MS = 3000;
export const MAX_POLL_ATTEMPTS = 10;

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  templateUrl: './order-history.component.html',
  styleUrl: './order-history.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderHistoryComponent implements OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly accountContext = inject(AccountContextService);
  private readonly errorMessageService = inject(ApiErrorMessageService);

  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly orders = signal<OrderHistoryEntry[]>([]);
  readonly pollAttempt = signal(0);
  readonly pollingStopped = signal(false);

  readonly filter = signal<OrderFilter>('ALL');

  readonly filters = computed(() => {
    const orders = this.orders();
    const count = (status: OrderStatus) => orders.filter((order) => order.status === status).length;
    return [
      { value: 'ALL' as OrderFilter, label: 'All', count: orders.length },
      { value: 'NEW' as OrderFilter, label: 'Working', count: count('NEW') },
      { value: 'FILLED' as OrderFilter, label: 'Filled', count: count('FILLED') },
      { value: 'REJECTED' as OrderFilter, label: 'Rejected', count: count('REJECTED') },
      { value: 'CANCELLED' as OrderFilter, label: 'Cancelled', count: count('CANCELLED') }
    ];
  });

  /** The table shows what the filter allows; polling and the banner always look at every order. */
  readonly visibleOrders = computed(() =>
    this.filter() === 'ALL' ? this.orders() : this.orders().filter((order) => order.status === this.filter())
  );

  readonly workingCount = computed(
    () => this.orders().filter((order) => order.status === 'NEW').length
  );

  readonly pollingMessage = computed(() => {
    const working = this.workingCount();
    if (working === 0) {
      return null;
    }

    const subject = working === 1 ? '1 order is' : `${working} orders are`;
    if (this.pollingStopped()) {
      return `${subject} still working. Automatic checking stopped after ${MAX_POLL_ATTEMPTS} attempts. Press Refresh to check again.`;
    }
    return `${subject} still working. Checking again shortly, attempt ${this.pollAttempt() + 1} of ${MAX_POLL_ATTEMPTS}.`;
  });

  constructor() {
    this.load();
  }

  /** The button the user can press. It opens a fresh polling window if anything is still working. */
  refreshOrders(): void {
    this.stopPolling();
    this.pollAttempt.set(0);
    this.pollingStopped.set(false);
    this.load();
  }

  setFilter(filter: OrderFilter): void {
    this.filter.set(filter);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private load(): void {
    const accountId = this.accountContext.getCurrentAccount().accountNumericId;
    this.refreshing.set(true);

    this.orderService.getOrderHistory(accountId).subscribe({
      next: (orders) => {
        // Newest first, rejections included: the rejection is the record that the desk tried.
        this.orders.set(
          [...orders].sort((left, right) => Date.parse(right.createdOn) - Date.parse(left.createdOn))
        );
        this.error.set(null);
        this.loading.set(false);
        this.refreshing.set(false);
        this.schedulePollIfWorking();
      },
      error: (error: unknown) => {
        this.error.set(this.errorMessageService.getMessage(error));
        this.loading.set(false);
        this.refreshing.set(false);
        this.stopPolling();
      }
    });
  }

  private schedulePollIfWorking(): void {
    this.stopPolling();

    if (this.workingCount() === 0) {
      this.pollAttempt.set(0);
      this.pollingStopped.set(false);
      return;
    }

    if (this.pollAttempt() >= MAX_POLL_ATTEMPTS) {
      this.pollingStopped.set(true);
      return;
    }

    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      this.pollAttempt.update((attempt) => attempt + 1);
      this.load();
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
