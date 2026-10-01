import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

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
  private readonly userStorageKey = 'auth_user';
  private readonly sessionIdKey = 'session_id';

  /**
   * Token is mirrored in memory and localStorage so auth survives refresh.
   */
  private tokenSignal = signal<string | null>(this.readTokenFromStorage());

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
   * Store token in memory and localStorage.
   */
  private setToken(token: string): void {
    this.tokenSignal.set(token);
    localStorage.setItem(this.storageKey, token);
  }

  /**
   * Store session ID in memory and localStorage.
   */
  private setSessionId(sessionId: string | null): void {
    this.sessionIdSignal.set(sessionId);
    if (sessionId) {
      localStorage.setItem(this.sessionIdKey, sessionId);
    } else {
      localStorage.removeItem(this.sessionIdKey);
    }
  }

  /**
   * Store user in memory and localStorage.
   */
  private setUser(user: User | null): void {
    this.userSignal.set(user);
    if (user) {
      localStorage.setItem(this.userStorageKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.userStorageKey);
    }
  }

  /**
   * Restore token from localStorage if available.
   */
  private readTokenFromStorage(): string | null {
    const token = localStorage.getItem(this.storageKey);
    return token && token.trim().length > 0 ? token : null;
  }

  /**
   * Restore session ID from localStorage if available.
   */
  private readSessionIdFromStorage(): string | null {
    const sessionId = localStorage.getItem(this.sessionIdKey);
    return sessionId && sessionId.trim().length > 0 ? sessionId : null;
  }

  /**
   * Restore user from localStorage if available.
   */
  private readUserFromStorage(): User | null {
    try {
      const user = localStorage.getItem(this.userStorageKey);
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
    return this.http.post<LoginResponse>('http://localhost:3000/auth/login', credentials)
      .pipe(
        tap(response => {
          // Accept either legacy `token` or `accessToken` returned by auth-service.
          const token = (response as any).token ?? (response as any).accessToken;
          if (token) {
            this.setToken(token);
            
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
        catchError(error => {
          // Never log the credentials or token
          console.error('[Auth Error]', error.status, error.statusText);
          return throwError(() => this.handleLoginError(error));
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
    this.userSignal.set(null);
    this.sessionIdSignal.set(null);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.userStorageKey);
    // Navigate to landing page
    this.router.navigate(['/']);
  }

  /**
   * Validate if current session is still active on the server
   * Detects when session was invalidated from another device/tab
   * @returns Observable<{isValid: boolean}>
   */
  validateSession(): Observable<{isValid: boolean}> {
    return this.http.get<{isValid: boolean}>('http://localhost:3000/auth/session/validate')
      .pipe(
        catchError((error) => {
          // If we get a 401, the session was invalidated
          if (error instanceof HttpErrorResponse && error.status === 401) {
            return throwError(() => new Error('Session invalidated'));
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
    } else if (error.status === 0) {
      // Network error
      userMessage = 'Network error. Please check your connection and try again.';
    } else if (error.status === 500 || error.status === 503) {
      // Server error
      userMessage = 'The authentication service is temporarily unavailable. Please try again later.';
    }

    return new Error(userMessage);
  }
}
