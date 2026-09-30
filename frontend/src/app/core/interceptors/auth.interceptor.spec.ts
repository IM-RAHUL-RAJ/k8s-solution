import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  const expireSession = vi.fn();

  beforeEach(() => {
    expireSession.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken: () => 'test-token', expireSession } },
        { provide: Router, useValue: { url: '/blotter' } }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('a request to the trade API carries the bearer token', () => {
    http.get('/api/v1/accounts/1/orders').subscribe();

    const req = httpMock.expectOne('/api/v1/accounts/1/orders');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush([]);
  });

  it('a request to the protected auth route carries the bearer token', () => {
    http.get('/auth/me').subscribe();

    const req = httpMock.expectOne('/auth/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({});
  });

  it('a request to a third-party origin does not carry the bearer token', () => {
    const url = 'https://api.fauxnance.example/api/v1/quote/ABC';

    http.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('a look-alike host does not carry the bearer token', () => {
    const url = `https://${window.location.hostname}.evil.example/api/v1/orders`;

    http.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('a static asset on the platform origin does not carry the bearer token', () => {
    http.get('/assets/config.json').subscribe();

    const req = httpMock.expectOne('/assets/config.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('the unauthenticated auth routes are called without a header', () => {
    for (const path of ['/auth/login', '/auth/register', '/auth/refresh']) {
      http.post(path, {}).subscribe();

      const req = httpMock.expectOne(path);
      expect(req.request.headers.has('Authorization'), path).toBe(false);
      req.flush({});
    }
  });

  it('a 401 from the trade API ends the session and returns to sign-in', () => {
    http.get('/api/v1/accounts/1').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/v1/accounts/1')
      .flush({ errorCode: 'AUTH-401' }, { status: 401, statusText: 'Unauthorized' });

    expect(expireSession).toHaveBeenCalledWith('/blotter');
  });
});
