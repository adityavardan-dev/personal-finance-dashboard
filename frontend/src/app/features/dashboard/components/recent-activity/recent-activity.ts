import { DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryIcon } from '../../../../shared/category-icon/category-icon';

@Component({
  selector: 'app-recent-activity',
  imports: [RouterLink, DecimalPipe, CategoryIcon],
  templateUrl: './recent-activity.html',
})
export class RecentActivity {
  transactions = [
    { merchant: 'Brew & Co.', category: 'Coffee', date: 'Aug 4', amount: 720, type: 'debit' },
    { merchant: 'Moda Street', category: 'Shopping', date: 'Aug 3', amount: 2480, type: 'debit' },
    { merchant: 'Parcel Hub', category: 'Delivery', date: 'Aug 2', amount: 1150, type: 'debit' },
    { merchant: 'Energy Co.', category: 'Utilities', date: 'Aug 1', amount: 3620, type: 'debit' },
    { merchant: 'Payroll', category: 'Income', date: 'Jul 31', amount: 52200, type: 'credit' },
  ];
}
