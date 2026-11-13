import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard';
import { InsightsComponent } from './features/insights/insights';
import { NewExpenseComponent } from './features/expenses/new-expense/new-expense';
import { HistoryComponent } from './features/history/history';
import { TransactionDetailComponent } from './features/history/transaction-detail/transaction-detail';
import { ProfileComponent } from './features/profile/profile';
import { LoginComponent } from './features/auth/login/login';
import { SignupComponent } from './features/auth/signup/signup';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'signup',
    component: SignupComponent,
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'insights',
    component: InsightsComponent,
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
    redirectTo: '/expenses/new?mode=split',
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
    component: NewExpenseComponent,
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
    component: NewExpenseComponent,
    canActivate: [authGuard],
  },
  {
    path: 'history/:id',
    component: TransactionDetailComponent,
    canActivate: [authGuard],
  },
  {
    path: 'history',
    component: HistoryComponent,
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard],
  },
];
