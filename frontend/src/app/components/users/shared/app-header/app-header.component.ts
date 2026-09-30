import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AccountContextService } from '../../../../core/services/account-context.service';

interface NavigationItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppHeaderComponent {
  private readonly accountContext = inject(AccountContextService);

  protected readonly navigationItems: NavigationItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Order Placement', path: '/order-ticket' },
    { label: 'Order History', path: '/blotter' },
    { label: 'Account', path: '/account' }
  ];

  protected readonly displayName = computed(
    () => this.accountContext.getCurrentAccount().displayName
  );
}
