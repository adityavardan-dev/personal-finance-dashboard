import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BudgetStore } from '../../core/budget/budget.store';
import { CURRENCY_SYMBOLS } from '../../core/budget/budget.models';
import { FinanceMetricsStore } from '../../core/finance/finance-metrics.store';
import { WeekMetric } from '../../core/finance/finance-models';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { CategoryIcon } from '../../shared/category-icon/category-icon';

@Component({
  selector: 'app-insights',
  imports: [AppLayout, DatePipe, DecimalPipe, RouterLink, CategoryIcon],
  templateUrl: './insights.html',
})
export class InsightsComponent {
  protected readonly budgetStore = inject(BudgetStore);
  protected readonly metricsStore = inject(FinanceMetricsStore);
  protected readonly selectedWeekIndex = signal(-1);

  constructor() { this.metricsStore.load(); }

  get metrics() { return this.metricsStore.metrics(); }
  get monthlySpend() { return this.metrics?.currentMonthSpend ?? 0; }
  get previousMonthSpend() { return this.metrics?.previousMonthSpend ?? 0; }
  get budget() { return this.metrics?.budgetLimit ?? null; }
  get currencySymbol() { return CURRENCY_SYMBOLS[this.budgetStore.currency()]; }
  get remaining() { return this.metrics?.budgetRemaining ?? null; }
  get budgetUsedPercent() { return this.metrics?.budgetUsedPercentage ?? null; }
  get averageDaily() { return this.metrics?.averageDailySpend ?? 0; }
  get monthWeeks() { return this.metrics?.monthWeeks ?? []; }
  get effectiveWeekIndex() {
    if (!this.monthWeeks.length) return 0;
    if (this.selectedWeekIndex() >= 0) return Math.min(this.selectedWeekIndex(), this.monthWeeks.length - 1);
    const asOf = this.metrics?.asOfDate ?? '';
    return Math.max(0, this.monthWeeks.findIndex((week) => asOf >= week.startDate && asOf <= week.endDate));
  }
  get selectedWeek(): WeekMetric | null { return this.monthWeeks[this.effectiveWeekIndex] ?? null; }
  get weeklySpend() { return this.selectedWeek?.days.map((point) => point.amount) ?? []; }
  get weeklyLabels() { return this.selectedWeek?.days.map((point) => point.label) ?? []; }
  get maxWeeklySpend() { return Math.max(...this.weeklySpend, 1); }
  get weeklyTotal() { return this.weeklySpend.reduce((total, amount) => total + amount, 0); }
  protected previousWeek(): void { this.selectedWeekIndex.set(Math.max(0, this.effectiveWeekIndex - 1)); }
  protected nextWeek(): void { this.selectedWeekIndex.set(Math.min(this.monthWeeks.length - 1, this.effectiveWeekIndex + 1)); }
  get categories() { return (this.metrics?.categories ?? []).map((category) => ({ name: category.category, amount: category.amount, share: category.percentage, limitUsedPercentage: category.limitUsedPercentage })); }
  get primaryInsight() { return this.metrics?.insights[0] ?? null; }
  get comparisonText() {
    const comparison = this.metrics?.monthComparison;
    if (!comparison) return '';
    if (comparison.direction === 'new-spend') return 'Spending started this month.';
    if (comparison.direction === 'unchanged') return 'Spending is unchanged from last month.';
    return `Spending is ${Math.abs(comparison.percentageDelta ?? 0)}% ${comparison.direction} from last month.`;
  }
}
