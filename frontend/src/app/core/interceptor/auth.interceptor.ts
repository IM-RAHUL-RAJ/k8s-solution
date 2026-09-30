import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/**
 * Environment configuration for allowed API origins.
 * Only attach bearer tokens to requests for these origins.
 */
const ALLOWED_API_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082'
];

/**
 * Auth Interceptor: Securely attach bearer tokens
 * 
 * SECURITY CRITICAL:
 * - Only attaches token to allowed origins (whitelist, not deny-list)
 * - Never attaches token to third-party APIs
 * - Never logs tokens
 * - Prevents token leakage to external services
 * 
 * @param req - HTTP request
 * @param next - HTTP handler
 * @returns Observable of HTTP event
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);

  // Check if this request goes to an allowed origin
  const isAllowedOrigin = ALLOWED_API_ORIGINS.some(origin => {
    return req.url.startsWith(origin) || req.url.startsWith('/api');
  });

  // Only attach token to allowed origins
  if (isAllowedOrigin) {
    const token = authService.getToken();
    
    if (token) {
      // Clone request and add Authorization header
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
  }

  return next(req);
};
