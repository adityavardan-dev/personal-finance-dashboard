import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CurrencyCode } from '../../core/budget/budget.models';
import { BudgetStore } from '../../core/budget/budget.store';
import { FinanceMetricsStore } from '../../core/finance/finance-metrics.store';
import { ProfileStore } from '../../core/profile/profile.store';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { AuthService } from '../auth/auth';

@Component({ selector: 'app-profile', imports: [AppLayout, FormsModule, RouterLink], templateUrl: './profile.html' })
export class ProfileComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly budgetStore = inject(BudgetStore);
  private readonly metricsStore = inject(FinanceMetricsStore);
  protected readonly profileStore = inject(ProfileStore);
  protected currency: CurrencyCode = 'INR';
  protected successMessage = '';

  constructor() {
    this.profileStore.load();
    effect(() => { const profile = this.profileStore.profile(); if (profile) this.currency = profile.preferences.currency; });
  }

  protected savePreferences(): void {
    this.successMessage = '';
    this.profileStore.updateCurrency(this.currency).subscribe({ next: () => this.successMessage = 'Preferences saved.' });
  }

  protected logout(): void {
    this.profileStore.clear();
    this.metricsStore.clear();
    this.budgetStore.clear();
    this.authService.clearSession();
    void this.router.navigate(['/login']);
  }
}
