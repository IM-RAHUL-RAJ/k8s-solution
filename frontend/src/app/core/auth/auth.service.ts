import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, map, tap, timeout } from 'rxjs/operators';
import { API_ENDPOINTS } from '../config/api-endpoints';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  // Support both legacy `{ token, user }` and new auth-service `{ accessToken, refreshToken, tokenType, expiresIn }` shapes
  token?: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface User {
  id?: string;
  username?: string;
  email?: string;
  accountId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly storageKey = 'access_token';
  private readonly refreshStorageKey = 'refresh_token';
  private readonly userStorageKey = 'auth_user';
  private readonly sessionIdKey = 'session_id';
  private readonly forceLandingKey = 'force_landing_after_logout';
  private readonly authLoginUrl = `${API_ENDPOINTS.authApiBase}/auth/login`;
  private readonly authSessionValidateUrl = `${API_ENDPOINTS.authApiBase}/auth/session/validate`;
  private readonly authRefreshUrl = `${API_ENDPOINTS.authApiBase}/auth/refresh`;
  private readonly requestTimeoutMs = 12000;

  /**
   * Token is mirrored in memory and sessionStorage.
   */
  private tokenSignal = signal<string | null>(this.readTokenFromStorage());

  /**
   * Refresh token is kept in memory and sessionStorage only.
   */
  private refreshTokenSignal = signal<string | null>(this.readRefreshTokenFromStorage());

  /**
   * User information from login response
   */
  private userSignal = signal<User | null>(this.readUserFromStorage());

  /**
   * Session ID from JWT token (for multi-device logout detection)
   */
  private sessionIdSignal = signal<string | null>(this.readSessionIdFromStorage());

  /**
   * Computed signal to track authentication state
   */
  isAuthenticated = computed(() => this.tokenSignal() !== null);

  /**
   * Get current user
   */
  user = this.userSignal.asReadonly();

  /**
   * Get current token (memory-only, cleared on logout)
   */
  getToken(): string | null {
    return this.tokenSignal();
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionIdSignal();
  }

  /**
   * Read only decoded claims from current access token.
   */
  getTokenClaims(): any | null {
    const token = this.tokenSignal();
    return token ? this.decodeToken(token) : null;
  }

  /**
   * Store token in memory and sessionStorage.
   */
  private setToken(token: string): void {
    this.tokenSignal.set(token);
    sessionStorage.setItem(this.storageKey, token);
  }

  /**
   * Store refresh token in memory and sessionStorage.
   */
  private setRefreshToken(token: string): void {
    this.refreshTokenSignal.set(token);
    sessionStorage.setItem(this.refreshStorageKey, token);
  }

  /**
   * Store session ID in memory and sessionStorage.
   */
  private setSessionId(sessionId: string | null): void {
    this.sessionIdSignal.set(sessionId);
    if (sessionId) {
      sessionStorage.setItem(this.sessionIdKey, sessionId);
    } else {
      sessionStorage.removeItem(this.sessionIdKey);
    }
  }

  /**
   * Store user in memory and sessionStorage.
   */
  private setUser(user: User | null): void {
    this.userSignal.set(user);
    if (user) {
      sessionStorage.setItem(this.userStorageKey, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(this.userStorageKey);
    }
  }

  /**
   * Restore token from sessionStorage first, then legacy localStorage.
   */
  private readTokenFromStorage(): string | null {
    const token = sessionStorage.getItem(this.storageKey) ?? localStorage.getItem(this.storageKey);
    return token && token.trim().length > 0 ? token : null;
  }

  /**
   * Restore refresh token from sessionStorage first, then legacy localStorage.
   */
  private readRefreshTokenFromStorage(): string | null {
    const token = sessionStorage.getItem(this.refreshStorageKey) ?? localStorage.getItem(this.refreshStorageKey);
    return token && token.trim().length > 0 ? token : null;
  }

  /**
   * Restore session ID from sessionStorage first, then legacy localStorage.
   */
  private readSessionIdFromStorage(): string | null {
    const sessionId = sessionStorage.getItem(this.sessionIdKey) ?? localStorage.getItem(this.sessionIdKey);
    return sessionId && sessionId.trim().length > 0 ? sessionId : null;
  }

  /**
   * Restore user from sessionStorage first, then legacy localStorage.
   */
  private readUserFromStorage(): User | null {
    try {
      const user = sessionStorage.getItem(this.userStorageKey) ?? localStorage.getItem(this.userStorageKey);
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  /**
   * Decode JWT and extract claims
   */
  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const decoded = atob(parts[1]);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Sign in with username and password against the Auth service
   * @param credentials - Username and password
   * @returns Observable<LoginResponse>
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.authLoginUrl, credentials)
      .pipe(
        timeout(this.requestTimeoutMs),
        tap(response => {
          this.clearForceLandingMarker();

          // Accept either legacy `token` or `accessToken` returned by auth-service.
          const token = (response as any).token ?? (response as any).accessToken;
          const refreshToken = (response as any).refreshToken;
          if (token) {
            this.setToken(token);

            if (refreshToken) {
              this.setRefreshToken(refreshToken);
            }
            
            // Extract claims from JWT
            const claims = this.decodeToken(token);
            if (claims) {
              // Store sessionId for multi-device logout detection
              if (claims.sessionId) {
                this.setSessionId(claims.sessionId);
              }
            }
            
            // Extract user info from response or decode from JWT
            let user: User | null = null;
            
            if (response.user) {
              // Use user from response if provided
              user = {
                id: response.user.id,
                username: response.user.username,
                email: response.user.email
              };
            }
            
            // Also try to extract accountId from JWT claims
            if (claims) {
              if (!user) {
                user = {};
              }
              user.accountId = claims.accountId || claims.sub?.accountId;
              user.username = user.username || claims.sub?.username || claims.username;
            }
            
            if (user) {
              this.setUser(user);
            }
          }
        }),
        catchError((error: unknown) => {
          // Never log the credentials or token
          if (error instanceof HttpErrorResponse) {
            console.error('[Auth Error]', error.status, error.statusText);
            return throwError(() => this.handleLoginError(error));
          }
          if (error instanceof TimeoutError) {
            return throwError(() => new Error('Login request timed out. Please try again.'));
          }
          return throwError(() => new Error('Network error. Please check your connection and try again.'));
        })
      );
  }

  /**
   * Refresh access token using refresh token. Refresh failure means session is no longer valid.
   */
  refreshAccessToken(): Observable<string> {
    const refreshToken = this.refreshTokenSignal();
    if (!refreshToken) {
      return throwError(() => new Error('Refresh token is missing. Please sign in again.'));
    }

    const body: RefreshRequest = { refreshToken };

    return this.http.post<LoginResponse>(this.authRefreshUrl, body).pipe(
      timeout(this.requestTimeoutMs),
      map((response) => {
        const nextAccessToken = response.accessToken ?? response.token;
        const nextRefreshToken = response.refreshToken;
        if (!nextAccessToken || !nextRefreshToken) {
          throw new Error('Invalid refresh response. Please sign in again.');
        }

        this.setToken(nextAccessToken);
        this.setRefreshToken(nextRefreshToken);

        const claims = this.decodeToken(nextAccessToken);
        if (claims?.sessionId) {
          this.setSessionId(claims.sessionId);
        }

        return nextAccessToken;
      }),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new Error('Token refresh timed out. Please sign in again.'));
        }
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          return throwError(() => new Error('Session expired. Please sign in again.'));
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Sign out and clear session
   * Clears token immediately and navigates to landing page
   */
  logout(): void {
    // Immediately clear token, user, and session ID from memory and local storage
    this.tokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.userSignal.set(null);
    this.sessionIdSignal.set(null);
    sessionStorage.setItem(this.forceLandingKey, '1');
    sessionStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.refreshStorageKey);
    sessionStorage.removeItem(this.userStorageKey);
    sessionStorage.removeItem(this.sessionIdKey);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.refreshStorageKey);
    localStorage.removeItem(this.userStorageKey);
    localStorage.removeItem(this.sessionIdKey);
    // Navigate to landing page
    this.router.navigateByUrl('/', { replaceUrl: true });
  }

  shouldForceLandingAfterLogout(): boolean {
    return sessionStorage.getItem(this.forceLandingKey) === '1';
  }

  private clearForceLandingMarker(): void {
    sessionStorage.removeItem(this.forceLandingKey);
  }

  /**
   * Validate if current session is still active on the server
   * Detects when session was invalidated from another device/tab
   * @returns Observable<{isValid: boolean}>
   */
  validateSession(): Observable<{isValid: boolean}> {
    return this.http.get<{isValid: boolean}>(this.authSessionValidateUrl)
      .pipe(
        timeout(this.requestTimeoutMs),
        catchError((error) => {
          // If we get a 401, the session was invalidated
          if (error instanceof HttpErrorResponse && error.status === 401) {
            return throwError(() => new Error('Session invalidated'));
          }
          if (error instanceof TimeoutError) {
            return throwError(() => new Error('Session validation timed out'));
          }
          return throwError(() => error);
        })
      );
  }

  /**
   * Handle login errors and return user-friendly messages
   * Never expose token or internal error details
   */
  private handleLoginError(error: HttpErrorResponse): Error {
    let userMessage = 'An error occurred during sign-in. Please try again.';

    if (error.status === 401 || error.status === 400) {
      // Invalid credentials
      userMessage = 'Invalid username or password. Please try again.';
    } else if (error.status === 422) {
      userMessage = 'Please check your username and password format and try again.';
    } else if (error.status === 429) {
      userMessage = 'Too many sign-in attempts. Please wait a minute and try again.';
    } else if (error.status === 403) {
      userMessage = 'You are not allowed to perform this action.';
    } else if (error.status === 0) {
      // Network error
      userMessage = 'Login request timed out or network failed. Please try again.';
    } else if (error.status === 500 || error.status === 503) {
      // Server error
      userMessage = 'The authentication service is temporarily unavailable. Please try again later.';
    }

    return new Error(userMessage);
  }
}
