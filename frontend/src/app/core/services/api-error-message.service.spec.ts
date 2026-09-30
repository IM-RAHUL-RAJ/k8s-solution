import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ApiErrorMessageService } from './api-error-message.service';

describe('ApiErrorMessageService', () => {
  let service: ApiErrorMessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ApiErrorMessageService);
  });

  it('maps known backend error codes', () => {
    const message = service.getMessage(
      new HttpErrorResponse({
        status: 400,
        error: { errorCode: 'ORD-400' }
      })
    );

    expect(message).toContain('not enough cash');
  });

  it('returns fallback for unknown codes', () => {
    const message = service.getMessage(
      new HttpErrorResponse({
        status: 500,
        error: { errorCode: 'UNKNOWN-CODE' }
      })
    );

    expect(message).toBe("We couldn't complete your request. Please try again.");
  });

  it('returns service-unavailable message for status 0', () => {
    const message = service.getMessage(
      new HttpErrorResponse({
        status: 0
      })
    );

    expect(message).toContain('currently unavailable');
  });
});

