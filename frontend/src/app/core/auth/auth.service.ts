import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthService as AuthApi, TokenResponse } from '../../../generated/auth-api';
import { sanitizeReturnUrl } from '../guards/return-url';

export interface SessionUser {
  username: string;
  accountId: number;
}

// Refresh this long before the access token expires so a request is never sent with a stale one.
const REFRESH_LEAD_SECONDS = 30;

/**
 * Holds the session in memory only. The token is never written to localStorage or
 * sessionStorage, so closing the tab ends the session and a script injected later has nothing
 * to read. The bearer header itself is attached by the interceptor, never here.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApi);
  private readonly router = inject(Router);

  private readonly accessToken = signal<string | null>(null);
  private readonly refreshToken = signal<string | null>(null);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly user = signal<SessionUser | null>(null);
  readonly isAuthenticated = computed(() => this.accessToken() !== null);
  readonly sessionExpired = signal(false);

  getToken(): string | null {
    return this.accessToken();
  }

  login(username: string, password: string): Observable<TokenResponse> {
    return this.authApi.login({ username, password }).pipe(
      tap((tokens) => {
        this.sessionExpired.set(false);
        this.startSession(tokens, username);
      })
    );
  }

  /** Clears the session. Nothing about the previous user survives. */
  logout(): void {
    this.clearRefreshTimer();
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.user.set(null);
  }

  /** Ends the session and sends the visitor to sign-in, remembering where they were. */
  expireSession(returnUrl?: string): void {
    this.logout();
    this.sessionExpired.set(true);
    const safeReturn = sanitizeReturnUrl(returnUrl ?? this.router.url);
    void this.router.navigate(['/sign-in'], {
      queryParams: safeReturn ? { returnUrl: safeReturn } : {}
    });
  }

  private startSession(tokens: TokenResponse, username: string): void {
    this.accessToken.set(tokens.accessToken);
    this.refreshToken.set(tokens.refreshToken);
    this.user.set({
      username,
      accountId: this.readAccountId(tokens.accessToken)
    });
    this.scheduleRefresh(tokens.expiresIn);
  }

  private scheduleRefresh(expiresInSeconds: number): void {
    this.clearRefreshTimer();
    const delayMs = Math.max(expiresInSeconds - REFRESH_LEAD_SECONDS, 5) * 1000;
    this.refreshTimer = setTimeout(() => this.silentRefresh(), delayMs);
  }

  private silentRefresh(): void {
    const refreshToken = this.refreshToken();
    if (!refreshToken) {
      return;
    }

    this.authApi.refresh({ refreshToken }).subscribe({
      next: (tokens) => {
        this.accessToken.set(tokens.accessToken);
        this.refreshToken.set(tokens.refreshToken);
        this.scheduleRefresh(tokens.expiresIn);
      },
      error: (error: unknown) => {
        // A refused refresh means the session is over. A network blip should not sign the
        // customer out, so try again shortly.
        if (error instanceof HttpErrorResponse && error.status === 0) {
          this.scheduleRefresh(REFRESH_LEAD_SECONDS + 10);
          return;
        }
        this.expireSession();
      }
    });
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // The payload is only read to learn which account to show. Authorisation is decided by the
  // Trade REST API from the verified signature, never from this decode.
  private readAccountId(token: string): number {
    try {
      const segment = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
      const payload = JSON.parse(atob(segment + '='.repeat((4 - (segment.length % 4)) % 4))) as {
        accountId?: number | string;
      };
      const accountId = Number(payload.accountId);
      return Number.isInteger(accountId) && accountId > 0 ? accountId : 0;
    } catch {
      return 0;
    }
  }
}
