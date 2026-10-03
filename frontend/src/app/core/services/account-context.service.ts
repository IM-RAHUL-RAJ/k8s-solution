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
    const claims = this.auth.getTokenClaims();
    const claimAccountId = Number(claims?.accountId ?? claims?.sub?.accountId ?? 0);
    const effectiveAccountId = Number.isFinite(claimAccountId) && claimAccountId > 0
      ? claimAccountId
      : (user?.accountId ?? 0);
    const claimUsername = typeof claims?.username === 'string'
      ? claims.username
      : (typeof claims?.sub?.username === 'string' ? claims.sub.username : null);

    return {
      accountNumericId: effectiveAccountId,
      accountReference: effectiveAccountId > 0 ? String(effectiveAccountId) : 'Unknown',
      displayName: claimUsername ?? user?.username ?? ''
    };
  }
}
