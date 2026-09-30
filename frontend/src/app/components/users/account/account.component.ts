import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AccountResponse, BalanceResponse, PositionResponse } from '../../../core/models/account.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AccountService } from '../../../core/services/account.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule],
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

  protected readonly totalValue = computed(() => {
    const cash = this.balance()?.cashBalance ?? 0;
    const positionsValue = this.positions().reduce(
      (sum, position) => sum + position.averageCost * position.quantity,
      0
    );
    return cash + positionsValue;
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
