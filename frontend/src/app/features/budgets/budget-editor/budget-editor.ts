import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BudgetStore } from '../../../core/budget/budget.store';
import { CurrencyCode } from '../../../core/budget/budget.models';

interface CategoryLimitForm {
  category: string;
  limit: string;
}

@Component({
  selector: 'app-budget-editor',
  imports: [FormsModule],
  templateUrl: './budget-editor.html',
})
export class BudgetEditorComponent {
  protected readonly store = inject(BudgetStore);
  protected monthlyLimit = '';
  protected currency: CurrencyCode = 'INR';
  protected categoryLimits: CategoryLimitForm[] = [];
  protected isEditing = false;
  protected isSaving = false;
  protected errorMessage = '';
  protected successMessage = '';
  private hydrated = false;

  readonly categories = ['Food & Dining', 'Shopping', 'Transport', 'Utilities', 'Entertainment', 'Other'];

  constructor() {
    effect(() => {
      const budget = this.store.budget();
      if (this.store.status() !== 'loaded' || this.hydrated || !budget) return;
      this.monthlyLimit = budget.monthlyLimit === null ? '' : String(budget.monthlyLimit);
      this.currency = budget.currency;
      this.categoryLimits = budget.categoryLimits.map((entry) => ({ category: entry.category, limit: String(entry.limit) }));
      this.isEditing = budget.monthlyLimit === null;
      this.hydrated = true;
    });
  }

  protected startEditing(): void {
    this.isEditing = true;
    this.successMessage = '';
  }

  protected addCategoryLimit(): void {
    const category = this.categories.find((option) => !this.categoryLimits.some((entry) => entry.category === option));
    if (category) this.categoryLimits.push({ category, limit: '' });
  }

  protected removeCategoryLimit(index: number): void {
    this.categoryLimits.splice(index, 1);
  }

  protected save(): void {
    this.errorMessage = '';
    this.successMessage = '';
    const monthlyLimit = this.monthlyLimit === '' ? null : Number(this.monthlyLimit);
    const limits = this.categoryLimits.map((entry) => ({ category: entry.category, limit: Number(entry.limit) }));
    if (monthlyLimit !== null && monthlyLimit <= 0) {
      this.errorMessage = 'Enter a monthly budget greater than zero.';
      return;
    }
    if (monthlyLimit === null && limits.length > 0) {
      this.errorMessage = 'Set a monthly budget before adding category limits.';
      return;
    }
    if (limits.some((entry) => !entry.category || entry.limit <= 0)) {
      this.errorMessage = 'Every category limit must be greater than zero.';
      return;
    }
    if (new Set(limits.map((entry) => entry.category)).size !== limits.length) {
      this.errorMessage = 'Choose each category only once.';
      return;
    }

    this.isSaving = true;
    this.store.save({ monthlyLimit, categoryLimits: limits, currency: this.currency }).subscribe({
      next: () => {
        this.isSaving = false;
        this.isEditing = false;
        this.successMessage = 'Budget saved.';
      },
      error: () => {
        this.isSaving = false;
        this.errorMessage = "We couldn't save your budget. Please try again.";
      },
    });
  }
}
