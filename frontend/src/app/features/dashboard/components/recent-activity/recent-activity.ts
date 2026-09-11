import { Component } from '@angular/core';
import { DecimalPipe, NgFor } from '@angular/common';

@Component({
  selector: 'app-recent-activity',
  imports: [NgFor, DecimalPipe],
  templateUrl: './recent-activity.html',
})
export class RecentActivity {
  transactions = [
    {
      icon: '☕',
      merchant: 'Brew & Co.',
      category: 'Coffee',
      date: 'Aug 4',
      amount: 720,
      type: 'debit',
    },
    {
      icon: '🛍',
      merchant: 'Moda Street',
      category: 'Shopping',
      date: 'Aug 3',
      amount: 2480,
      type: 'debit',
    },
    {
      icon: '📦',
      merchant: 'Parcel Hub',
      category: 'Delivery',
      date: 'Aug 2',
      amount: 1150,
      type: 'debit',
    },
    {
      icon: '⚡',
      merchant: 'Energy Co.',
      category: 'Utilities',
      date: 'Aug 1',
      amount: 3620,
      type: 'debit',
    },
    {
      icon: '💼',
      merchant: 'Payroll',
      category: 'Income',
      date: 'Jul 31',
      amount: 52200,
      type: 'credit',
    },
  ];
}
