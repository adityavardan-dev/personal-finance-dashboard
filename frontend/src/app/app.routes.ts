import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/auth/signup/signup').then((m) => m.SignupComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'insights',
    loadComponent: () => import('./features/insights/insights').then((m) => m.InsightsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'peer-splits',
    loadComponent: () =>
      import('./features/peer-splits/peer-split-overview').then(
        (module) => module.PeerSplitOverviewComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'peer-splits/new',
    loadComponent: () => import('./features/expenses/new-expense/new-expense').then((m) => m.NewExpenseComponent),
    canActivate: [authGuard],
  },
  {
    path: 'peer-splits/:id',
    loadComponent: () =>
      import('./features/peer-splits/peer-split-detail').then(
        (module) => module.PeerSplitDetailComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'expenses/new',
    loadComponent: () => import('./features/expenses/new-expense/new-expense').then((m) => m.NewExpenseComponent),
    canActivate: [authGuard],
  },
  {
    path: 'expenses/intake',
    loadComponent: () =>
      import('./features/expenses/context-intake/context-intake').then(
        (module) => module.ContextIntakeComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'expenses/:id/edit',
    loadComponent: () => import('./features/expenses/new-expense/new-expense').then((m) => m.NewExpenseComponent),
    canActivate: [authGuard],
  },
  {
    path: 'history/:id',
    loadComponent: () => import('./features/history/transaction-detail/transaction-detail').then((m) => m.TransactionDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history/history').then((m) => m.HistoryComponent),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
  },
];
