import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

// /sign-in is the only route a signed-out visitor can reach. Every other route runs authGuard.
export const routes: Routes = [
	{
		path: '',
		canActivate: [guestGuard],
		loadComponent: () =>
			import('./components/users/landing/landing-page').then((m) => m.LandingPage)
	},
	{
		path: 'sign-in',
		canActivate: [guestGuard],
		loadComponent: () =>
			import('./components/users/login/login.component').then((m) => m.LoginComponent)
	},
	{
		path: 'dashboard',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./components/users/dashboard/dashboard.component').then((m) => m.DashboardComponent)
	},
	{
    path: 'order-ticket',
    title: 'Order ticket',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/users/order-ticket/order-ticket.component').then(
        (m) => m.OrderTicketComponent
      )
  },
  {
    path: 'blotter',
    title: 'Blotter',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/users/order-history/order-history.component').then(
        (m) => m.OrderHistoryComponent
      )
  },
  {
    path: 'account',
    title: 'Account',
    canActivate: [authGuard],
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

