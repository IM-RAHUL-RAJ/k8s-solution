import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService, LoginRequest, LoginResponse } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = {
      navigate: vi.fn()
    };

    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: router }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      const response: LoginResponse = {
        token: 'test-token-123',
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      service.login(credentials).subscribe({
        next: (result) => {
          expect(result.token).toBe('test-token-123');
          expect(service.getToken()).toBe('test-token-123');
          expect(service.isAuthenticated()).toBe(true);
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush(response);
    });

    it('should handle invalid credentials error', async () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      service.login(credentials).subscribe({
        error: (error) => {
          expect(error.message).toBe('Invalid username or password. Please try again.');
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle network error', async () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      service.login(credentials).subscribe({
        error: (error) => {
          expect(error.message).toContain('Network error');
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle server error', async () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      service.login(credentials).subscribe({
        error: (error) => {
          expect(error.message).toContain('temporarily unavailable');
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('Token Management', () => {
    it('should store token in memory', () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      const response: LoginResponse = {
        token: 'test-token-123',
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      service.login(credentials).subscribe();

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      req.flush(response);

      expect(service.getToken()).toBe('test-token-123');
    });

    it('should return null when no token is stored', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should track authentication state', () => {
      expect(service.isAuthenticated()).toBe(false);

      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      const response: LoginResponse = {
        token: 'test-token-123',
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      service.login(credentials).subscribe();

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      req.flush(response);

      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('Logout', () => {
    it('should clear token on logout', () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      const response: LoginResponse = {
        token: 'test-token-123',
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      service.login(credentials).subscribe();

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      req.flush(response);

      expect(service.getToken()).toBe('test-token-123');
      expect(service.isAuthenticated()).toBe(true);

      service.logout();

      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should navigate to landing page on logout', () => {
      service.logout();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('Security', () => {
    it('should not log credentials or tokens', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      service.login(credentials).subscribe({
        error: () => {
          const calls = errorSpy.mock.calls.map((args) => args.join(' ')).join(' ');
          expect(calls).not.toContain('password');
          expect(calls).not.toContain('token');
          errorSpy.mockRestore();
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      req.flush({ message: 'Error' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should persist token to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      const response: LoginResponse = {
        token: 'test-token-123',
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      service.login(credentials).subscribe();

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      req.flush(response);

      expect(setItemSpy).toHaveBeenCalledWith('access_token', 'test-token-123');
      expect(localStorage.getItem('access_token')).toBe('test-token-123');
      setItemSpy.mockRestore();
    });
  });
});
