import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HeroCard } from './components/hero-card/hero-card';
import { RecentActivity, ActivityTransaction } from './components/recent-activity/recent-activity';
import { SpendingTrend } from './components/spending-trend/spending-trend';
import { InsightBanner } from './components/insight-banner/insight-banner';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { ExpenseService } from '../expenses/expense.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [HeroCard, AppLayout, SpendingTrend, RecentActivity, InsightBanner],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  private readonly expenseService = inject(ExpenseService);

  private readonly expenses = toSignal(
    this.expenseService.list().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly totalSpent = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount, 0),
  );

  protected readonly recentTransactions = computed<ActivityTransaction[]>(() =>
    [...this.expenses()]
      .reverse()
      .slice(0, 5)
      .map((e) => ({
        merchant: e.merchant,
        category: e.category,
        date: new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
        amount: e.amount,
        type: 'debit' as const,
      })),
  );
}
