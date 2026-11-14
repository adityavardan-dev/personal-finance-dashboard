import { ChangeDetectorRef, Component, computed, HostListener, inject, Injector, OnInit } from '@angular/core';
import { BudgetStore } from '../../../core/budget/budget.store';
import { CURRENCY_SYMBOLS } from '../../../core/budget/budget.models';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppLayout } from '../../../shared/app-layout/app-layout';
import { ExpenseService, TransactionType } from '../expense.service';
import { FinanceMetricsStore } from '../../../core/finance/finance-metrics.store';
import { PeerSplitsService, SplitGroup, SplitInput } from '../../peer-splits/peer-splits.service';
import { toMinor } from '../../peer-splits/prompt-parser';
import { localDate } from '../../peer-splits/split-date';

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
  styleUrl: './new-expense.css',
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
  protected groupName = '';
  protected date = localDate();
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
  protected peoplePickerOpen = false;
  protected peopleSearch = '';
  protected pickedPeople = new Set<string>();
  protected splitView: 'equal' | 'amounts' | 'paid' = 'amounts';
  protected peoplePage = 1;
  protected readonly peoplePerPage = 7;

  protected get peoplePageCount(): number {
    return Math.max(1, Math.ceil(this.splitPeople.length / this.peoplePerPage));
  }

  protected get visibleSplitPeople(): SplitPersonEntry[] {
    const start = (this.peoplePage - 1) * this.peoplePerPage;
    return this.splitPeople.slice(start, start + this.peoplePerPage);
  }

  protected get peoplePageEnd(): number {
    return Math.min(this.peoplePage * this.peoplePerPage, this.splitPeople.length);
  }

  protected changePeoplePage(page: number): void {
    if (page >= 1 && page <= this.peoplePageCount) {
      this.peoplePage = page;
      this.cdr.markForCheck();
    }
  }

  protected estimatedShare(person: SplitPersonEntry): string {
    const total = toMinor(String(this.amount ?? ''));
    if (total === null || total <= 0) return '—';
    const fixed = this.splitPeople.map((entry) => toMinor(String(entry.fixed || '0')));
    if (fixed.some((value) => value === null)) return '—';
    const ownFixed = toMinor(String(person.fixed || '0')) ?? 0;
    if (ownFixed > 0) return this.formatShare(ownFixed);
    const remaining = total - fixed.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const equalCount = fixed.filter((value) => value === 0).length;
    if (remaining < 0 || equalCount === 0) return '—';
    return `${remaining % equalCount ? '≈ ' : ''}${this.formatShare(Math.round(remaining / equalCount))}`;
  }

  private formatShare(amountMinor: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: this.budgetStore.currency(),
    }).format(amountMinor / 100);
  }

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
    if (!this.amount || Number(this.amount) <= 0 || !this.category || !this.date) return;

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

  protected openPeoplePicker(): void {
    this.peopleSearch = '';
    this.pickedPeople = new Set<string>();
    this.peoplePickerOpen = true;
    setTimeout(() => document.getElementById('people-search')?.focus());
  }

  protected closePeoplePicker(): void {
    this.peoplePickerOpen = false;
    this.peopleSearch = '';
    this.pickedPeople = new Set<string>();
    setTimeout(() => document.getElementById('add-people-trigger')?.focus());
  }

  protected updatePeopleSearch(event: Event): void {
    this.peopleSearch = (event.target as HTMLInputElement).value;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.peoplePickerOpen) this.closePeoplePicker();
  }

  @HostListener('document:keydown.tab', ['$event'])
  protected keepPickerFocus(event: Event): void {
    if (!this.peoplePickerOpen) return;
    const keyboardEvent = event as KeyboardEvent;
    const controls = [...document.querySelectorAll<HTMLElement>(
      '.people-picker button:not(:disabled), .people-picker input',
    )];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (keyboardEvent.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected recentGroups(): SplitGroup[] {
    return (this.injector.get(PeerSplitsService).groups?.() ?? []).filter((group) => !group.example);
  }

  protected availablePeople(): string[] {
    const seen = new Set<string>();
    return this.recentGroups()
      .flatMap((group) => group.participants.map((person) => person.displayName.trim()))
      .filter((name) => {
        const key = name.toLocaleLowerCase();
        if (!name || key === 'you' || key === 'self' || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  protected filteredPeople(): string[] {
    const query = this.peopleSearch.trim().toLocaleLowerCase();
    return this.availablePeople().filter((name) => name.toLocaleLowerCase().includes(query));
  }

  protected canAddTypedPerson(): boolean {
    const name = this.peopleSearch.trim();
    return !!name && name.toLocaleLowerCase() !== 'you' && name.toLocaleLowerCase() !== 'self' &&
      !this.availablePeople().some((person) => this.sameName(person, name)) &&
      !this.splitPeople.some((person) => this.sameName(person.name, name)) &&
      ![...this.pickedPeople].some((person) => this.sameName(person, name));
  }

  protected isInSplit(name: string): boolean {
    return this.splitPeople.some((person) => this.sameName(person.name, name));
  }

  protected isPicked(name: string): boolean {
    return [...this.pickedPeople].some((person) => this.sameName(person, name));
  }

  protected pickPerson(name: string): void {
    const next = new Set(this.pickedPeople);
    const current = [...next].find((person) => this.sameName(person, name));
    if (current) next.delete(current);
    else if (!this.isInSplit(name)) next.add(name.trim());
    this.pickedPeople = next;
    this.peopleSearch = '';
    this.cdr.markForCheck();
    document.getElementById('people-search')?.focus();
  }

  protected pickTypedPerson(): void {
    if (this.canAddTypedPerson()) this.pickPerson(this.peopleSearch);
  }

  protected pickGroup(group: SplitGroup): void {
    const names = group.participants.map((person) => person.displayName.trim())
      .filter((name) => name && !this.sameName(name, 'You') && !this.isInSplit(name));
    const next = new Set(this.pickedPeople);
    for (const name of names) {
      if (![...next].some((person) => this.sameName(person, name))) next.add(name);
    }
    this.pickedPeople = next;
    this.cdr.markForCheck();
  }

  protected isGroupPicked(group: SplitGroup): boolean {
    const names = group.participants.map((person) => person.displayName.trim())
      .filter((name) => name && !this.sameName(name, 'You') && !this.isInSplit(name));
    return names.length > 0 && names.every((name) => this.isPicked(name));
  }

  protected addPickedPeople(): void {
    if (this.pickedPeople.size === 0) return;
    const people = [...this.splitPeople];
    for (const name of this.pickedPeople) {
      if (people.some((person) => this.sameName(person.name, name))) continue;
      const blank = people.find((person) => person.id !== 'self' && !person.name.trim());
      if (blank) blank.name = name;
      else people.push({ id: crypto.randomUUID(), name, paid: '0', fixed: '0' });
    }
    this.splitPeople = people;
    this.peoplePage = this.peoplePageCount;
    this.cdr.markForCheck();
    this.closePeoplePicker();
  }

  private sameName(first: string, second: string): boolean {
    return first.trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase();
  }

  protected removeSplitPerson(id: string): void {
    if (id !== 'self' && this.splitPeople.length > 2) {
      this.splitPeople = this.splitPeople.filter((person) => person.id !== id);
      this.peoplePage = Math.min(this.peoplePage, this.peoplePageCount);
      this.cdr.markForCheck();
    }
  }

  private previewSplit(): void {
    const totalAmountMinor = toMinor(String(this.amount ?? ''));
    if (
      !totalAmountMinor ||
      !this.date ||
      !this.groupName.trim() ||
      this.splitPeople.some((person) => !person.name.trim())
    ) {
      this.errorMessage = 'Enter the total, group name, and each person’s name.';
      return;
    }
    const people = this.splitPeople.map((person) => ({
      person,
      paid: toMinor(String(person.paid || '0')),
      fixed: toMinor(String(person.fixed || '0')),
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
        const id = service.addPreview(this.groupName.trim(), input.participants, result, {
          date: this.date,
          category: this.groupName.trim(),
          merchant: this.merchant.trim() || null,
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
