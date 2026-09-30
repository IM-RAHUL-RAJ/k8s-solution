import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MAX_POLL_ATTEMPTS, OrderHistoryComponent, POLL_INTERVAL_MS } from './order-history.component';
import { AccountContextService } from '../../../core/services/account-context.service';
import { OrderService } from '../../../core/services/order.service';

function order(orderId: string, status: string, createdOn: string) {
  return {
    orderId,
    accountId: 1,
    symbol: 'AAPL',
    side: 'BUY',
    quantity: 10,
    price: 100,
    status,
    createdOn,
    executedPrice: status === 'FILLED' ? 100 : null,
    idempotencyKey: orderId
  };
}

describe('OrderHistoryComponent', () => {
  const getOrderHistory = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers();
    getOrderHistory.mockReset();

    await TestBed.configureTestingModule({
      imports: [OrderHistoryComponent],
      providers: [
        provideRouter([]),
        {
          provide: AccountContextService,
          useValue: {
            getCurrentAccount: () => ({ accountNumericId: 1, accountReference: '1', displayName: 'trader01' })
          }
        },
        { provide: OrderService, useValue: { getOrderHistory } }
      ]
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function create() {
    const fixture = TestBed.createComponent(OrderHistoryComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('order history renders newest first including rejections', () => {
    getOrderHistory.mockReturnValue(
      of([
        order('older', 'REJECTED', '2026-01-01T10:00:00Z'),
        order('newer', 'FILLED', '2026-01-01T11:00:00Z'),
        order('oldest', 'CANCELLED', '2026-01-01T09:00:00Z')
      ])
    );

    const fixture = create();

    expect(fixture.componentInstance.orders().map((o) => o.orderId)).toEqual(['newer', 'older', 'oldest']);
    const badges = [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-status-badge')].map(
      (badge) => badge.textContent?.trim()
    );
    expect(badges).toEqual(['FILLED', 'REJECTED', 'CANCELLED']);
  });

  it('an order at NEW is shown as still working', () => {
    getOrderHistory.mockReturnValue(of([order('a', 'NEW', '2026-01-01T10:00:00Z')]));

    const fixture = create();

    const banner = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="polling-message"]');
    expect(banner?.textContent).toContain('1 order is still working');
    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.textContent).toContain(`attempt 1 of ${MAX_POLL_ATTEMPTS}`);
  });

  it('the re-read stops when nothing is at NEW', () => {
    getOrderHistory
      .mockReturnValueOnce(of([order('a', 'NEW', '2026-01-01T10:00:00Z')]))
      .mockReturnValue(of([order('a', 'FILLED', '2026-01-01T10:00:00Z')]));

    const fixture = create();
    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    fixture.detectChanges();

    expect(getOrderHistory).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.pollingMessage()).toBeNull();

    vi.advanceTimersByTime(POLL_INTERVAL_MS * 5);
    expect(getOrderHistory).toHaveBeenCalledTimes(2);
  });

  it('the re-read is bounded and says so when it gives up', () => {
    getOrderHistory.mockReturnValue(of([order('a', 'NEW', '2026-01-01T10:00:00Z')]));

    const fixture = create();
    vi.advanceTimersByTime(POLL_INTERVAL_MS * (MAX_POLL_ATTEMPTS + 5));
    fixture.detectChanges();

    // One initial read plus at most MAX_POLL_ATTEMPTS re-reads, then silence.
    expect(getOrderHistory).toHaveBeenCalledTimes(MAX_POLL_ATTEMPTS + 1);
    expect(fixture.componentInstance.pollingMessage()).toContain('Automatic checking stopped');
  });

  it('pressing refresh after the re-read gave up opens a new window', () => {
    getOrderHistory.mockReturnValue(of([order('a', 'NEW', '2026-01-01T10:00:00Z')]));
    const fixture = create();
    vi.advanceTimersByTime(POLL_INTERVAL_MS * (MAX_POLL_ATTEMPTS + 1));

    fixture.componentInstance.refreshOrders();
    vi.advanceTimersByTime(POLL_INTERVAL_MS);

    expect(getOrderHistory.mock.calls.length).toBeGreaterThan(MAX_POLL_ATTEMPTS + 1);
    expect(fixture.componentInstance.pollingStopped()).toBe(false);
  });

  it('a status filter narrows the table but counts every order', () => {
    getOrderHistory.mockReturnValue(
      of([
        order('a', 'FILLED', '2026-01-01T11:00:00Z'),
        order('b', 'REJECTED', '2026-01-01T10:00:00Z'),
        order('c', 'REJECTED', '2026-01-01T09:00:00Z')
      ])
    );
    const fixture = create();

    fixture.componentInstance.setFilter('REJECTED');
    fixture.detectChanges();

    expect(fixture.componentInstance.visibleOrders().map((o) => o.orderId)).toEqual(['b', 'c']);
    const rejected = fixture.componentInstance.filters().find((f) => f.value === 'REJECTED');
    expect(rejected?.count).toBe(2);
    expect(fixture.componentInstance.filters().find((f) => f.value === 'ALL')?.count).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="order-row"]').length).toBe(2);
  });

  it('empty history is handled gracefully', () => {
    getOrderHistory.mockReturnValue(of([]));

    const fixture = create();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No orders yet.');
    expect(fixture.componentInstance.pollingMessage()).toBeNull();
  });

  it('leaving the screen stops the re-read', () => {
    getOrderHistory.mockReturnValue(of([order('a', 'NEW', '2026-01-01T10:00:00Z')]));
    const fixture = create();

    fixture.destroy();
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

    expect(getOrderHistory).toHaveBeenCalledTimes(1);
  });
});
