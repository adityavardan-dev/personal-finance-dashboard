import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { CategoryIcon } from '../../shared/category-icon/category-icon';
import { ExpenseService } from '../expenses/expense.service';

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
export class HistoryComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);

  protected transactions: Transaction[] = [];
  protected isLoading = true;
  protected loadError = false;
  protected filter: 'all' | 'expenses' | 'income' = 'all';

  ngOnInit(): void {
    this.expenseService.list().subscribe({
      next: (expenses) => {
        this.transactions = [...expenses].reverse().map((e) => ({
          merchant: e.merchant,
          category: e.category,
          date: new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          }),
          amount: e.amount,
          type: 'debit' as const,
        }));
        this.isLoading = false;
      },
      error: () => {
        this.loadError = true;
        this.isLoading = false;
      },
    });
  }

  get filteredTransactions(): Transaction[] {
    if (this.filter === 'expenses') return this.transactions.filter((t) => t.type === 'debit');
    if (this.filter === 'income') return this.transactions.filter((t) => t.type === 'credit');
    return this.transactions;
  }

  get totalExpenses(): number {
    return this.transactions.filter((t) => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
  }

  get totalIncome(): number {
    return this.transactions.filter((t) => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
  }

  protected setFilter(filter: 'all' | 'expenses' | 'income'): void {
    this.filter = filter;
  }
}
