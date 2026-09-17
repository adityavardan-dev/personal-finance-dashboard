import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AppLayout } from '../../../shared/app-layout/app-layout';
import { ExpenseService } from '../expense.service';

interface CategoryOption {
  name: string;
}

@Component({
  selector: 'app-new-expense',
  imports: [AppLayout, FormsModule, RouterLink],
  templateUrl: './new-expense.html',
})
export class NewExpenseComponent {
  private readonly router = inject(Router);
  private readonly expenseService = inject(ExpenseService);

  protected amount = '';
  protected category = 'Food & Dining';
  protected merchant = '';
  protected date = new Date().toISOString().split('T')[0];
  protected note = '';
  protected isSubmitting = false;
  protected errorMessage = '';

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

    this.isSubmitting = true;
    this.errorMessage = '';

    this.expenseService.create({
      amount: Number(this.amount),
      category: this.category,
      merchant: this.merchant.trim(),
      date: this.date,
      note: this.note.trim() || undefined,
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigate(['/history']);
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = "We couldn't save your expense. Please try again.";
      },
    });
  }
}
