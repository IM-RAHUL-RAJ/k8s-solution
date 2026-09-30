import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AccountResponse, BalanceResponse, PositionResponse } from '../../../core/models/account.model';
import { OrderHistoryEntry } from '../../../core/models/order.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AccountService } from '../../../core/services/account.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { OrderService } from '../../../core/services/order.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  private readonly accountService = inject(AccountService);
  private readonly orderService = inject(OrderService);
  private readonly accountContext = inject(AccountContextService);
  private readonly apiErrorMessageService = inject(ApiErrorMessageService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly account = signal<AccountResponse | null>(null);
  protected readonly balance = signal<BalanceResponse | null>(null);
  protected readonly positions = signal<PositionResponse[]>([]);
  protected readonly orders = signal<OrderHistoryEntry[]>([]);

  protected readonly recentOrders = computed(() =>
    [...this.orders()]
      .sort((left, right) => Date.parse(right.createdOn) - Date.parse(left.createdOn))
      .slice(0, 5)
  );

  protected readonly workingOrders = computed(
    () => this.orders().filter((order) => order.status === 'NEW').length
  );

  constructor() {
    this.loadDashboard();
  }

  protected loadDashboard(): void {
    const current = this.accountContext.getCurrentAccount();

    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      account: this.accountService.getAccount(current.accountNumericId),
      balance: this.accountService.getBalance(current.accountNumericId),
      positions: this.accountService.getPositions(current.accountNumericId),
      orders: this.orderService.getOrderHistory(current.accountNumericId)
    }).subscribe({
      next: (result) => {
        this.account.set(result.account);
        this.balance.set(result.balance);
        this.positions.set(result.positions);
        this.orders.set(result.orders);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.apiErrorMessageService.getMessage(error));
        this.loading.set(false);
      }
    });
  }

  protected statusMarker(status: string): string {
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
}
