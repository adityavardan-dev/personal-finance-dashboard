import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HeroCard } from './components/hero-card/hero-card';
import { RecentActivity, ActivityTransaction } from './components/recent-activity/recent-activity';
import { SpendingTrend } from './components/spending-trend/spending-trend';
import { InsightBanner } from './components/insight-banner/insight-banner';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { ExpenseService } from '../expenses/expense.service';
import { catchError, of } from 'rxjs';
import { BudgetStore } from '../../core/budget/budget.store';
import { CURRENCY_SYMBOLS } from '../../core/budget/budget.models';
import { BudgetEditorComponent } from '../budgets/budget-editor/budget-editor';

@Component({
  selector: 'app-dashboard',
  imports: [HeroCard, AppLayout, SpendingTrend, RecentActivity, InsightBanner, BudgetEditorComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  private readonly document = inject(DOCUMENT);
  private readonly expenseService = inject(ExpenseService);
  protected readonly budgetStore = inject(BudgetStore);
  protected readonly currencySymbol = computed(() => CURRENCY_SYMBOLS[this.budgetStore.currency()]);

  constructor() {
    this.budgetStore.load();
  }

  private readonly expenses = toSignal(
    this.expenseService.list().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly totalSpent = computed(() =>
    this.expenses()
      .filter((expense) => expense.type === 'expense')
      .reduce((sum, expense) => sum + expense.amount, 0),
  );

  protected scrollToBudget(): void {
    this.document.getElementById('budget-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected readonly recentTransactions = computed<ActivityTransaction[]>(() =>
    [...this.expenses()]
      .reverse()
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        merchant: e.merchant,
        category: e.category,
        date: new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
        amount: e.amount,
        type: e.type,
      })),
  );
}
