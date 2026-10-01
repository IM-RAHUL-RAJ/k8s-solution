import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from './components/users/shared/app-header/app-header.component';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';
import { SessionSocketService } from './core/auth/session-socket.service';
import { filter, map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppHeaderComponent, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  private readonly themeService = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly sessionSocket = inject(SessionSocketService);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly showHeader = computed(() => {
    const path = this.currentUrl().split('?')[0];
    const isPublic = path === '/' || path === '/sign-in';
    return this.auth.isAuthenticated() && !isPublic;
  });

  constructor() {
    // Ensure theme preference is applied on every app startup/refresh,
    // regardless of which route loads first.
    this.themeService.getCurrentTheme();
  }

  ngOnInit(): void {
    // Connect to session gateway if user is already authenticated
    // This covers: tab refresh, new tab, browser restart scenarios
    if (this.auth.isAuthenticated()) {
      console.log('[App] User authenticated, connecting to session gateway');
      this.sessionSocket.connect();
    }
  }
}
