import { DecimalPipe } from '@angular/common';
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
  @Input() currencySymbol = '₹';
  @Output() budgetSetupRequested = new EventEmitter<void>();
  readonly radius = 38;
  readonly circumference = 2 * Math.PI * this.radius;

  get percentage(): number {
    return this.budget ? (this.spent / this.budget) * 100 : 0;
  }

  get visualPercentage(): number {
    return Math.min(this.percentage, 100);
  }

  get remaining(): number | null {
    return this.budget === null ? null : this.budget - this.spent;
  }

  get daysLeft(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(lastDay - now.getDate() + 1, 0);
  }

  get progressOffset(): number {
    return this.circumference - (this.visualPercentage / 100) * this.circumference;
  }
}
