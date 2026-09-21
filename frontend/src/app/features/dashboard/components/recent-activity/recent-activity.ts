import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryIcon } from '../../../../shared/category-icon/category-icon';

export interface ActivityTransaction {
  merchant: string;
  category: string;
  date: string;
  amount: number;
  type: 'debit' | 'credit';
}

@Component({
  selector: 'app-recent-activity',
  imports: [RouterLink, DecimalPipe, CategoryIcon],
  templateUrl: './recent-activity.html',
})
export class RecentActivity {
  @Input() transactions: ActivityTransaction[] = [];
}
