import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BudgetStore } from '../../core/budget/budget.store';
import { CURRENCY_SYMBOLS } from '../../core/budget/budget.models';
import { FinanceMetricsStore } from '../../core/finance/finance-metrics.store';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { BudgetEditorComponent } from '../budgets/budget-editor/budget-editor';
import { HeroCard } from './components/hero-card/hero-card';
import { InsightBanner } from './components/insight-banner/insight-banner';
import { SpendingTrend } from './components/spending-trend/spending-trend';

@Component({
  selector: 'app-dashboard',
  imports: [HeroCard, AppLayout, SpendingTrend, InsightBanner, BudgetEditorComponent, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  private readonly document = inject(DOCUMENT);
  protected readonly budgetStore = inject(BudgetStore);
  protected readonly metricsStore = inject(FinanceMetricsStore);
  protected readonly currencySymbol = computed(() => CURRENCY_SYMBOLS[this.budgetStore.currency()]);
  protected readonly totalSpent = computed(() => this.metricsStore.metrics()?.currentMonthSpend ?? 0);
  protected readonly trend = computed(() => this.metricsStore.metrics()?.sixMonthTrend ?? []);
  protected readonly primaryInsight = computed(() => this.metricsStore.metrics()?.insights[0] ?? null);

  constructor() {
    this.metricsStore.load();
  }

  protected scrollToBudget(): void {
    this.document.getElementById('budget-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
