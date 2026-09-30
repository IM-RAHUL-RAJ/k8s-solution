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

  /**
   * Token is mirrored in memory and localStorage so auth survives refresh.
   */
  private tokenSignal = signal<string | null>(this.readTokenFromStorage());

  /**
   * User information from login response
   */
  private userSignal = signal<User | null>(this.readUserFromStorage());

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
   * Store token in memory and localStorage.
   */
  private setToken(token: string): void {
    this.tokenSignal.set(token);
    localStorage.setItem(this.storageKey, token);
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
          }
          
          // Store user info if provided
          if (response.user) {
            this.setUser({
              id: response.user.id,
              username: response.user.username,
              email: response.user.email
            });
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
   * Clears token immediately and navigates to sign-in page
   */
  logout(): void {
    // Immediately clear token and user from memory and local storage
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.userStorageKey);
    // Navigate to sign-in page
    this.router.navigate(['/sign-in']);
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
