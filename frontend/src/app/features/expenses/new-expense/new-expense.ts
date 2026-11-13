import { ChangeDetectorRef, Component, computed, inject, Injector, OnInit } from '@angular/core';
import { BudgetStore } from '../../../core/budget/budget.store';
import { CURRENCY_SYMBOLS } from '../../../core/budget/budget.models';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppLayout } from '../../../shared/app-layout/app-layout';
import { ExpenseService, TransactionType } from '../expense.service';
import { FinanceMetricsStore } from '../../../core/finance/finance-metrics.store';
import { PeerSplitsService, SplitInput } from '../../peer-splits/peer-splits.service';
import { toMinor } from '../../peer-splits/prompt-parser';

interface SplitPersonEntry {
  id: string;
  name: string;
  paid: string;
  fixed: string;
}

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
  private readonly metricsStore = inject(FinanceMetricsStore);
  protected readonly budgetStore = inject(BudgetStore);
  protected readonly currencySymbol = computed(() => CURRENCY_SYMBOLS[this.budgetStore.currency()]);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);

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
  protected isSplitMode = false;
  protected splitPeople: SplitPersonEntry[] = [
    { id: 'self', name: 'You', paid: '', fixed: '' },
    { id: crypto.randomUUID(), name: '', paid: '0', fixed: '0' },
  ];

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
    this.budgetStore.load();
    this.isSplitMode = this.route.snapshot.queryParamMap?.get('mode') === 'split';
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
    if (this.isSplitMode) {
      this.previewSplit();
      return;
    }
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

    const request$ =
      this.isEditMode && this.expenseId
        ? this.expenseService.update(this.expenseId, payload)
        : this.expenseService.create(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.metricsStore.refresh();
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

  protected addSplitPerson(): void {
    this.splitPeople = [
      ...this.splitPeople,
      { id: crypto.randomUUID(), name: '', paid: '0', fixed: '0' },
    ];
  }

  protected removeSplitPerson(id: string): void {
    if (id !== 'self' && this.splitPeople.length > 2)
      this.splitPeople = this.splitPeople.filter((person) => person.id !== id);
  }

  private previewSplit(): void {
    const totalAmountMinor = toMinor(this.amount);
    if (
      !totalAmountMinor ||
      !this.date ||
      !this.category ||
      !this.merchant.trim() ||
      this.splitPeople.some((person) => !person.name.trim())
    ) {
      this.errorMessage = 'Enter the total, merchant, date, category, and each person’s name.';
      return;
    }
    const people = this.splitPeople.map((person) => ({
      person,
      paid: toMinor(person.paid || '0'),
      fixed: toMinor(person.fixed || '0'),
    }));
    if (people.some((entry) => entry.paid === null || entry.fixed === null)) {
      this.errorMessage = 'Paid and fixed share amounts must have at most two decimal places.';
      return;
    }
    const named = this.splitPeople.map((person) => person.name.trim().toLowerCase());
    if (new Set(named).size !== named.length) {
      this.errorMessage = 'Each person needs a distinct name.';
      return;
    }
    const hasOtherPayer = people.some((entry) => entry.person.id !== 'self' && entry.paid! > 0);
    const input: SplitInput = {
      totalAmountMinor,
      currency: this.budgetStore.currency(),
      participants: this.splitPeople.map((person) => ({
        id: person.id,
        displayName: person.name.trim(),
      })),
      contributions: people
        .map((entry) => ({
          participantId: entry.person.id,
          amountMinor:
            entry.person.id === 'self' && !entry.person.paid && !hasOtherPayer
              ? totalAmountMinor
              : entry.paid!,
        }))
        .filter((entry) => entry.amountMinor > 0),
      allocationRules: [
        ...people
          .filter((entry) => entry.fixed! > 0)
          .map((entry) => ({
            kind: 'FIXED_AMOUNT' as const,
            participantId: entry.person.id,
            amountMinor: entry.fixed!,
          })),
        {
          kind: 'EQUAL_REMAINDER' as const,
          participantIds: people
            .filter((entry) => entry.fixed === 0)
            .map((entry) => entry.person.id),
        },
      ],
    };
    this.errorMessage = '';
    this.isSubmitting = true;
    const service = this.injector.get(PeerSplitsService);
    service.preview(input).subscribe({
      next: (result) => {
        const id = service.addPreview(this.merchant.trim(), input.participants, result, {
          date: this.date,
          category: this.category,
          merchant: this.merchant.trim(),
        });
        this.isSubmitting = false;
        void this.router.navigate(['/peer-splits', id]);
      },
      error: (response: { error?: { issues?: { message: string }[] } }) => {
        this.isSubmitting = false;
        this.errorMessage =
          response.error?.issues?.map((issue) => issue.message).join(' ') ||
          'Could not calculate this split. Review the amounts and try again.';
        this.cdr.markForCheck();
      },
    });
  }
}
