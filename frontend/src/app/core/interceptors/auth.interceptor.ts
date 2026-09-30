import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { platformTargets } from '../config/api-endpoints';
import { AuthService } from '../auth/auth.service';

/**
 * The only place in the application that sets an Authorization header.
 *
 * It is an allow list: the token is attached when the outgoing URL is an origin this platform
 * owns AND a protected path on it, and to nothing else. A third party added tomorrow gets no
 * token without anybody remembering to exclude it.
 */
function shouldAttachToken(url: string): boolean {
  let target: URL;
  try {
    target = new URL(url, window.location.origin);
  } catch {
    return false;
  }

  return platformTargets().some(
    (allowed) =>
      target.origin === allowed.origin &&
      (allowed.exactPaths.includes(target.pathname) ||
        allowed.pathPrefixes.some((prefix) => target.pathname.startsWith(prefix)))
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!shouldAttachToken(req.url)) {
    return next(req);
  }

  const token = auth.getToken();
  const outgoing = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      // The session ended while a signed-in call was in flight: sign out and say so.
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        auth.logout();
      }
      return throwError(() => error);
    })
  );
};
