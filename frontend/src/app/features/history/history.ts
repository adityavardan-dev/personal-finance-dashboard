import { DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { CategoryIcon } from '../../shared/category-icon/category-icon';

interface Transaction {
  merchant: string;
  category: string;
  date: string;
  amount: number;
  type: 'debit' | 'credit';
}

@Component({
  selector: 'app-history',
  imports: [AppLayout, DecimalPipe, RouterLink, CategoryIcon],
  templateUrl: './history.html',
})
export class HistoryComponent {
  readonly transactions: Transaction[] = [
    { merchant: 'Brew & Co.', category: 'Coffee', date: 'Today · Aug 4', amount: 720, type: 'debit' },
    { merchant: 'Moda Street', category: 'Shopping', date: 'Yesterday · Aug 3', amount: 2480, type: 'debit' },
    { merchant: 'Parcel Hub', category: 'Delivery', date: 'Aug 2', amount: 1150, type: 'debit' },
    { merchant: 'Energy Co.', category: 'Utilities', date: 'Aug 1', amount: 3620, type: 'debit' },
    { merchant: 'Payroll', category: 'Income', date: 'Jul 31', amount: 52200, type: 'credit' },
    { merchant: 'City Transit', category: 'Transport', date: 'Jul 30', amount: 680, type: 'debit' },
    { merchant: 'Streambox', category: 'Entertainment', date: 'Jul 29', amount: 799, type: 'debit' },
  ];

  protected filter: 'all' | 'expenses' | 'income' = 'all';

  get filteredTransactions(): Transaction[] {
    if (this.filter === 'expenses') return this.transactions.filter((item) => item.type === 'debit');
    if (this.filter === 'income') return this.transactions.filter((item) => item.type === 'credit');
    return this.transactions;
  }

  get totalExpenses(): number {
    return this.transactions.filter((item) => item.type === 'debit').reduce((sum, item) => sum + item.amount, 0);
  }

  get totalIncome(): number {
    return this.transactions.filter((item) => item.type === 'credit').reduce((sum, item) => sum + item.amount, 0);
  }

  protected setFilter(filter: 'all' | 'expenses' | 'income'): void {
    this.filter = filter;
  }
}
