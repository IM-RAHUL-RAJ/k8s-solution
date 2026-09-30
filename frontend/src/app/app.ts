import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';

type NavigationItem = {
  label: string;
  path: string;
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly themeService = inject(ThemeService);
  protected readonly title = signal('Frontend');

  protected readonly navigation = signal<NavigationItem[]>([
    {
      label: 'Landing',
      path: '/'
    }
  ]);

  constructor() {
    // Ensure theme preference is applied on every app startup/refresh,
    // regardless of which route loads first.
    this.themeService.getCurrentTheme();
  }
}
