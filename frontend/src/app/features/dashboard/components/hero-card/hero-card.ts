import { DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-hero-card',
  imports: [DecimalPipe],
  templateUrl: './hero-card.html',
  styleUrl: './hero-card.css',
})
export class HeroCard {

  spent = 18540;
  budget = 30000;
  percentage = (this.spent / this.budget) * 100;
  daysLeft = 11;

}
