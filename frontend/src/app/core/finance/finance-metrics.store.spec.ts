import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { BudgetStore } from '../budget/budget.store';
import { ExpenseService } from '../../features/expenses/expense.service';
import { FinanceMetricsStore } from './finance-metrics.store';

const budget = signal<any>({ monthlyLimit: 1000, categoryLimits: [], currency: 'INR', createdAt: 'a', updatedAt: 'a' });
const budgetStatus = signal<any>('loaded');
const budgetStore = { budget, status: budgetStatus, load: vi.fn() };
const expense = { id: 'a', userId: 1, type: 'expense' as const, amount: 300, category: 'Food', merchant: 'Cafe', date: '2026-09-10', createdAt: 'a' };

describe('FinanceMetricsStore', () => {
  let list: ReturnType<typeof vi.fn>;
  let store: FinanceMetricsStore;

  beforeEach(() => {
    list = vi.fn().mockReturnValue(of([expense]));
    budgetStore.load.mockClear();
    budgetStatus.set('loaded');
    budget.set({ monthlyLimit: 1000, categoryLimits: [], currency: 'INR', createdAt: 'a', updatedAt: 'a' });
    TestBed.configureTestingModule({ providers: [
      { provide: ExpenseService, useValue: { list } },
      { provide: BudgetStore, useValue: budgetStore },
    ] });
    store = TestBed.inject(FinanceMetricsStore);
  });

  it('loads transactions and shared budget once into deterministic metrics', () => {
    store.load(new Date(2026, 8, 20));
    TestBed.flushEffects();
    expect(list).toHaveBeenCalledTimes(1);
    expect(budgetStore.load).toHaveBeenCalledTimes(1);
    expect(store.metrics()?.currentMonthSpend).toBe(300);
    expect(store.status()).toBe('loaded');
  });

  it('exposes transaction failures and no invented metrics', () => {
    list.mockReturnValue(throwError(() => new Error('offline')));
    store.load(new Date(2026, 8, 20));
    expect(store.status()).toBe('error');
    expect(store.metrics()).toBeNull();
  });

  it('clears user-specific metrics and transactions', () => {
    store.load(new Date(2026, 8, 20));
    TestBed.flushEffects();
    store.clear();
    expect(store.status()).toBe('idle');
    expect(store.metrics()).toBeNull();
    expect(store.transactions()).toBeNull();
  });
});
