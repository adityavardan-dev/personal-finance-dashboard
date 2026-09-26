import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, tap } from 'rxjs';
import { BudgetConfig, CurrencyCode, UpsertBudgetPayload } from './budget.models';
import { BudgetService } from './budget.service';

export type BudgetLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class BudgetStore {
  private readonly service = inject(BudgetService);
  private readonly budgetState = signal<BudgetConfig | null>(null);
  private readonly statusState = signal<BudgetLoadStatus>('idle');

  readonly budget = this.budgetState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly hasBudget = computed(() => this.budgetState()?.monthlyLimit !== null && this.budgetState() !== null);
  readonly monthlyLimit = computed(() => this.budgetState()?.monthlyLimit ?? null);
  readonly currency = computed<CurrencyCode>(() => this.budgetState()?.currency ?? 'INR');

  load(): void {
    if (this.statusState() === 'loading' || this.statusState() === 'loaded') return;
    this.statusState.set('loading');
    this.service.getMine().pipe(
      tap((budget) => {
        this.budgetState.set(budget);
        this.statusState.set('loaded');
      }),
      catchError(() => {
        this.statusState.set('error');
        return EMPTY;
      }),
    ).subscribe();
  }

  save(payload: UpsertBudgetPayload) {
    this.statusState.set('loading');
    return this.service.saveMine(payload).pipe(
      tap({
        next: (budget) => {
          this.budgetState.set(budget);
          this.statusState.set('loaded');
        },
        error: () => this.statusState.set('error'),
      }),
    );
  }

  clear(): void {
    this.budgetState.set(null);
    this.statusState.set('idle');
  }
}
