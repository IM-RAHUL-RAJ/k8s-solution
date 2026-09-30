import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { AccountContextService } from '../../../core/services/account-context.service';
import { OrderService } from '../../../core/services/order.service';
import { OrderHistoryEntry } from '../../../core/models/order.model';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-history.component.html',
  styleUrl: './order-history.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderHistoryComponent implements OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly accountContext = inject(AccountContextService);
  private readonly errorMessageService = inject(ApiErrorMessageService);

  private pollSubscription: Subscription | null = null;
  private pollAttempt = 0;
  private readonly maxPollAttempts = 10;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orders = signal<OrderHistoryEntry[]>([]);
  readonly pollingMessage = signal<string | null>(null);

  constructor() {
    this.refreshOrders();
  }

  refreshOrders(): void {
    const accountId = this.accountContext.getCurrentAccount().accountNumericId;

    this.loading.set(true);
    this.error.set(null);

    this.orderService.getOrderHistory(accountId).subscribe({
      next: (orders) => {
        this.orders.set(
          [...orders].sort((left, right) => Date.parse(right.createdOn) - Date.parse(left.createdOn))
        );
        this.loading.set(false);
        this.updatePollingState();
      },
      error: (error: unknown) => {
        this.error.set(this.errorMessageService.getMessage(error));
        this.loading.set(false);
      }
    });
  }

  statusMarker(status: string): string {
    switch (status) {
      case 'NEW':
        return '●';
      case 'FILLED':
        return '◇';
      case 'REJECTED':
        return '—';
      case 'CANCELLED':
        return '○';
      default:
        return '•';
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private updatePollingState(): void {
    const newOrdersCount = this.orders().filter((order) => order.status === 'NEW').length;
    if (newOrdersCount === 0) {
      this.pollingMessage.set(null);
      this.stopPolling();
      return;
    }

    if (!this.pollSubscription) {
      this.startPolling();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollAttempt = 0;

    this.pollSubscription = interval(4000).subscribe(() => {
      const accountId = this.accountContext.getCurrentAccount().accountNumericId;

      if (this.pollAttempt >= this.maxPollAttempts) {
        this.pollingMessage.set('Stopped automatic refresh after bounded retries.');
        this.stopPolling();
        return;
      }

      this.pollAttempt += 1;
      this.orderService.getOrderHistory(accountId).subscribe({
        next: (orders) => {
          this.orders.set(
            [...orders].sort((left, right) => Date.parse(right.createdOn) - Date.parse(left.createdOn))
          );

          const remainingNew = this.orders().filter((order) => order.status === 'NEW').length;
          if (remainingNew > 0) {
            const plural = remainingNew === 1 ? 'order is' : 'orders are';
            this.pollingMessage.set(
              `${remainingNew} ${plural} still working. Checking again shortly, attempt ${this.pollAttempt} of ${this.maxPollAttempts}.`
            );
          } else {
            this.pollingMessage.set(null);
            this.stopPolling();
          }
        },
        error: () => {
          this.pollingMessage.set('Automatic polling paused due to an API error.');
          this.stopPolling();
        }
      });
    });
  }

  private stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }
}
