import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from './components/users/shared/app-header/app-header.component';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppHeaderComponent, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly themeService = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  constructor() {
    // Ensure theme preference is applied on every app startup/refresh,
    // regardless of which route loads first.
    this.themeService.getCurrentTheme();
  }
}
