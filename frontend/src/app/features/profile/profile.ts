import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { AuthService } from '../auth/auth';
import { BudgetStore } from '../../core/budget/budget.store';
import { FinanceMetricsStore } from '../../core/finance/finance-metrics.store';

@Component({
  selector: 'app-profile',
  imports: [AppLayout, RouterLink],
  templateUrl: './profile.html',
})
export class ProfileComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly budgetStore = inject(BudgetStore);
  private readonly metricsStore = inject(FinanceMetricsStore);

  readonly user = this.resolveUser();
  readonly preferences = [
    { label: 'Currency', value: 'Indian Rupee (₹)' },
    { label: 'Appearance', value: 'System default' },
  ];

  protected logout(): void {
    this.metricsStore.clear();
    this.budgetStore.clear();
    this.authService.clearSession();
    void this.router.navigate(['/login']);
  }

  private resolveUser(): { name: string; email: string; initials: string } {
    const token = this.authService.getAccessToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as { email?: string };
        const email = payload.email ?? '';
        const namePart = email.split('@')[0] ?? '';
        const name = namePart.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const initials = name
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0] ?? '')
          .join('')
          .toUpperCase();
        return { name, email, initials };
      } catch {
        // fall through to default
      }
    }
    return { name: 'User', email: '', initials: 'U' };
  }
}
