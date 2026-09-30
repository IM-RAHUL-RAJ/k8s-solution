import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../auth/auth.service';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: { getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = {
      getToken: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Token Attachment', () => {
    it('should attach token to allowed origin (/api)', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('/api/v1/orders').subscribe();

      const req = httpMock.expectOne('/api/v1/orders');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
      req.flush([]);
    });

    it('should attach token to localhost:3000', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('http://localhost:3000/api/orders').subscribe();

      const req = httpMock.expectOne('http://localhost:3000/api/orders');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
      req.flush([]);
    });

    it('should not attach token when no token is present', () => {
      authService.getToken.mockReturnValue(null);

      httpClient.get('/api/v1/orders').subscribe();

      const req = httpMock.expectOne('/api/v1/orders');
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush([]);
    });

    it('should not attach token to third-party origins', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('https://api.fauxnance.com/quote/INFY').subscribe();

      const req = httpMock.expectOne('https://api.fauxnance.com/quote/INFY');
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });

    it('should not attach token to analytics services', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('https://analytics.example.com/track').subscribe();

      const req = httpMock.expectOne('https://analytics.example.com/track');
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });

    it('should not attach token to CDN requests', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('https://cdn.example.com/app.js').subscribe();

      const req = httpMock.expectOne('https://cdn.example.com/app.js');
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });
  });

  describe('Security Requirements', () => {
    it('should use Bearer token format', () => {
      authService.getToken.mockReturnValue('abc123def456');

      httpClient.get('/api/v1/orders').subscribe();

      const req = httpMock.expectOne('/api/v1/orders');
      expect(req.request.headers.get('Authorization')).toBe('Bearer abc123def456');
      req.flush([]);
    });

    it('should handle multiple allowed origins', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('http://localhost:3001/api/data').subscribe();

      const req = httpMock.expectOne('http://localhost:3001/api/data');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
      req.flush({});
    });

    it('should preserve existing headers', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('/api/v1/orders', {
        headers: {
          'X-Custom-Header': 'custom-value'
        }
      }).subscribe();

      const req = httpMock.expectOne('/api/v1/orders');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
      expect(req.request.headers.get('X-Custom-Header')).toBe('custom-value');
      req.flush([]);
    });

    it('should not log tokens in requests', () => {
      authService.getToken.mockReturnValue('test-token-123');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      httpClient.get('/api/v1/orders').subscribe();

      const req = httpMock.expectOne('/api/v1/orders');
      const calls = logSpy.mock.calls.map((args) => args.join(' ')).join(' ');
      expect(calls).not.toContain('test-token-123');
      req.flush([]);
      logSpy.mockRestore();
    });
  });

  describe('Request Path Validation', () => {
    it('should allow /api paths', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('/api/v1/test').subscribe();

      const req = httpMock.expectOne('/api/v1/test');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
      req.flush({});
    });

    it('should allow localhost origins', () => {
      authService.getToken.mockReturnValue('test-token-123');

      httpClient.get('http://localhost:8080/api/data').subscribe();

      const req = httpMock.expectOne('http://localhost:8080/api/data');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
      req.flush({});
    });
  });
});
