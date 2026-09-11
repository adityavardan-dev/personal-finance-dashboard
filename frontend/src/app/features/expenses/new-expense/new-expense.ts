import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppLayout } from '../../../shared/app-layout/app-layout';

interface CategoryOption {
  name: string;
}

@Component({
  selector: 'app-new-expense',
  imports: [AppLayout, FormsModule, RouterLink],
  templateUrl: './new-expense.html',
})
export class NewExpenseComponent {
  protected amount = '';
  protected category = 'Food & Dining';
  protected merchant = '';
  protected date = '2026-09-11';
  protected note = '';
  protected saved = false;

  readonly categories: CategoryOption[] = [
    { name: 'Food & Dining' },
    { name: 'Shopping' },
    { name: 'Transport' },
    { name: 'Utilities' },
    { name: 'Entertainment' },
    { name: 'Other' },
  ];

  protected saveExpense(): void {
    if (!this.amount || Number(this.amount) <= 0 || !this.merchant.trim()) return;
    this.saved = true;
  }

  protected resetForm(): void {
    this.amount = '';
    this.merchant = '';
    this.note = '';
    this.saved = false;
  }
}
