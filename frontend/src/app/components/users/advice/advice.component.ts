import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdviceSignal, TradeAdvice } from '../../../core/models/advice.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AdviceService } from '../../../core/services/advice.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { IconComponent } from '../shared/icon/icon.component';
import { MascotComponent } from '../shared/mascot/mascot.component';

type Filter = 'ALL' | AdviceSignal;

const LABEL: Record<AdviceSignal, string> = { BUY: 'Buy', SELL: 'Sell', HOLD: 'Hold', INSUFFICIENT_DATA: 'No signal' };

/**
 * Research signals for what the customer holds and watches. Advice only: nothing on this page places an order.
 * Each card shows the signal and the figures behind it.
 */
@Component({
  selector: 'app-advice',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent, MascotComponent, EmptyStateComponent],
  templateUrl: './advice.component.html',
  styleUrl: './advice.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdviceComponent {
  private readonly service = inject(AdviceService);
  private readonly accountContext = inject(AccountContextService);
  private readonly errors = inject(ApiErrorMessageService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<TradeAdvice[]>([]);
  protected readonly filter = signal<Filter>('ALL');

  protected readonly tabs = computed(() => {
    const items = this.items();
    const count = (signal: AdviceSignal) => items.filter((item) => item.signal === signal).length;
    return [
      { id: 'ALL' as Filter, label: 'All', count: items.length },
      { id: 'BUY' as Filter, label: 'Buy', count: count('BUY') },
      { id: 'SELL' as Filter, label: 'Sell', count: count('SELL') },
      { id: 'HOLD' as Filter, label: 'Hold', count: count('HOLD') },
      { id: 'INSUFFICIENT_DATA' as Filter, label: 'No signal', count: count('INSUFFICIENT_DATA') }
    ];
  });

  protected readonly visible = computed(() => {
    const filter = this.filter();
    return this.items().filter((item) => filter === 'ALL' || item.signal === filter);
  });

  protected readonly asOf = computed(() => this.items()[0]?.timestamp ?? null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.advice(this.accountContext.getCurrentAccount().accountNumericId).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.errors.getMessage(error));
        this.loading.set(false);
      }
    });
  }

  protected setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  protected label(signal: AdviceSignal): string {
    return LABEL[signal];
  }

  protected mood(item: TradeAdvice): 'happy' | 'think' | 'wave' | 'sad' {
    return item.signal === 'BUY' ? 'happy' : item.signal === 'SELL' ? 'sad' : item.signal === 'HOLD' ? 'think' : 'wave';
  }
}
