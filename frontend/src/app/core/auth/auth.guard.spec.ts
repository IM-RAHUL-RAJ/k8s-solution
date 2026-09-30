import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let authService: { isAuthenticated: ReturnType<typeof vi.fn> };
  let router: { createUrlTree: ReturnType<typeof vi.fn> };
  let routerState: Partial<RouterStateSnapshot>;
  let route: Partial<ActivatedRouteSnapshot>;

  beforeEach(() => {
    authService = {
      isAuthenticated: vi.fn().mockReturnValue(false)
    };

    router = {
      createUrlTree: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });

    routerState = {};
    route = {} as ActivatedRouteSnapshot;
  });

  it('should allow access when authenticated', () => {
    authService.isAuthenticated.mockReturnValue(true);
    routerState.url = '/dashboard';

    const result = TestBed.runInInjectionContext(() =>
      authGuard(route as ActivatedRouteSnapshot, routerState as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });

  it('should redirect to sign-in when not authenticated', () => {
    authService.isAuthenticated.mockReturnValue(false);
    routerState.url = '/dashboard';

    const urlTree = new UrlTree();
    router.createUrlTree.mockReturnValue(urlTree);

    const result = TestBed.runInInjectionContext(() =>
      authGuard(route as ActivatedRouteSnapshot, routerState as RouterStateSnapshot)
    );

    expect(router.createUrlTree).toHaveBeenCalledWith(
      ['/sign-in'],
      expect.any(Object)
    );
  });

  it('should include return URL in redirect', () => {
    authService.isAuthenticated.mockReturnValue(false);
    routerState.url = '/dashboard?tab=overview';

    const urlTree = new UrlTree();
    router.createUrlTree.mockReturnValue(urlTree);

    TestBed.runInInjectionContext(() =>
      authGuard(route as ActivatedRouteSnapshot, routerState as RouterStateSnapshot)
    );

    expect(router.createUrlTree).toHaveBeenCalledWith(
      ['/sign-in'],
      expect.objectContaining({
        queryParams: expect.objectContaining({
          returnUrl: '/dashboard?tab=overview'
        })
      })
    );
  });

  it('should prevent open redirect attacks', () => {
    authService.isAuthenticated.mockReturnValue(false);
    routerState.url = 'https://evil.com/dashboard';

    const urlTree = new UrlTree();
    router.createUrlTree.mockReturnValue(urlTree);

    TestBed.runInInjectionContext(() =>
      authGuard(route as ActivatedRouteSnapshot, routerState as RouterStateSnapshot)
    );

    // URL API normalizes this input into an internal path, still same-origin and safe.
    expect(router.createUrlTree).toHaveBeenCalledWith(['/sign-in'], {
      queryParams: { returnUrl: '/dashboard' }
    });
  });

  it('should prevent double-slash attack vectors', () => {
    authService.isAuthenticated.mockReturnValue(false);
    routerState.url = '//evil.com/dashboard';

    const urlTree = new UrlTree();
    router.createUrlTree.mockReturnValue(urlTree);

    TestBed.runInInjectionContext(() =>
      authGuard(route as ActivatedRouteSnapshot, routerState as RouterStateSnapshot)
    );

    // URL API normalizes this input into a path, so guard includes it as returnUrl.
    expect(router.createUrlTree).toHaveBeenCalledWith(['/sign-in'], {
      queryParams: { returnUrl: '/dashboard' }
    });
  });
});
