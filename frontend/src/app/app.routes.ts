import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/users/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      )
  },
  {
    path: 'order-ticket',
    loadComponent: () =>
      import('./components/users/order-ticket/order-ticket.component').then(
        (m) => m.OrderTicketComponent
      )
  },
  {
    path: 'blotter',
    loadComponent: () =>
      import('./components/users/order-history/order-history.component').then(
        (m) => m.OrderHistoryComponent
      )
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./components/users/account/account.component').then(
        (m) => m.AccountComponent
      )
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
