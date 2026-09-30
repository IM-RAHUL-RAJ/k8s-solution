import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService as AuthApi } from '../../../generated/auth-api';
import { AuthService } from './auth.service';

function fakeJwt(claims: object): string {
  return `header.${btoa(JSON.stringify(claims))}.signature`;
}

describe('AuthService', () => {
  const login = vi.fn();
  const refresh = vi.fn();
  const navigate = vi.fn();
  let service: AuthService;

  beforeEach(() => {
    login.mockReset();
    refresh.mockReset();
    navigate.mockReset();
    navigate.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApi, useValue: { login, refresh } },
        { provide: Router, useValue: { navigate, url: '/blotter' } }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => service.logout());

  it('valid credentials start a session that knows the account', () => {
    login.mockReturnValue(
      of({ accessToken: fakeJwt({ accountId: 7 }), refreshToken: 'r1', tokenType: 'Bearer', expiresIn: 900 })
    );

    service.login('trader01', 'correct horse battery').subscribe();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()).toEqual({ username: 'trader01', accountId: 7 });
    expect(service.getToken()).toContain('header.');
  });

  it('a refused sign-in leaves the visitor signed out', () => {
    login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { errorCode: 'AUTH-401' } }))
    );

    service.login('trader01', 'wrong password!!').subscribe({ error: () => undefined });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  it('signing out clears the session', () => {
    login.mockReturnValue(
      of({ accessToken: fakeJwt({ accountId: 7 }), refreshToken: 'r1', tokenType: 'Bearer', expiresIn: 900 })
    );
    service.login('trader01', 'correct horse battery').subscribe();

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.user()).toBeNull();
  });

  it('the token is never written to browser storage', () => {
    login.mockReturnValue(
      of({ accessToken: fakeJwt({ accountId: 7 }), refreshToken: 'r1', tokenType: 'Bearer', expiresIn: 900 })
    );

    service.login('trader01', 'correct horse battery').subscribe();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('an expired session signs out and returns to sign-in carrying where the user was', () => {
    service.expireSession('/blotter');

    expect(service.sessionExpired()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], { queryParams: { returnUrl: '/blotter' } });
  });
});
