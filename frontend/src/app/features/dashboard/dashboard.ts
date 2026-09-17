import { Component, inject, OnInit } from '@angular/core';
import { HeroCard } from './components/hero-card/hero-card';
import { RecentActivity, ActivityTransaction } from './components/recent-activity/recent-activity';
import { SpendingTrend } from './components/spending-trend/spending-trend';
import { InsightBanner } from './components/insight-banner/insight-banner';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { ExpenseService } from '../expenses/expense.service';

@Component({
  selector: 'app-dashboard',
  imports: [HeroCard, AppLayout, SpendingTrend, RecentActivity, InsightBanner],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);

  protected totalSpent = 0;
  protected recentTransactions: ActivityTransaction[] = [];

  ngOnInit(): void {
    this.expenseService.list().subscribe({
      next: (expenses) => {
        this.totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
        this.recentTransactions = [...expenses]
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
          }));
      },
      error: () => {
        // Keep defaults on API failure — no crash
      },
    });
  }
}