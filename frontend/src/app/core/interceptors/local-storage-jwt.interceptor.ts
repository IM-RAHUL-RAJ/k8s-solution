import { HttpInterceptorFn } from '@angular/common/http';

const TRADE_API_PATH_PREFIXES = ['/api/v1', '/actuator'];
const TOKEN_STORAGE_KEYS = ['jwt', 'accessToken', 'token', 'etp-access-token'];

function getTokenFromLocalStorage(): string | null {
  for (const key of TOKEN_STORAGE_KEYS) {
    const token = localStorage.getItem(key);
    if (token && token.trim().length > 0) {
      return token.trim();
    }
  }

  return null;
}

function isPlatformApiUrl(url: string): boolean {
  const parsed = new URL(url, window.location.origin);

  return TRADE_API_PATH_PREFIXES.some((prefix) =>
    parsed.pathname.startsWith(prefix)
  );
}

export const localStorageJwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformApiUrl(req.url)) {
    return next(req);
  }

  const token = getTokenFromLocalStorage();
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
  );
};

