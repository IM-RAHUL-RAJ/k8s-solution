import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { WatchlistComponent, QUOTE_REFRESH_MS } from './watchlist.component';
import { AccountContextService } from '../../../core/services/account-context.service';
import { AccountService } from '../../../core/services/account.service';
import { InstrumentService } from '../../../core/services/instrument.service';
import { OrderService } from '../../../core/services/order.service';

describe('WatchlistComponent', () => {
  const getWatchlist = vi.fn();
  const getWatchlistQuotes = vi.fn();
  const removeFromWatchlist = vi.fn();

  const entry = (symbol: string, currency = 'USD') => ({
    symbol,
    name: `${symbol} Inc.`,
    exchange: 'NASDAQ',
    assetClass: 'US_EQUITY',
    currency,
    tradable: true,
    addedAt: '2026-10-01T10:00:00Z'
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    getWatchlist.mockReset().mockReturnValue(of([entry('AAPL'), entry('MSFT')]));
    getWatchlistQuotes.mockReset().mockReturnValue(
      of([
        {
          symbol: 'AAPL',
          price: 193.12,
          bid: 193.1,
          ask: 193.14,
          currency: 'USD',
          change: -1.2,
          changePercent: -0.62,
          previousClose: 194.32,
          marketState: 'REGULAR',
          stale: false,
          quoteAsOf: '2026-10-03T10:00:00Z',
          receivedAt: '2026-10-03T10:00:01Z'
        }
      ])
    );
    removeFromWatchlist.mockReset().mockReturnValue(of([entry('MSFT')]));

    await TestBed.configureTestingModule({
      imports: [WatchlistComponent],
      providers: [
        provideRouter([]),
        { provide: AccountContextService, useValue: { getCurrentAccount: () => ({ accountNumericId: 1 }) } },
        {
          provide: AccountService,
          useValue: {
            getBalance: () => of({ accountId: 1, cashBalance: 1, currency: 'INR', asOf: '' }),
            getPositions: () => of([{ accountId: 1, symbol: 'AAPL', quantity: 3, averageCost: 100 }])
          }
        },
        { provide: OrderService, useValue: { getOrderHistory: () => of([]) } },
        {
          provide: InstrumentService,
          useValue: {
            getInstruments: () => of([entry('AAPL'), entry('MSFT'), entry('TSLA')]),
            getWatchlist,
            getWatchlistQuotes,
            removeFromWatchlist,
            addToWatchlist: vi.fn()
          }
        }
      ]
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function create() {
    const fixture = TestBed.createComponent(WatchlistComponent);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a card per watched instrument with what the customer holds', () => {
    const root = create().nativeElement as HTMLElement;

    const cards = root.querySelectorAll('[data-testid="watch-card"]');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('AAPL');
    expect(cards[0].textContent).toContain('You hold');
  });

  it('shows bid, ask and the last price from the market-data quote, and waits for the rest', () => {
    const root = create().nativeElement as HTMLElement;

    const quote = root.querySelector('[data-testid="watch-quote"]');
    expect(quote?.textContent).toContain('193.10');
    expect(quote?.textContent).toContain('193.14');
    expect(quote?.textContent).toContain('193.12');
    expect(quote?.textContent).toContain('REGULAR');
    // 193.12 USD at 95 INR per USD
    expect(quote?.textContent).toContain('18,346.40');
    expect(root.querySelectorAll('[data-testid="watch-quote-waiting"]').length).toBe(1);
  });

  it('re-reads the quotes on a timer', () => {
    create();
    expect(getWatchlistQuotes).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(QUOTE_REFRESH_MS * 2);

    expect(getWatchlistQuotes).toHaveBeenCalledTimes(3);
  });

  it('the remove control is a minus and takes the instrument off the list', () => {
    const fixture = create();
    const root = fixture.nativeElement as HTMLElement;
    const remove = root.querySelector<HTMLButtonElement>('[data-testid="watch-remove"]');

    expect(remove?.querySelector('path')?.getAttribute('d')).toBe('M5 10h10');
    remove?.click();
    fixture.detectChanges();

    expect(removeFromWatchlist).toHaveBeenCalledWith(1, 'AAPL');
    expect(root.querySelectorAll('[data-testid="watch-card"]').length).toBe(1);
  });
});
