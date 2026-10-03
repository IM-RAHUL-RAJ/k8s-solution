import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PositionResponse } from '../../../core/models/account.model';
import { WatchlistEntry } from '../../../core/models/instrument.model';
import { OrderHistoryEntry } from '../../../core/models/order.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AccountService } from '../../../core/services/account.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { HomeCurrencyService } from '../../../core/services/home-currency.service';
import { InstrumentService } from '../../../core/services/instrument.service';
import { OrderService } from '../../../core/services/order.service';

/** The instruments the account follows, from the platform's watchlist table. */
@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WatchlistComponent {
  private readonly instrumentService = inject(InstrumentService);
  private readonly accountService = inject(AccountService);
  private readonly orderService = inject(OrderService);
  private readonly accountContext = inject(AccountContextService);
  private readonly errorMessages = inject(ApiErrorMessageService);
  protected readonly home = inject(HomeCurrencyService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly entries = signal<WatchlistEntry[]>([]);
  protected readonly positions = signal<PositionResponse[]>([]);
  protected readonly orders = signal<OrderHistoryEntry[]>([]);
  protected readonly busySymbol = signal<string | null>(null);
  protected readonly pick = signal('');
  protected readonly adding = signal(false);

  /** Tradable instruments that are not already watched, for the add control. */
  protected readonly addable = computed(() => {
    const watched = new Set(this.entries().map((entry) => entry.symbol));
    return this.home.instrumentList().filter((item) => item.tradable && !watched.has(item.symbol));
  });

  /** One card per watched instrument, with what the customer already has with it. */
  protected readonly cards = computed(() =>
    this.entries().map((entry) => {
      const held = this.positions().find((position) => position.symbol === entry.symbol)?.quantity ?? 0;
      const lastFill = this.orders()
        .filter((order) => order.symbol === entry.symbol && order.status === 'FILLED' && order.executedPrice !== null)
        .sort((left, right) => Date.parse(right.createdOn) - Date.parse(left.createdOn))[0];
      return {
        ...entry,
        held,
        lastFillHome: lastFill ? this.home.toHome(lastFill.executedPrice as number, entry.symbol) : null,
        lastFillOn: lastFill?.createdOn ?? null,
        accent: this.accentFor(entry.assetClass)
      };
    })
  );

  constructor() {
    this.home.ensureLoaded();
    this.load();
  }

  protected load(): void {
    const accountId = this.accountContext.getCurrentAccount().accountNumericId;
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      entries: this.instrumentService.getWatchlist(accountId),
      positions: this.accountService.getPositions(accountId).pipe(catchError(() => of([] as PositionResponse[]))),
      orders: this.orderService.getOrderHistory(accountId).pipe(catchError(() => of([] as OrderHistoryEntry[])))
    }).subscribe({
      next: ({ entries, positions, orders }) => {
        this.entries.set(entries);
        this.positions.set(positions);
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.errorMessages.getMessage(error));
        this.loading.set(false);
      }
    });
  }

  protected add(): void {
    const symbol = this.pick();
    if (!symbol || this.adding()) {
      return;
    }
    this.adding.set(true);
    this.actionError.set(null);

    this.instrumentService.addToWatchlist(this.accountContext.getCurrentAccount().accountNumericId, symbol).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.pick.set('');
        this.adding.set(false);
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessages.getMessage(error));
        this.adding.set(false);
      }
    });
  }

  protected remove(symbol: string): void {
    if (this.busySymbol() !== null) {
      return;
    }
    this.busySymbol.set(symbol);
    this.actionError.set(null);

    this.instrumentService
      .removeFromWatchlist(this.accountContext.getCurrentAccount().accountNumericId, symbol)
      .subscribe({
        next: (entries) => {
          this.entries.set(entries);
          this.busySymbol.set(null);
        },
        error: (error: unknown) => {
          this.actionError.set(this.errorMessages.getMessage(error));
          this.busySymbol.set(null);
        }
      });
  }

  protected label(assetClass: string): string {
    const labels: Record<string, string> = {
      US_EQUITY: 'US equity',
      INDIAN_EQUITY: 'Indian equity',
      FX: 'FX',
      CRYPTO: 'Crypto'
    };
    return labels[assetClass] ?? assetClass.replace('_', ' ').toLowerCase();
  }

  /** A colour per asset class, so a glance tells equities from FX from crypto. */
  private accentFor(assetClass: string): string {
    switch (assetClass) {
      case 'US_EQUITY':
        return 'blue';
      case 'INDIAN_EQUITY':
        return 'amber';
      case 'FX':
        return 'teal';
      case 'CRYPTO':
        return 'violet';
      default:
        return 'green';
    }
  }
}
