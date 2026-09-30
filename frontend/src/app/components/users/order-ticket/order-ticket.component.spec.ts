import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { OrderTicketComponent } from './order-ticket.component';
import { AccountContextService } from '../../../core/services/account-context.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { OrderService } from '../../../core/services/order.service';

describe('OrderTicketComponent', () => {
  const placeOrder = vi.fn();

  beforeEach(async () => {
    placeOrder.mockReset();

    await TestBed.configureTestingModule({
      imports: [OrderTicketComponent],
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
            placeOrder
          }
        }
      ]
    }).compileComponents();
  });

  function fillValidForm(fixture: ReturnType<typeof TestBed.createComponent<OrderTicketComponent>>) {
    fixture.componentInstance.form.setValue({
      symbol: 'AAPL',
      side: 'BUY',
      quantity: '10',
      price: '150.50'
    });
  }

  it('submits a valid order', () => {
    placeOrder.mockReturnValue(
      of({
        orderId: 'id-1',
        status: 'NEW',
        message: 'ok',
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        price: 150.5
      })
    );

    const fixture = TestBed.createComponent(OrderTicketComponent);
    fillValidForm(fixture);
    fixture.componentInstance.onSubmit();

    expect(placeOrder).toHaveBeenCalledTimes(1);
  });

  it('blocks empty symbol', () => {
    const fixture = TestBed.createComponent(OrderTicketComponent);
    fixture.componentInstance.form.setValue({
      symbol: ' ',
      side: 'BUY',
      quantity: '10',
      price: '150.50'
    });
    fixture.componentInstance.onSubmit();
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('blocks zero, negative, and decimal quantities', () => {
    const fixture = TestBed.createComponent(OrderTicketComponent);
    fixture.componentInstance.form.setValue({
      symbol: 'AAPL',
      side: 'BUY',
      quantity: '0',
      price: '150.50'
    });
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.form.controls.quantity.setValue('-1');
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.form.controls.quantity.setValue('10.5');
    fixture.componentInstance.onSubmit();
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('blocks invalid prices', () => {
    const fixture = TestBed.createComponent(OrderTicketComponent);
    fixture.componentInstance.form.setValue({
      symbol: 'AAPL',
      side: 'BUY',
      quantity: '10',
      price: '0'
    });
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.form.controls.price.setValue('-5');
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.form.controls.price.setValue('10.123');
    fixture.componentInstance.onSubmit();
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('disables submit while submitting', () => {
    const subject = new Subject<unknown>();
    placeOrder.mockReturnValue(subject.asObservable());

    const fixture = TestBed.createComponent(OrderTicketComponent);
    fillValidForm(fixture);
    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.isSubmitting()).toBe(true);
    subject.next({});
    subject.complete();
  });

  it('shows successful NEW response', () => {
    placeOrder.mockReturnValue(
      of({
        orderId: 'id-1',
        status: 'NEW',
        message: 'ok',
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        price: 150.5
      })
    );

    const fixture = TestBed.createComponent(OrderTicketComponent);
    fillValidForm(fixture);
    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.success()?.status).toBe('NEW');
  });

  it('maps backend rejection to readable message', () => {
    placeOrder.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(OrderTicketComponent);
    fillValidForm(fixture);
    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.errorMessage()).toBe('Readable mapped error');
  });

  it('resets order fields', () => {
    const fixture = TestBed.createComponent(OrderTicketComponent);
    fillValidForm(fixture);

    fixture.componentInstance.onReset();

    expect(fixture.componentInstance.form.controls.symbol.value).toBe('');
    expect(fixture.componentInstance.form.controls.quantity.value).toBe('');
    expect(fixture.componentInstance.form.controls.price.value).toBe('');
  });
});

