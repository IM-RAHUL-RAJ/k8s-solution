import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { authGuard } from './auth.guard';
import { sanitizeReturnUrl } from './return-url';

describe('authGuard', () => {
  let router: Router;
  let signedIn = false;

  beforeEach(() => {
    signedIn = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => signedIn } }
      ]
    });
    router = TestBed.inject(Router);
  });

  function run(url: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(
      () => authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot) as boolean | UrlTree
    );
  }

  it('the guard blocks unauthenticated navigation and redirects to sign-in with the return address', () => {
    const result = run('/blotter');

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/sign-in?returnUrl=%2Fblotter');
  });

  it('the guard allows authenticated navigation', () => {
    signedIn = true;

    expect(run('/blotter')).toBe(true);
  });

  it('an off-origin return address is refused', () => {
    const result = run('//evil.example/steal');

    expect(router.serializeUrl(result as UrlTree)).toBe('/sign-in');
  });
});

describe('sanitizeReturnUrl', () => {
  it('accepts a path on this origin, keeping its query', () => {
    expect(sanitizeReturnUrl('/orders?tab=open')).toBe('/orders?tab=open');
  });

  it('refuses anything that is not a path on this origin', () => {
    for (const candidate of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      'orders',
      '',
      null,
      undefined
    ]) {
      expect(sanitizeReturnUrl(candidate), String(candidate)).toBeNull();
    }
  });

  it('refuses to bounce back to the sign-in page', () => {
    expect(sanitizeReturnUrl('/sign-in?returnUrl=%2Fblotter')).toBeNull();
  });
});
