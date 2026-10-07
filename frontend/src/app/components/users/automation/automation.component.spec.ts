import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AutomationStatus } from '../../../core/models/advice.model';
import { AdviceService } from '../../../core/services/advice.service';
import { AutomationComponent } from './automation.component';

describe('AutomationComponent', () => {
  const automationStatus = vi.fn();
  const status = (running: boolean): AutomationStatus => ({
    running,
    strategies: [
      { id: 'aapl-ma', type: 'MA_CROSSOVER', accountId: 1, symbol: 'AAPL', quantity: 100, enabled: true, parameters: 'short 20, long 50', problems: [] },
      { id: 'bad', type: 'BOLLINGER_BANDS', accountId: 1, symbol: 'MSFT', quantity: 0, enabled: true, parameters: 'period 20, multiplier 2', problems: ['quantity must be at least 1'] }
    ],
    results: [
      { strategyId: 'aapl-ma', symbol: 'AAPL', accountId: 1, trigger: 'BUY', outcome: 'ORDER_SUBMITTED', orderId: 'o1', detail: 'status NEW', at: '2026-10-07T10:00:00Z' },
      { strategyId: 'aapl-ma', symbol: 'AAPL', accountId: 1, trigger: 'SELL', outcome: 'ORDER_SUBMISSION_FAILED', orderId: null, detail: 'HTTP 503', at: '2026-10-07T11:00:00Z' }
    ]
  });

  async function build(result: unknown) {
    automationStatus.mockReset().mockReturnValue(result);
    await TestBed.configureTestingModule({
      imports: [AutomationComponent],
      providers: [{ provide: AdviceService, useValue: { automationStatus } }]
    }).compileComponents();
    const fixture = TestBed.createComponent(AutomationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const all = (f: { nativeElement: HTMLElement }, id: string) => Array.from(f.nativeElement.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];

  it('says automation is running and marks valid enabled strategies Active, bad ones Invalid', async () => {
    const fixture = await build(of(status(true)));

    expect(el(fixture, 'automation-state')?.textContent).toContain('running');
    expect(all(fixture, 'strategy-state').map((node) => node.textContent?.trim())).toEqual(['Active', 'Invalid']);
    expect(fixture.nativeElement.textContent).toContain('quantity must be at least 1');
  });

  it('says it is switched off, and shows no strategy as Active', async () => {
    const fixture = await build(of(status(false)));

    expect(el(fixture, 'automation-state')?.textContent).toContain('switched off');
    expect(all(fixture, 'strategy-state').map((node) => node.textContent?.trim())).toEqual(['Off', 'Invalid']);
  });

  it('keeps a trigger apart from a trade: Order sent and Failed are different outcomes', async () => {
    const fixture = await build(of(status(true)));

    expect(all(fixture, 'result-outcome').map((node) => node.textContent?.trim())).toEqual(['Order sent', 'Failed']);
  });

  it('shows the error with a retry', async () => {
    const fixture = await build(throwError(() => ({ status: 500 })));

    expect(el(fixture, 'automation-error')).not.toBeNull();
  });
});
