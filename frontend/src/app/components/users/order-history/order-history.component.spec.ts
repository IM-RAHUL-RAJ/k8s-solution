import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OrderHistoryComponent } from './order-history.component';
import { AccountContextService } from '../../../core/services/account-context.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { OrderService } from '../../../core/services/order.service';

describe('OrderHistoryComponent', () => {
  const getOrderHistory = vi.fn();

  beforeEach(async () => {
    getOrderHistory.mockReset();

    await TestBed.configureTestingModule({
      imports: [OrderHistoryComponent],
      providers: [
        {
          provide: AccountContextService,
          useValue: {
            getCurrentAccount: () => ({
              accountNumericId: 1,
              accountReference: 'ACC-1042',
              displayName: 'trader01'
            })
          }
        },
        {
          provide: ApiErrorMessageService,
          useValue: {
            getMessage: () => 'Readable mapped error'
          }
        },
        {
          provide: OrderService,
          useValue: {
            getOrderHistory
          }
        }
      ]
    }).compileComponents();
  });

  it('renders orders newest first', () => {
    getOrderHistory.mockReturnValue(
      of([
        {
          orderId: 'older',
          accountId: 1,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          price: 100,
          status: 'FILLED',
          createdOn: '2026-01-01T10:00:00Z',
          executedPrice: 100,
          idempotencyKey: '1'
        },
        {
          orderId: 'newer',
          accountId: 1,
          symbol: 'MSFT',
          side: 'SELL',
          quantity: 5,
          price: 200,
          status: 'NEW',
          createdOn: '2026-01-01T11:00:00Z',
          executedPrice: null,
          idempotencyKey: '2'
        }
      ])
    );

    const fixture = TestBed.createComponent(OrderHistoryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.orders()[0].orderId).toBe('newer');
  });

  it('shows empty state when there are no orders', () => {
    getOrderHistory.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(OrderHistoryComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('No orders yet.');
  });

  it('refresh button retrieves orders', () => {
    getOrderHistory.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(OrderHistoryComponent);
    fixture.detectChanges();

    fixture.componentInstance.refreshOrders();
    expect(getOrderHistory).toHaveBeenCalled();
  });
});

