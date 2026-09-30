import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { SignInComponent } from './sign-in.component';

describe('SignInComponent', () => {
  const login = vi.fn();
  const navigateByUrl = vi.fn();

  async function setup(returnUrl: string | null = null) {
    login.mockReset();
    navigateByUrl.mockReset();

    await TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [
        { provide: AuthService, useValue: { login, sessionExpired: signal(false) } },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(SignInComponent);
    fixture.detectChanges();
    return fixture;
  }

  function fill(fixture: Awaited<ReturnType<typeof setup>>, username: string, password: string) {
    fixture.componentInstance.form.setValue({ username, password });
  }

  it('valid credentials sign in and redirect to where the user was going', async () => {
    const fixture = await setup('/blotter');
    login.mockReturnValue(of({}));

    fill(fixture, 'trader01', 'correct horse battery');
    fixture.componentInstance.onSubmit();

    expect(login).toHaveBeenCalledWith('trader01', 'correct horse battery');
    expect(navigateByUrl).toHaveBeenCalledWith('/blotter');
  });

  it('valid credentials go to the dashboard when there is no return address', async () => {
    const fixture = await setup();
    login.mockReturnValue(of({}));

    fill(fixture, 'trader01', 'correct horse battery');
    fixture.componentInstance.onSubmit();

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('an off-origin return address is ignored after signing in', async () => {
    const fixture = await setup('https://evil.example/phish');
    login.mockReturnValue(of({}));

    fill(fixture, 'trader01', 'correct horse battery');
    fixture.componentInstance.onSubmit();

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('invalid credentials show a readable error and clear the password', async () => {
    const fixture = await setup();
    login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { errorCode: 'AUTH-401', message: 'Unauthorised' } }))
    );

    fill(fixture, 'trader01', 'wrong password!!');
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    const banner = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="sign-in-error"]');
    expect(banner?.textContent).toContain('Your username or password was not accepted');
    expect(banner?.textContent).not.toContain('Unauthorised');
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('empty fields are blocked by validation', async () => {
    const fixture = await setup();

    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(login).not.toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Enter your username');
    expect(text).toContain('Enter your password');
  });

  it('the form controls carry stable test identifiers', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="username"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="password"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="submit"]')).not.toBeNull();
  });
});
