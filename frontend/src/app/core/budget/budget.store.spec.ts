import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { BudgetService } from './budget.service';
import { BudgetStore } from './budget.store';

const empty = { monthlyLimit: null, categoryLimits: [], currency: 'INR' as const, createdAt: null, updatedAt: null };

describe('BudgetStore', () => {
  let store: BudgetStore;
  let service: { getMine: ReturnType<typeof vi.fn>; saveMine: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = { getMine: vi.fn().mockReturnValue(of(empty)), saveMine: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: BudgetService, useValue: service }] });
    store = TestBed.inject(BudgetStore);
  });

  it('loads once and exposes the canonical empty budget', () => {
    store.load();
    store.load();
    expect(service.getMine).toHaveBeenCalledTimes(1);
    expect(store.status()).toBe('loaded');
    expect(store.hasBudget()).toBe(false);
  });

  it('saves and exposes a configured budget', () => {
    const configured = { ...empty, monthlyLimit: 30000, createdAt: 'a', updatedAt: 'a' };
    service.saveMine.mockReturnValue(of(configured));
    store.save({ monthlyLimit: 30000, categoryLimits: [], currency: 'INR' }).subscribe();
    expect(store.monthlyLimit()).toBe(30000);
    expect(store.hasBudget()).toBe(true);
  });

  it('exposes load errors without inventing a fallback budget', () => {
    service.getMine.mockReturnValue(throwError(() => new Error('offline')));
    store.load();
    expect(store.status()).toBe('error');
    expect(store.monthlyLimit()).toBeNull();
  });

  it('clears user-specific state', () => {
    store.load();
    store.clear();
    expect(store.status()).toBe('idle');
    expect(store.budget()).toBeNull();
  });
});
