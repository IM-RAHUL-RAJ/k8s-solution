import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { sanitizeReturnUrl } from './return-url';

/**
 * A usability control, not a security control: the bundle is public and every route in it is
 * readable. Authorisation is the Trade REST API's decision on every /api/v1 call.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  const returnUrl = sanitizeReturnUrl(state.url);
  return router.createUrlTree(['/sign-in'], {
    queryParams: returnUrl ? { returnUrl } : {}
  });
};
