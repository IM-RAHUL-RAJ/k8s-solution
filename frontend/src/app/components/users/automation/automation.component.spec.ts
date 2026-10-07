import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AutomationStatus, AutomationStrategy } from '../../../core/models/advice.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AdviceService } from '../../../core/services/advice.service';
import { HomeCurrencyService } from '../../../core/services/home-currency.service';
import { AutomationComponent } from './automation.component';

describe('AutomationComponent', () => {
  const automationStatus = vi.fn();
  const createStrategy = vi.fn();
  const setStrategyEnabled = vi.fn();
  const removeStrategy = vi.fn();

  const strategy = (overrides: Partial<AutomationStrategy> = {}): AutomationStrategy => ({
    id: '5', type: 'MA_CROSSOVER', accountId: 1, symbol: 'AAPL', quantity: 100, enabled: false,
    parameters: 'short 20, long 50', problems: [], collected: null, required: null, ...overrides
  });
  const status = (running: boolean, strategies: AutomationStrategy[] = [strategy()]): AutomationStatus => ({
    running,
    strategies,
    results: [
      { strategyId: '5', symbol: 'AAPL', accountId: 1, trigger: 'BUY', outcome: 'ORDER_SUBMITTED', orderId: 'o1', detail: 'status NEW', at: '2026-10-07T10:00:00Z' },
      { strategyId: '5', symbol: 'AAPL', accountId: 1, trigger: 'SELL', outcome: 'ORDER_SUBMISSION_FAILED', orderId: null, detail: 'HTTP 503', at: '2026-10-07T11:00:00Z' }
    ]
  });

  async function build(result: unknown) {
    automationStatus.mockReset().mockReturnValue(result);
    createStrategy.mockReset().mockReturnValue(of(strategy()));
    setStrategyEnabled.mockReset().mockReturnValue(of(strategy({ enabled: true })));
    removeStrategy.mockReset().mockReturnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [AutomationComponent],
      providers: [
        { provide: AdviceService, useValue: { automationStatus, createStrategy, setStrategyEnabled, removeStrategy } },
        { provide: AccountContextService, useValue: { getCurrentAccount: () => ({ accountNumericId: 1 }) } },
        {
          provide: HomeCurrencyService,
          useValue: { ensureLoaded: vi.fn(), instrumentList: signal([{ symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', assetClass: 'US_EQUITY', currency: 'USD', tradable: true }]) }
        }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(AutomationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const all = (f: { nativeElement: HTMLElement }, id: string) => Array.from(f.nativeElement.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];

  it('shows each strategy as On, Off or Invalid, with what its rule does', async () => {
    const fixture = await build(of(status(true, [
      strategy({ id: '1', enabled: true }), strategy({ id: '2' }), strategy({ id: '3', problems: ['quantity must be at least 1'] })
    ])));

    expect(all(fixture, 'strategy-state').map((node) => node.textContent?.trim())).toEqual(['On', 'Off', 'Invalid']);
    expect(fixture.nativeElement.textContent).toContain('Buys 100 when the short average crosses above the long one');
    expect(fixture.nativeElement.textContent).toContain('quantity must be at least 1');
  });

  it('says how many prices a running strategy has collected, and that it cannot act yet', async () => {
    const fixture = await build(of(status(true, [strategy({ enabled: true, collected: 12, required: 51 })])));

    expect(el(fixture, 'strategy-progress')?.textContent).toContain('12 of 51');
  });

  it('says when it is ready to act', async () => {
    const fixture = await build(of(status(true, [strategy({ enabled: true, collected: 51, required: 51 })])));

    expect(el(fixture, 'strategy-progress')?.textContent).toContain('ready to act');
  });

  it('says automation is switched off on the platform when the kill switch is set', async () => {
    const fixture = await build(of(status(false)));

    expect(el(fixture, 'automation-state')?.textContent).toContain('switched off on this platform');
  });

  it('asks for a confirmation before switching on, and will not proceed until it is acknowledged', async () => {
    const fixture = await build(of(status(true)));

    el(fixture, 'strategy-toggle')!.click();
    fixture.detectChanges();

    expect(el(fixture, 'confirm-on')?.textContent).toContain('real orders');
    expect(setStrategyEnabled).not.toHaveBeenCalled();
    expect((el(fixture, 'confirm-switch-on') as HTMLButtonElement).disabled).toBe(true);

    const ack = el(fixture, 'confirm-ack') as HTMLInputElement;
    ack.checked = true;
    ack.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    el(fixture, 'confirm-switch-on')!.click();
    fixture.detectChanges();

    expect(setStrategyEnabled).toHaveBeenCalledWith('5', true, true);
    expect(el(fixture, 'confirm-on')).toBeNull();
  });

  it('cancelling the confirmation switches nothing on', async () => {
    const fixture = await build(of(status(true)));

    el(fixture, 'strategy-toggle')!.click();
    fixture.detectChanges();
    el(fixture, 'confirm-cancel')!.click();
    fixture.detectChanges();

    expect(setStrategyEnabled).not.toHaveBeenCalled();
    expect(el(fixture, 'confirm-on')).toBeNull();
  });

  it('switches a running strategy off at once, with no confirmation', async () => {
    const fixture = await build(of(status(true, [strategy({ enabled: true })])));

    el(fixture, 'strategy-toggle')!.click();
    fixture.detectChanges();

    expect(setStrategyEnabled).toHaveBeenCalledWith('5', false, false);
    expect(el(fixture, 'confirm-on')).toBeNull();
  });

  it('creates a strategy from the dialog, and refuses it without an instrument', async () => {
    const fixture = await build(of(status(true, [])));

    el(fixture, 'strategy-new')!.click();
    fixture.detectChanges();
    el(fixture, 'strategy-create')!.click();
    fixture.detectChanges();
    expect(el(fixture, 'strategy-form-error')?.textContent).toContain('Choose an instrument');
    expect(createStrategy).not.toHaveBeenCalled();

    el(fixture, 'strategy-symbol')!.click();
    fixture.detectChanges();
    el(fixture, 'option-AAPL')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    el(fixture, 'strategy-create')!.click();
    fixture.detectChanges();

    expect(createStrategy).toHaveBeenCalledWith({
      type: 'MA_CROSSOVER', accountId: 1, symbol: 'AAPL', quantity: 10, shortPeriod: 20, longPeriod: 50
    });
    expect(el(fixture, 'strategy-form')).toBeNull();
  });

  it('shows the server reason inside the dialog when it refuses a strategy', async () => {
    const fixture = await build(of(status(true, [])));
    createStrategy.mockReturnValue(throwError(() => ({ status: 422, error: { errorCode: 'AUT-422', message: 'An account can hold up to 10 strategies' } })));

    el(fixture, 'strategy-new')!.click();
    fixture.detectChanges();
    el(fixture, 'strategy-symbol')!.click();
    fixture.detectChanges();
    el(fixture, 'option-AAPL')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    el(fixture, 'strategy-create')!.click();
    fixture.detectChanges();

    expect(el(fixture, 'strategy-form-error')).not.toBeNull();
    expect(el(fixture, 'strategy-form')).not.toBeNull();
  });

  it('asks before removing a strategy', async () => {
    const fixture = await build(of(status(true)));

    el(fixture, 'strategy-remove')!.click();
    fixture.detectChanges();
    expect(removeStrategy).not.toHaveBeenCalled();
    expect(el(fixture, 'remove-confirm')?.textContent).toContain('AAPL');

    el(fixture, 'remove-confirm-button')!.click();
    fixture.detectChanges();

    expect(removeStrategy).toHaveBeenCalledWith('5');
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
