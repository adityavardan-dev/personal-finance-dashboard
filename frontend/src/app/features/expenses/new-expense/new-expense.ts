import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppLayout } from '../../../shared/app-layout/app-layout';
import { ExpenseService, TransactionType } from '../expense.service';

interface CategoryOption {
  name: string;
}

@Component({
  selector: 'app-new-expense',
  imports: [AppLayout, FormsModule, RouterLink],
  templateUrl: './new-expense.html',
})
export class NewExpenseComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly expenseService = inject(ExpenseService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected type: TransactionType = 'expense';
  protected amount = '';
  protected category = 'Food & Dining';
  protected merchant = '';
  protected date = new Date().toISOString().split('T')[0];
  protected note = '';
  protected isSubmitting = false;
  protected isLoading = false;
  protected errorMessage = '';
  protected isEditMode = false;
  protected expenseId: string | null = null;

  readonly expenseCategories: CategoryOption[] = [
    { name: 'Food & Dining' },
    { name: 'Shopping' },
    { name: 'Transport' },
    { name: 'Utilities' },
    { name: 'Entertainment' },
    { name: 'Other' },
  ];
  readonly incomeCategories: CategoryOption[] = [
    { name: 'Salary' },
    { name: 'Freelance' },
    { name: 'Refund' },
    { name: 'Other' },
  ];

  protected get categories(): CategoryOption[] {
    return this.type === 'income' ? this.incomeCategories : this.expenseCategories;
  }

  protected onTypeChange(type: TransactionType): void {
    this.type = type;
    if (!this.categories.some((option) => option.name === this.category)) {
      this.category = this.categories[0].name;
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.isEditMode = true;
    this.expenseId = id;
    this.isLoading = true;

    this.expenseService.getById(id).subscribe({
      next: (expense) => {
        this.type = expense.type;
        this.amount = String(expense.amount);
        this.category = expense.category;
        this.merchant = expense.merchant;
        this.date = expense.date;
        this.note = expense.note ?? '';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = "We couldn't load this expense. Please try again.";
        this.cdr.markForCheck();
      },
    });
  }

  protected saveExpense(): void {
    if (!this.amount || Number(this.amount) <= 0 || !this.merchant.trim()) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      type: this.type,
      amount: Number(this.amount),
      category: this.category,
      merchant: this.merchant.trim(),
      date: this.date,
      note: this.note.trim() || undefined,
    };

    const request$ = this.isEditMode && this.expenseId
      ? this.expenseService.update(this.expenseId, payload)
      : this.expenseService.create(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigate(['/history']);
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = this.isEditMode
          ? "We couldn't update your expense. Please try again."
          : "We couldn't save your expense. Please try again.";
      },
    });
  }
}
