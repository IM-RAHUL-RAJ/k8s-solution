import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Auth Guard: Protects routes that require authentication
 * 
 * SECURITY CRITICAL:
 * - Validates return URL to prevent open redirect attacks
 * - Only allows paths on the same origin (starts with "/" but not "//")
 * - Redirects to sign-in if not authenticated
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is authenticated
  if (authService.isAuthenticated()) {
    return true;
  }

  // Extract return URL from current route
  const url = new URL(state.url, window.location.origin);
  const returnUrl = url.pathname + url.search;

  // Validate return URL to prevent open redirect attacks
  // Only allow paths on this origin (must start with "/" but not "//")
  if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    return router.createUrlTree(['/sign-in'], {
      queryParams: { returnUrl }
    });
  }

  // Reject suspicious return URL, redirect to sign-in without it
  return router.createUrlTree(['/sign-in']);
};

/**
 * Guest Guard: Prevent authenticated users from visiting public auth pages.
 * Redirects authenticated users to dashboard.
 */
export const guestGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
