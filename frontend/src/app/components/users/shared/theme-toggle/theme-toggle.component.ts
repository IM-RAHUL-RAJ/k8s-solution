import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../../../core/theme/theme.service';

/** Sun and moon cross-fade and turn as the theme changes. */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeToggleComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly isDark = computed(() => this.themeService.theme() === 'dark');

  protected toggle(): void {
    this.themeService.toggle();
  }
}
