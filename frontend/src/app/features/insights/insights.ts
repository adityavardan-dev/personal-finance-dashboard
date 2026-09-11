import { DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppLayout } from '../../shared/app-layout/app-layout';

interface Category {
  name: string;
  amount: number;
  share: number;
  icon: string;
}

@Component({
  selector: 'app-insights',
  imports: [AppLayout, DecimalPipe, RouterLink],
  templateUrl: './insights.html',
})
export class InsightsComponent {
  readonly monthlySpend = 18540;
  readonly previousMonthSpend = 16280;
  readonly budget = 30000;
  readonly categories: Category[] = [
    { name: 'Shopping', amount: 5240, share: 28, icon: '🛍' },
    { name: 'Food & Dining', amount: 3980, share: 21, icon: '🍽' },
    { name: 'Transport', amount: 2840, share: 15, icon: '🚗' },
    { name: 'Utilities', amount: 2460, share: 13, icon: '⚡' },
    { name: 'Entertainment', amount: 1840, share: 10, icon: '🎬' },
  ];

  readonly weeklySpend = [3200, 2480, 3620, 2890, 4140, 2210, 0];
  readonly weeklyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  get changePercent(): number {
    return Math.round(((this.monthlySpend - this.previousMonthSpend) / this.previousMonthSpend) * 100);
  }

  get remaining(): number {
    return this.budget - this.monthlySpend;
  }

  get averageDaily(): number {
    return Math.round(this.monthlySpend / 20);
  }

  get maxWeeklySpend(): number {
    return Math.max(...this.weeklySpend);
  }
}
