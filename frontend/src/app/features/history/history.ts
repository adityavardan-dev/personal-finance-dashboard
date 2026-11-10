import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { BudgetStore } from '../../core/budget/budget.store';
import { CURRENCY_SYMBOLS } from '../../core/budget/budget.models';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { CategoryIcon } from '../../shared/category-icon/category-icon';
import { ExpenseService, TransactionType } from '../expenses/expense.service';

interface Transaction {
  id: string;
  merchant: string;
  category: string;
  date: string;
  displayDate: string;
  amount: number;
  type: TransactionType;
}

@Component({
  selector: 'app-history',
  imports: [AppLayout, DecimalPipe, FormsModule, RouterLink, CategoryIcon],
  templateUrl: './history.html',
})
export class HistoryComponent {
  protected readonly pageSize = 10;
  private readonly expenseService = inject(ExpenseService);
  protected readonly budgetStore = inject(BudgetStore);
  protected readonly currencySymbol = computed(() => CURRENCY_SYMBOLS[this.budgetStore.currency()]);

  constructor() {
    this.budgetStore.load();
  }
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

  protected readonly transactions = computed<Transaction[]>(() => {
    return [...(this.expenses() ?? [])].reverse().map((e) => ({
      id: e.id,
      merchant: e.merchant,
      category: e.category,
      date: e.date,
      displayDate: this.formatDisplayDate(e.date),
      amount: e.amount,
      type: e.type,
    }));
  });

  protected readonly filter = signal<'all' | TransactionType>('all');
  protected readonly categoryFilter = signal('');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly categoryOptions = computed(() =>
    [...new Set(this.transactions().map((transaction) => transaction.category))].sort(),
  );
  protected readonly filterError = computed(() =>
    this.fromDate() && this.toDate() && this.fromDate() > this.toDate()
      ? 'The start date must be on or before the end date.'
      : '',
  );
  protected readonly hasActiveFilters = computed(
    () =>
      this.filter() !== 'all' || Boolean(this.categoryFilter() || this.fromDate() || this.toDate()),
  );

  protected readonly filteredTransactions = computed(() => {
    if (this.filterError()) return [];

    const type = this.filter();
    const category = this.categoryFilter();
    const from = this.fromDate();
    const to = this.toDate();

    return this.transactions().filter(
      (transaction) =>
        (type === 'all' || transaction.type === type) &&
        (!category || transaction.category === category) &&
        (!from || transaction.date >= from) &&
        (!to || transaction.date <= to),
    );
  });
  protected readonly currentPage = signal(1);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredTransactions().length / this.pageSize)),
  );
  protected readonly paginatedTransactions = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredTransactions().slice(start, start + this.pageSize);
  });
  protected readonly pageStart = computed(() =>
    this.filteredTransactions().length ? (this.currentPage() - 1) * this.pageSize + 1 : 0,
  );
  protected readonly pageEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredTransactions().length),
  );

  protected readonly totalExpenses = computed(() =>
    this.transactions()
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0),
  );

  protected readonly totalIncome = computed(() =>
    this.transactions()
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0),
  );

  protected readonly netActivity = computed(() => this.totalIncome() - this.totalExpenses());

  protected setFilter(filter: 'all' | TransactionType): void {
    this.filter.set(filter);
    this.currentPage.set(1);
  }

  protected setCategoryFilter(category: string): void {
    this.categoryFilter.set(category);
    this.currentPage.set(1);
  }

  protected setFromDate(date: string): void {
    this.fromDate.set(date);
    this.currentPage.set(1);
  }

  protected setToDate(date: string): void {
    this.toDate.set(date);
    this.currentPage.set(1);
  }

  protected clearFilters(): void {
    this.filter.set('all');
    this.categoryFilter.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.currentPage.set(1);
  }

  protected previousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  protected nextPage(): void {
    this.currentPage.update((page) => Math.min(this.pageCount(), page + 1));
  }

  private formatDisplayDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const today = new Date();
    const dayDifference = Math.round(
      (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
        Date.UTC(year, month - 1, day)) /
        (24 * 60 * 60 * 1000),
    );
    if (dayDifference === 0) return 'Today';
    if (dayDifference === 1) return 'Yesterday';
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }
}
