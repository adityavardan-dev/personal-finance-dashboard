import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryIcon } from '../../../../shared/category-icon/category-icon';
import { TransactionType } from '../../../expenses/expense.service';
import { CURRENCY_SYMBOLS } from '../../../../core/budget/budget.models';

export interface ActivityTransaction {
  id: string;
  merchant: string;
  category: string;
  date: string;
  amount: number;
  type: TransactionType;
}

@Component({
  selector: 'app-recent-activity',
  imports: [RouterLink, DecimalPipe, CategoryIcon],
  templateUrl: './recent-activity.html',
})
export class RecentActivity {
  @Input() transactions: ActivityTransaction[] = [];
  @Input() currencySymbol = CURRENCY_SYMBOLS.INR;
}
