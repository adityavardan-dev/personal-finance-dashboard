import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard';
import { InsightsComponent } from './features/insights/insights';
import { NewExpenseComponent } from './features/expenses/new-expense/new-expense';
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
    path: 'expenses/new',
    component: NewExpenseComponent,
    canActivate: [authGuard],
  },
];
