import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { SessionSocketService } from './core/auth/session-socket.service';
import { ThemeService } from './core/theme/theme.service';

describe('App', () => {
  const isAuthenticated = signal(false);

  beforeEach(async () => {
    isAuthenticated.set(false);
    const sessionSocketMock = {
      connect: vi.fn()
    };

    const themeMock = {
      isDarkMode: vi.fn().mockReturnValue(false),
      toggleTheme: vi.fn(),
      getCurrentTheme: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated,
            user: signal(null),
            logout: () => undefined,
            getToken: () => null,
            validateSession: () => of(undefined)
          }
        },
        { provide: SessionSocketService, useValue: sessionSocketMock },
        { provide: ThemeService, useValue: themeMock }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('hides the navigation until the visitor is signed in', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-app-header')).toBeNull();
  });

  it('shows the header once signed in', async () => {
    isAuthenticated.set(true);
    const router = TestBed.inject(Router);
    
    // Navigate to a protected route to set the URL properly
    await router.navigateByUrl('/dashboard');
    
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    // Check for header component in the template
    const headerComponent = fixture.nativeElement.querySelector('app-app-header');
    expect(headerComponent).toBeTruthy();
  });
});
