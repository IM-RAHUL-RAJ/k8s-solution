import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TradeAdvice } from '../../../core/models/advice.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AdviceService } from '../../../core/services/advice.service';
import { AdviceComponent } from './advice.component';

describe('AdviceComponent', () => {
  const advice = vi.fn();
  const item = (symbol: string, signal: TradeAdvice['signal'], reasoning = ['because']): TradeAdvice => ({
    symbol, signal, reasoning, timestamp: '2026-10-07T12:00:00Z'
  });
  const sample = () => of([
    item('AAPL', 'BUY', ['Latest close is above the average']),
    item('MSFT', 'HOLD'),
    item('NVDA', 'INSUFFICIENT_DATA', ['Required: 50 observations.', 'Available: 17.'])
  ]);

  async function build(result: unknown = sample()) {
    advice.mockReset().mockReturnValue(result);
    await TestBed.configureTestingModule({
      imports: [AdviceComponent],
      providers: [
        provideRouter([]),
        { provide: AdviceService, useValue: { advice } },
        { provide: AccountContextService, useValue: { getCurrentAccount: () => ({ accountNumericId: 3 }) } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(AdviceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  it('asks for the own account and shows each signal with its reasons', async () => {
    const fixture = await build();

    expect(advice).toHaveBeenCalledWith(3);
    expect(el(fixture, 'advice-AAPL')?.textContent).toContain('Buy');
    expect(el(fixture, 'advice-AAPL')?.textContent).toContain('Latest close is above the average');
    expect(el(fixture, 'advice-NVDA')?.textContent).toContain('No signal');
    expect(el(fixture, 'advice-NVDA')?.textContent).toContain('Available: 17.');
  });

  it('says it is advice only', async () => {
    const fixture = await build();

    expect(fixture.nativeElement.textContent).toContain('never places an order');
    expect(el(fixture, 'advice-disclaimer')?.textContent).toContain('not a recommendation to trade');
  });

  it('filters by signal', async () => {
    const fixture = await build();

    el(fixture, 'advice-filter-HOLD')!.click();
    fixture.detectChanges();

    expect(el(fixture, 'advice-MSFT')).not.toBeNull();
    expect(el(fixture, 'advice-AAPL')).toBeNull();
  });

  it('shows an empty state with nothing held or watched', async () => {
    const fixture = await build(of([]));

    expect(el(fixture, 'advice-empty')).not.toBeNull();
  });

  it('shows the error with a retry', async () => {
    const fixture = await build(throwError(() => ({ status: 503 })));

    expect(el(fixture, 'advice-error')).not.toBeNull();
  });
});
