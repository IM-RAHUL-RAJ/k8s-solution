import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { sanitizeReturnUrl } from '../../../core/guards/return-url';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';
import { ThemeToggleComponent } from '../shared/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [ReactiveFormsModule, StatusBadgeComponent, ThemeToggleComponent],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignInComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ApiErrorMessageService);

  /** Only ever a path on this origin, or null. A user-controlled parameter is never followed unchecked. */
  readonly returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly sessionExpired = this.auth.sessionExpired;
  readonly showPassword = signal(false);
  readonly capsLockOn = signal(false);
  /** Bumped on every refusal so the card can replay its shake animation. */
  readonly errorCount = signal(0);

  readonly form = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(64)]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]]
  });

  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigateByUrl(this.returnUrl ?? '/dashboard');
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errors.getMessage(error, 'sign-in'));
        this.errorCount.update((count) => count + 1);
        this.form.controls.password.reset('');
        this.isSubmitting.set(false);
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  onPasswordKey(event: KeyboardEvent): void {
    this.capsLockOn.set(event.getModifierState?.('CapsLock') ?? false);
  }

  protected showError(control: 'username' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  protected isValid(control: 'username' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.valid && field.dirty;
  }
}
