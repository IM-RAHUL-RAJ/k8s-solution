import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface AccountContext {
  accountNumericId: number;
  accountReference: string;
  displayName: string;
}

/**
 * The account this session may trade, taken from the signed-in session (the token's
 * `accountId` claim). Components render it read-only; the Trade REST API re-checks it.
 */
@Injectable({ providedIn: 'root' })
export class AccountContextService {
  private readonly auth = inject(AuthService);

  getCurrentAccount(): AccountContext {
    const user = this.auth.user();

    return {
      accountNumericId: user?.accountId ?? 0,
      accountReference: user && (user.accountId ?? 0) > 0 ? String(user.accountId) : 'Unknown',
      displayName: user?.username ?? ''
    };
  }
}
