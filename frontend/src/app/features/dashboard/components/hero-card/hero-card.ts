import { DecimalPipe } from '@angular/common';
import { CURRENCY_SYMBOLS } from '../../../../core/budget/budget.models';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-hero-card',
  imports: [DecimalPipe],
  templateUrl: './hero-card.html',
  styleUrl: './hero-card.css',
})
export class HeroCard {
  @Input() spent = 0;
  @Input() budget: number | null = null;
  @Input() currencySymbol = CURRENCY_SYMBOLS.INR;
  @Output() budgetSetupRequested = new EventEmitter<void>();
  get percentage(): number {
    return this.budget ? (this.spent / this.budget) * 100 : 0;
  }

  get visualPercentage(): number {
    return Math.max(0, Math.min(this.percentage, 100));
  }

  get remaining(): number | null {
    return this.budget === null ? null : this.budget - this.spent;
  }

  get daysLeft(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(lastDay - now.getDate() + 1, 0);
  }

}
