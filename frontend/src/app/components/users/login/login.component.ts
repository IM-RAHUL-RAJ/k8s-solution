import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, LoginRequest } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { SessionSocketService } from '../../../core/auth/session-socket.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private sessionSocket = inject(SessionSocketService);

  /**
   * Form group for sign-in with username and password validation
   */
  signInForm: FormGroup;

  /**
   * Track submission state
   */
  isSubmitting = signal(false);

  /**
   * Error message from failed login attempt
   */
  errorMessage = signal<string | null>(null);

  /**
   * Track current theme for login page icon toggle
   */
  currentTheme = signal<'light' | 'dark'>('light');

  /**
   * Toggle password visibility for login field
   */
  showPassword = signal(false);

  constructor() {
    this.currentTheme.set(this.themeService.isDarkMode() ? 'dark' : 'light');

    this.signInForm = this.fb.group({
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3)
        ]
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6)
        ]
      ]
    });
  }

  /**
   * Toggle light/dark theme from login screen
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.currentTheme.set(this.themeService.isDarkMode() ? 'dark' : 'light');
  }

  /**
   * Toggle whether password text is visible
   */
  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  /**
   * Handle form submission
   * Validates form and sends login request
   */
  onSubmit(): void {
    // Clear previous error
    this.errorMessage.set(null);

    // Validate form
    if (this.signInForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.signInForm.controls).forEach(key => {
        this.signInForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting.set(true);

    const credentials: LoginRequest = this.signInForm.value;

    this.authService.login(credentials).subscribe({
      next: (response: any) => {
        this.isSubmitting.set(false);
        // Clear form on success
        this.signInForm.reset();
        
        // Connect to session WebSocket for real-time multi-device logout
        console.log('[Login] Connecting to session gateway...');
        this.sessionSocket.connect();
        
        // Navigate to dashboard
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      },
      error: (error: any) => {
        this.isSubmitting.set(false);
        // Display error message to user
        this.errorMessage.set(error.message || 'Sign-in failed. Please try again.');
      }
    });
  }

  /**
   * Get username form control
   */
  get username() {
    return this.signInForm.get('username');
  }

  /**
   * Get password form control
   */
  get password() {
    return this.signInForm.get('password');
  }

  /**
   * Check if username field has validation error and is touched
   */
  usernameError(): string | null {
    const control = this.username;
    if (control?.hasError('required') && control?.touched) {
      return 'Username is required';
    }
    if (control?.hasError('minlength') && control?.touched) {
      return 'Username must be at least 3 characters';
    }
    return null;
  }

  /**
   * Check if password field has validation error and is touched
   */
  passwordError(): string | null {
    const control = this.password;
    if (control?.hasError('required') && control?.touched) {
      return 'Password is required';
    }
    if (control?.hasError('minlength') && control?.touched) {
      return 'Password must be at least 6 characters';
    }
    return null;
  }

  /**
   * Check if form can be submitted
   */
  canSubmit(): boolean {
    return this.signInForm.valid && !this.isSubmitting();
  }
}
