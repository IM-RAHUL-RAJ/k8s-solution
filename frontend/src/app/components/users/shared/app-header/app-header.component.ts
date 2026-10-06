import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

interface NavigationItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ThemeToggleComponent, BrandLogoComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppHeaderComponent {
  private readonly auth = inject(AuthService);

  protected readonly mustChangePassword = this.auth.mustChangePassword;

  private readonly customerItems: NavigationItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Order ticket', path: '/order-ticket' },
    { label: 'Watchlist', path: '/watchlist' },
    { label: 'Blotter', path: '/blotter' },
    { label: 'Account', path: '/account' }
  ];

  private readonly adminItems: NavigationItem[] = [{ label: 'Admin', path: '/admin' }];

  protected readonly navigationItems = computed(() => (this.auth.isAdmin() ? this.adminItems : this.customerItems));

  protected signOut(): void {
    this.auth.logout();
  }
}
