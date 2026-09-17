import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
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
export class HistoryComponent {
  private readonly expenseService = inject(ExpenseService);

  protected readonly loadError = signal(false);

  private readonly expenses = toSignal(
    this.expenseService.list().pipe(
      catchError(() => {
        this.loadError.set(true);
        return of([]);
      }),
    ),
    { initialValue: null },
  );

  protected readonly isLoading = computed(() => this.expenses() === null);

  protected readonly transactions = computed<Transaction[]>(() =>
    [...(this.expenses() ?? [])].reverse().map((e) => ({
      merchant: e.merchant,
      category: e.category,
      date: new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      }),
      amount: e.amount,
      type: 'debit' as const,
    })),
  );

  protected readonly filter = signal<'all' | 'expenses' | 'income'>('all');

  protected readonly filteredTransactions = computed(() => {
    const f = this.filter();
    const t = this.transactions();
    if (f === 'expenses') return t.filter((tx) => tx.type === 'debit');
    if (f === 'income') return t.filter((tx) => tx.type === 'credit');
    return t;
  });

  protected readonly totalExpenses = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0),
  );

  protected readonly totalIncome = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0),
  );

  protected setFilter(f: 'all' | 'expenses' | 'income'): void {
    this.filter.set(f);
  }
}
