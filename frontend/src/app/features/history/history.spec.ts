import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { HistoryComponent } from './history';
import { ExpenseService } from '../expenses/expense.service';

const mockExpenses = [
  { id: 'a', userId: 1, amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-16', createdAt: '2026-09-16T10:00:00.000Z' },
  { id: 'b', userId: 1, amount: 1200, category: 'Shopping', merchant: 'Amazon', date: '2026-09-17', createdAt: '2026-09-17T11:00:00.000Z' },
];

describe('HistoryComponent', () => {
  let component: HistoryComponent;
  let fixture: ComponentFixture<HistoryComponent>;
  let mockExpenseService: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockExpenseService = { list: vi.fn().mockReturnValue(of(mockExpenses)), create: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: mockExpenseService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('calls ExpenseService.list() on init', () => {
    expect(mockExpenseService.list).toHaveBeenCalledTimes(1);
  });

  it('populates transactions from API response, newest first', () => {
    expect(component['transactions']).toHaveLength(2);
    expect(component['transactions'][0].merchant).toBe('Amazon');
  });

  it('maps all API expenses to type debit', () => {
    expect(component['transactions'].every((t) => t.type === 'debit')).toBe(true);
  });

  it('sets isLoading to false after successful fetch', () => {
    expect(component['isLoading']).toBe(false);
  });

  describe('filtering', () => {
    it('filter all returns all transactions', () => {
      component['setFilter']('all');
      expect(component.filteredTransactions).toHaveLength(2);
    });

    it('filter expenses returns only debit transactions', () => {
      component['setFilter']('expenses');
      expect(component.filteredTransactions.every((t) => t.type === 'debit')).toBe(true);
      expect(component.filteredTransactions).toHaveLength(2);
    });

    it('filter income returns empty when no credit transactions', () => {
      component['setFilter']('income');
      expect(component.filteredTransactions).toHaveLength(0);
    });
  });

  describe('totals', () => {
    it('totalExpenses sums all debit amounts', () => {
      expect(component.totalExpenses).toBe(1700);
    });

    it('totalIncome is 0 when no credit transactions', () => {
      expect(component.totalIncome).toBe(0);
    });
  });

  describe('API failure', () => {
    it('sets loadError and keeps transactions empty without crashing', () => {
      mockExpenseService.list.mockReturnValue(throwError(() => new Error('Network error')));
      component['isLoading'] = true;
      component['loadError'] = false;
      component['transactions'] = [];

      component.ngOnInit();

      expect(component['loadError']).toBe(true);
      expect(component['isLoading']).toBe(false);
      expect(component['transactions']).toHaveLength(0);
    });
  });
});
