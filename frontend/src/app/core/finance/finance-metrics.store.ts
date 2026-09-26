import { effect, inject, Injectable, signal } from '@angular/core';
import { BudgetStore } from '../budget/budget.store';
import { ExpenseService } from '../../features/expenses/expense.service';
import { calculateDashboardMetrics } from './finance-calculations';
import { DashboardMetrics, FinanceTransaction } from './finance-models';

export type MetricsStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class FinanceMetricsStore {
  private readonly expenseService = inject(ExpenseService);
  private readonly budgetStore = inject(BudgetStore);
  private readonly statusState = signal<MetricsStatus>('idle');
  private readonly metricsState = signal<DashboardMetrics | null>(null);
  private readonly errorState = signal<string | null>(null);
  private readonly transactionsState = signal<FinanceTransaction[] | null>(null);
  private referenceDate = new Date();

  readonly status = this.statusState.asReadonly();
  readonly metrics = this.metricsState.asReadonly();
  readonly errorMessage = this.errorState.asReadonly();
  readonly transactions = this.transactionsState.asReadonly();

  constructor() {
    effect(() => {
      const transactions = this.transactionsState();
      const budget = this.budgetStore.budget();
      const budgetStatus = this.budgetStore.status();
      if (transactions === null || budgetStatus === 'loading' || budgetStatus === 'idle') return;
      if (budgetStatus === 'error' || !budget) {
        this.statusState.set('error');
        this.errorState.set('Unable to load financial metrics. Please try again.');
        return;
      }
      this.metricsState.set(calculateDashboardMetrics(transactions, budget, this.referenceDate));
      this.statusState.set('loaded');
      this.errorState.set(null);
    });
  }

  load(referenceDate = new Date()): void {
    if (this.statusState() === 'loading' || this.statusState() === 'loaded') return;
    this.referenceDate = referenceDate;
    this.statusState.set('loading');
    this.errorState.set(null);
    this.budgetStore.load();
    this.expenseService.list().subscribe({
      next: (transactions) => this.transactionsState.set(transactions),
      error: () => {
        this.statusState.set('error');
        this.errorState.set('Unable to load financial metrics. Please try again.');
      },
    });
  }

  refresh(referenceDate = new Date()): void {
    this.statusState.set('idle');
    this.transactionsState.set(null);
    this.load(referenceDate);
  }

  clear(): void {
    this.statusState.set('idle');
    this.metricsState.set(null);
    this.transactionsState.set(null);
    this.errorState.set(null);
  }
}
