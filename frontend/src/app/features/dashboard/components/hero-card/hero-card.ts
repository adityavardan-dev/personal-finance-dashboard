import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-hero-card',
  imports: [DecimalPipe],
  templateUrl: './hero-card.html',
  styleUrl: './hero-card.css',
})
export class HeroCard {
  @Input() spent = 0;
  readonly budget = 30000;
  readonly radius = 38;
  readonly circumference = 2 * Math.PI * this.radius;

  get percentage(): number {
    return this.budget > 0 ? Math.min((this.spent / this.budget) * 100, 100) : 0;
  }

  get daysLeft(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(lastDay - now.getDate() + 1, 0);
  }

  get progressOffset(): number {
    return this.circumference - (this.percentage / 100) * this.circumference;
  }
}
