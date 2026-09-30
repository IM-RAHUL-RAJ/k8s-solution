import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

// /sign-in is the only route a signed-out visitor can reach. Every other route runs authGuard.
export const routes: Routes = [
  {
    path: 'sign-in',
    title: 'Sign in',
    loadComponent: () =>
      import('./components/users/sign-in/sign-in.component').then((m) => m.SignInComponent)
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'dashboard',
    title: 'Dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/users/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      )
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
    // Redirect routes cannot carry a guard; the target route runs authGuard.
    path: '**',
    redirectTo: 'dashboard'
  }
];
