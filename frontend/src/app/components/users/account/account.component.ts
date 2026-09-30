import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AccountResponse, BalanceResponse, PositionResponse } from '../../../core/models/account.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AccountService } from '../../../core/services/account.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { allocation } from '../../../core/stats/portfolio-stats';
import { AnimatedNumberComponent } from '../shared/animated-number/animated-number.component';
import { DonutChartComponent } from '../shared/donut-chart/donut-chart.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, RouterLink, AnimatedNumberComponent, DonutChartComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountComponent {
  private readonly accountService = inject(AccountService);
  private readonly accountContext = inject(AccountContextService);
  private readonly apiErrorMessageService = inject(ApiErrorMessageService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly account = signal<AccountResponse | null>(null);
  protected readonly balance = signal<BalanceResponse | null>(null);
  protected readonly positions = signal<PositionResponse[]>([]);

  protected readonly initials = computed(() =>
    (this.account()?.holderName ?? '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
  );

  /** Cost of what is held. The API gives average cost, so this is cost, not market value. */
  protected readonly invested = computed(() =>
    this.positions().reduce((sum, position) => sum + position.quantity * position.averageCost, 0)
  );

  protected readonly slices = computed(() => allocation(this.positions()));

  protected readonly rows = computed(() => {
    const total = this.invested();
    return [...this.positions()]
      .sort((left, right) => left.symbol.localeCompare(right.symbol))
      .map((position) => {
        const cost = position.quantity * position.averageCost;
        return { ...position, cost, share: total > 0 ? (cost / total) * 100 : 0 };
      });
  });

  constructor() {
    this.loadAccount();
  }

  protected loadAccount(): void {
    const accountId = this.accountContext.getCurrentAccount().accountNumericId;

    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      account: this.accountService.getAccount(accountId),
      balance: this.accountService.getBalance(accountId),
      positions: this.accountService.getPositions(accountId)
    }).subscribe({
      next: (result) => {
        this.account.set(result.account);
        this.balance.set(result.balance);
        this.positions.set(result.positions);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.apiErrorMessageService.getMessage(error));
        this.loading.set(false);
      }
    });
  }
}
