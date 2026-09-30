import { Injectable, signal } from '@angular/core';

export interface AccountContext {
  accountNumericId: number;
  accountReference: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AccountContextService {
  private readonly localStorageTokenKeys = [
    'jwt',
    'accessToken',
    'token',
    'etp-access-token'
  ];

  private readonly currentAccountSignal = signal<AccountContext>({
    accountNumericId: 1,
    accountReference: '1',
    displayName: 'trader01'
  });

  constructor() {
    const accountFromToken = this.getAccountFromJwt();
    if (accountFromToken) {
      this.currentAccountSignal.set(accountFromToken);
    }
  }

  getCurrentAccount(): AccountContext {
    const accountFromToken = this.getAccountFromJwt();
    if (
      accountFromToken &&
      accountFromToken.accountNumericId !== this.currentAccountSignal().accountNumericId
    ) {
      this.currentAccountSignal.set(accountFromToken);
    }

    return this.currentAccountSignal();
  }

  setCurrentAccount(context: AccountContext): void {
    this.currentAccountSignal.set(context);
  }

  private getAccountFromJwt(): AccountContext | null {
    const token = this.getTokenFromLocalStorage();
    if (!token) {
      return null;
    }

    const tokenParts = token.split('.');
    if (tokenParts.length < 2) {
      return null;
    }

    const payloadSegment = tokenParts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/');
    const paddedPayload =
      payloadSegment + '='.repeat((4 - (payloadSegment.length % 4)) % 4);
    const jsonPayload = atob(paddedPayload);
    const payload = JSON.parse(jsonPayload) as {
      accountId?: number | string;
      sub?: string;
    };

    const numericAccountId = Number(payload.accountId);
    if (!Number.isInteger(numericAccountId) || numericAccountId <= 0) {
      return null;
    }

    return {
      accountNumericId: numericAccountId,
      accountReference: String(numericAccountId),
      displayName: payload.sub ? payload.sub.slice(0, 12) : `trader-${numericAccountId}`
    };
  }

  private getTokenFromLocalStorage(): string | null {
    for (const key of this.localStorageTokenKeys) {
      const value = localStorage.getItem(key);
      if (value && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }
}
