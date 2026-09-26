import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TrendPoint } from '../../../../core/finance/finance-models';
import { CURRENCY_SYMBOLS } from '../../../../core/budget/budget.models';

@Component({
  selector: 'app-spending-trend',
  imports: [DecimalPipe],
  templateUrl: './spending-trend.html',
  styleUrl: './spending-trend.css',
})
export class SpendingTrend {
  @Input() points: TrendPoint[] = [];
  @Input() currencySymbol = CURRENCY_SYMBOLS.INR;

  get categories() { return this.points.map((point) => point.label); }
  get values() { return this.points.map((point) => point.amount); }

  get total() {
    return this.values.reduce((sum, value) => sum + value, 0);
  }

  get average() {
    return this.values.length ? Math.round(this.total / this.values.length) : 0;
  }

  get maxValue() {
    return Math.max(...this.values, 1);
  }

  get topMonth() {
    if (!this.values.length) return 'No spending yet';
    const maxValue = this.maxValue;
    const index = this.values.indexOf(maxValue);
    return `${this.categories[index]} · ${this.currencySymbol}${maxValue.toLocaleString('en-IN')}`;
  }
}
