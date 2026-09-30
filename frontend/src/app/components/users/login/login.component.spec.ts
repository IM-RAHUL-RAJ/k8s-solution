import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: { login: ReturnType<typeof vi.fn> };
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    authService = {
      login: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  describe('Form Validation', () => {
    it('should disable submit button with empty fields', () => {
      fixture.detectChanges();
      expect(component.canSubmit()).toBe(false);
    });

    it('should validate username field', () => {
      const usernameControl = component.signInForm.get('username');
      usernameControl?.setValue('');
      usernameControl?.markAsTouched();
      expect(component.usernameError()).toBe('Username is required');
    });

    it('should validate username minimum length', () => {
      const usernameControl = component.signInForm.get('username');
      usernameControl?.setValue('ab');
      usernameControl?.markAsTouched();
      expect(component.usernameError()).toBe('Username must be at least 3 characters');
    });

    it('should validate password field', () => {
      const passwordControl = component.signInForm.get('password');
      passwordControl?.setValue('');
      passwordControl?.markAsTouched();
      expect(component.passwordError()).toBe('Password is required');
    });

    it('should validate password minimum length', () => {
      const passwordControl = component.signInForm.get('password');
      passwordControl?.setValue('12345');
      passwordControl?.markAsTouched();
      expect(component.passwordError()).toBe('Password must be at least 6 characters');
    });

    it('should enable submit button with valid credentials', () => {
      component.signInForm.patchValue({
        username: 'testuser',
        password: 'password123'
      });
      expect(component.canSubmit()).toBe(true);
    });
  });

  describe('Form Submission', () => {
    it('should not submit form with invalid credentials', () => {
      component.signInForm.patchValue({
        username: '',
        password: ''
      });
      component.onSubmit();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should submit form with valid credentials', async () => {
      const loginResponse = {
        token: 'test-token-123',
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      authService.login.mockReturnValue(of(loginResponse));

      component.signInForm.patchValue({
        username: 'testuser',
        password: 'password123'
      });

      component.onSubmit();

      expect(authService.login).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123'
      });

      await fixture.whenStable();

      expect(navigateSpy).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
      expect(component.signInForm.value).toEqual({ username: null, password: null });
    });

    it('should display error message on failed login', async () => {
      const error = new Error('Invalid username or password. Please try again.');
      authService.login.mockReturnValue(throwError(() => error));

      component.signInForm.patchValue({
        username: 'testuser',
        password: 'wrongpassword'
      });

      component.onSubmit();

      await fixture.whenStable();

      expect(component.errorMessage()).toBe('Invalid username or password. Please try again.');
      expect(component.isSubmitting()).toBe(false);
    });

    it('should disable submit button during submission', async () => {
      const loginResponse = {
        token: 'test-token-123',
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      const loginSubject = new Subject<any>();
      authService.login.mockReturnValue(loginSubject.asObservable());

      component.signInForm.patchValue({
        username: 'testuser',
        password: 'password123'
      });

      expect(component.isSubmitting()).toBe(false);
      component.onSubmit();
      expect(component.isSubmitting()).toBe(true);

      loginSubject.next(loginResponse);
      loginSubject.complete();

      await fixture.whenStable();
      expect(component.isSubmitting()).toBe(false);
    });

    it('should clear previous error on new submission attempt', () => {
      component.errorMessage.set('Previous error');
      
      component.signInForm.patchValue({
        username: '',
        password: ''
      });

      component.onSubmit();

      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('Test Identifiers', () => {
    it('should have stable test identifier for username input', () => {
      fixture.detectChanges();
      const usernameInput = fixture.nativeElement.querySelector('[data-testid="username-input"]');
      expect(usernameInput).toBeTruthy();
    });

    it('should have stable test identifier for password input', () => {
      fixture.detectChanges();
      const passwordInput = fixture.nativeElement.querySelector('[data-testid="password-input"]');
      expect(passwordInput).toBeTruthy();
    });

    it('should have stable test identifier for submit button', () => {
      fixture.detectChanges();
      const submitButton = fixture.nativeElement.querySelector('[data-testid="submit-button"]');
      expect(submitButton).toBeTruthy();
    });

    it('should have stable test identifier for error message', async () => {
      const error = new Error('Test error');
      authService.login.mockReturnValue(throwError(() => error));

      component.signInForm.patchValue({
        username: 'testuser',
        password: 'password123'
      });

      component.onSubmit();

      await fixture.whenStable();
      fixture.detectChanges();
      const errorBanner = fixture.nativeElement.querySelector('[data-testid="error-message"]');
      expect(errorBanner).toBeTruthy();
    });
  });
});
