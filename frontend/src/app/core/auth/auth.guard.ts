import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * Auth Guard: Protects routes that require authentication
 * 
 * SECURITY CRITICAL:
 * - Validates return URL to prevent open redirect attacks
 * - Only allows paths on the same origin (starts with "/" but not "//")
 * - Validates session is still active (prevents multi-device access)
 * - Redirects to sign-in if not authenticated
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // After logout, keep user on landing even if browser back lands on a guarded URL.
  if (authService.shouldForceLandingAfterLogout()) {
    return of(router.createUrlTree(['/']));
  }

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    // Extract return URL from current route
    const url = new URL(state.url, window.location.origin);
    const returnUrl = url.pathname + url.search;

    // Validate return URL to prevent open redirect attacks
    // Only allow paths on this origin (must start with "/" but not "//")
    if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      return of(router.createUrlTree(['/sign-in'], {
        queryParams: { returnUrl }
      }));
    }

    // Reject suspicious return URL, redirect to sign-in without it
    return of(router.createUrlTree(['/sign-in']));
  }

  // User is authenticated, validate session with server
  // This detects when session was invalidated from another device
  return authService.validateSession().pipe(
    map(() => true),
    catchError(() => {
      // Session is invalid (logged out from another device)
      authService.logout();
      return of(router.createUrlTree(['/']));
    })
  );
};

/**
 * Guest Guard: Prevent authenticated users from visiting public auth pages.
 * Redirects authenticated users to dashboard.
 */
export const guestGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return of(router.createUrlTree(['/dashboard']));
  }

  return of(true);
};
