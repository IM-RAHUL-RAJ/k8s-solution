import { Routes } from '@angular/router';
import { adminGuard, authGuard, customerGuard } from './core/auth/auth.guard';

// Public pages stay reachable directly. Protected workspace routes run authGuard.
export const routes: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./components/users/landing/landing-page').then((m) => m.LandingPage)
	},
	{
		path: 'sign-in',
		loadComponent: () =>
			import('./components/users/login/login.component').then((m) => m.LoginComponent)
	},
	{
		path: 'admin',
		title: 'Admin',
		canActivate: [authGuard, adminGuard],
		loadComponent: () =>
			import('./components/users/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent)
	},
	{
		path: 'dashboard',
		canActivate: [authGuard, customerGuard],
		loadComponent: () =>
			import('./components/users/dashboard/dashboard.component').then((m) => m.DashboardComponent)
	},
	{
    path: 'order-ticket',
    title: 'Order ticket',
    canActivate: [authGuard, customerGuard],
    loadComponent: () =>
      import('./components/users/order-ticket/order-ticket.component').then(
        (m) => m.OrderTicketComponent
      )
  },
  {
    path: 'watchlist',
    title: 'Watchlist',
    canActivate: [authGuard, customerGuard],
    loadComponent: () =>
      import('./components/users/watchlist/watchlist.component').then(
        (m) => m.WatchlistComponent
      )
  },
  {
    path: 'blotter',
    title: 'Blotter',
    canActivate: [authGuard, customerGuard],
    loadComponent: () =>
      import('./components/users/order-history/order-history.component').then(
        (m) => m.OrderHistoryComponent
      )
  },
  {
    path: 'account',
    title: 'Account',
    canActivate: [authGuard, customerGuard],
    loadComponent: () =>
      import('./components/users/account/account.component').then(
        (m) => m.AccountComponent
      )
  },
	{
		path: '**',
		redirectTo: ''
	}
];

