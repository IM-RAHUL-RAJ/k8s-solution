import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

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
		path: '**',
		redirectTo: ''
	}
];

