import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { BudgetStore } from '../../../core/budget/budget.store';
import { CURRENCY_SYMBOLS } from '../../../core/budget/budget.models';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FinanceMetricsStore } from '../../../core/finance/finance-metrics.store';
import { AppLayout } from '../../../shared/app-layout/app-layout';
import { CategoryIcon } from '../../../shared/category-icon/category-icon';
import { Expense, ExpenseService } from '../../expenses/expense.service';

@Component({
  selector: 'app-transaction-detail',
  imports: [AppLayout, CategoryIcon, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './transaction-detail.html',
})
export class TransactionDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly expenseService = inject(ExpenseService);
  private readonly metricsStore = inject(FinanceMetricsStore);
  protected readonly budgetStore = inject(BudgetStore);
  protected readonly currencySymbol = computed(() => CURRENCY_SYMBOLS[this.budgetStore.currency()]);

  protected readonly transaction = signal<Expense | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal('');

  ngOnInit(): void {
    this.budgetStore.load();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.isLoading.set(false);
      this.notFound.set(true);
      return;
    }

    this.expenseService.getById(id).subscribe({
      next: (transaction) => {
        this.transaction.set(transaction);
        this.isLoading.set(false);
      },
      error: (error: { status?: number }) => {
        this.isLoading.set(false);
        if (error.status === 404) {
          this.notFound.set(true);
        } else {
          this.errorMessage.set("We couldn't load this transaction. Please try again.");
        }
      },
    });
  }

  protected deleteTransaction(): void {
    const item = this.transaction();
    if (!item || !window.confirm('Delete this transaction? This cannot be undone.')) return;

    this.isDeleting.set(true);
    this.deleteError.set('');
    this.expenseService.delete(item.id).subscribe({
      next: () => {
        this.metricsStore.refresh();
        void this.router.navigate(['/history']);
      },
      error: () => {
        this.isDeleting.set(false);
        this.deleteError.set('Unable to delete this transaction. Please try again.');
      },
    });
  }
}
