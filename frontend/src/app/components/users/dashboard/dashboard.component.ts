import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AccountResponse, BalanceResponse, PositionResponse } from '../../../core/models/account.model';
import { OrderHistoryEntry } from '../../../core/models/order.model';
import { AuthService } from '../../../core/auth/auth.service';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AccountService } from '../../../core/services/account.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { OrderService } from '../../../core/services/order.service';
import { AnimatedNumberComponent } from '../shared/animated-number/animated-number.component';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent, AnimatedNumberComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  private readonly accountService = inject(AccountService);
  private readonly orderService = inject(OrderService);
  private readonly accountContext = inject(AccountContextService);
  private readonly apiErrorMessageService = inject(ApiErrorMessageService);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly account = signal<AccountResponse | null>(null);
  protected readonly balance = signal<BalanceResponse | null>(null);
  protected readonly positions = signal<PositionResponse[]>([]);
  protected readonly orders = signal<OrderHistoryEntry[]>([]);

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = this.account()?.holderName.split(' ')[0] ?? this.auth.user()?.username;
    return name ? `${part}, ${name}` : part;
  });

  protected readonly initials = computed(() =>
    (this.account()?.holderName ?? this.auth.user()?.username ?? '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
  );

  /** What the current holdings cost. The API returns average cost, not a live price, so this is cost, not market value. */
  protected readonly invested = computed(() =>
    this.positions().reduce((sum, position) => sum + position.quantity * position.averageCost, 0)
  );

  /** Each holding's share of cost, for the bar beside it. */
  protected readonly holdingRows = computed(() => {
    const total = this.invested();
    return this.holdings().map((position) => {
      const cost = position.quantity * position.averageCost;
      return { ...position, cost, share: total > 0 ? (cost / total) * 100 : 0 };
    });
  });

  protected readonly recentOrders = computed(() =>
    [...this.orders()]
      .sort((left, right) => Date.parse(right.createdOn) - Date.parse(left.createdOn))
      .slice(0, 5)
  );

  protected readonly holdings = computed(() =>
    [...this.positions()].sort((left, right) => left.symbol.localeCompare(right.symbol)).slice(0, 6)
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
}
