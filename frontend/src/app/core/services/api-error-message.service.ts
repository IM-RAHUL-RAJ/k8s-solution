import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ApiErrorResponse } from '../models/api-error.model';

const ERROR_MESSAGES: Record<string, string> = {
  'AUTH-401': 'Your session or credentials were not accepted. Please sign in again.',
  'AUTH-409': 'This username already exists. Please sign in or choose a different username.',
  'ACC-404': 'The account you tried to access does not exist.',
  'ACC-403': 'This account is currently unavailable for trading.',
  'INS-404': 'The selected instrument could not be found. Check the symbol and try again.',
  'ORD-400': 'There is not enough cash for this order. Reduce the quantity or add funds.',
  'ORD-409':
    'This order conflicts with existing account holdings or a duplicate idempotency key.',
  'VAL-422': 'The submitted data is invalid. Check all fields and try again.',
  'CUR-422': 'The requested currency pair is not supported by the trading backend.',
  'API-NOT-AVAILABLE':
    'This feature is not available because no backend endpoint is currently exposed for it.'
};

@Injectable({ providedIn: 'root' })
export class ApiErrorMessageService {
  getMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return "We couldn't complete your request. Please try again.";
    }

    if (error.status === 0) {
      return 'The trading service is currently unavailable. Please check your connection and try again.';
    }

    const body = error.error as ApiErrorResponse | null;
    const code = body?.errorCode;

    if (code && ERROR_MESSAGES[code]) {
      return ERROR_MESSAGES[code];
    }

    return "We couldn't complete your request. Please try again.";
  }
}

