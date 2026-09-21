import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { HistoryComponent } from './history';
import { ExpenseService } from '../expenses/expense.service';



const mockExpenses = [
  { id: 'a', userId: 1, amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-16', createdAt: '2026-09-16T10:00:00.000Z' },
  { id: 'b', userId: 1, amount: 1200, category: 'Shopping', merchant: 'Amazon', date: '2026-09-17', createdAt: '2026-09-17T11:00:00.000Z' },
];

describe('HistoryComponent', () => {
  let fixture: ComponentFixture<HistoryComponent>;
  let c: any;
  let mockList: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockList = vi.fn().mockReturnValue(of(mockExpenses));
    mockDelete = vi.fn();

    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: { list: mockList, create: vi.fn(), delete: mockDelete } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryComponent);
    c = fixture.componentInstance as any;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  // --- Signal state ---

  it('populates transactions from ExpenseService.list(), newest first', () => {
    expect(c.transactions()).toHaveLength(2);
    expect(c.transactions()[0].merchant).toBe('Amazon');
    expect(c.transactions()[1].merchant).toBe('Swiggy');
  });

  it('maps all API expenses to type debit', () => {
    expect(c.transactions().every((t: any) => t.type === 'debit')).toBe(true);
  });

  it('isLoading is false after Observable emits', () => {
    expect(c.isLoading()).toBe(false);
  });

  // --- DOM rendering ---

  it('renders returned expense merchants in the DOM', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Amazon');
    expect(text).toContain('Swiggy');
  });

  it('transaction count updates from 0 to the returned count', async () => {
    const subject = new Subject<typeof mockExpenses>();
    mockList.mockReturnValue(subject.asObservable());

    const f2 = TestBed.createComponent(HistoryComponent);
    f2.detectChanges();
    await f2.whenStable();
    f2.detectChanges();

    // Before data arrives, initial value is null → transactions is [] → count is 0
    expect(f2.nativeElement.textContent).toContain('0');

    subject.next(mockExpenses);
    subject.complete();
    f2.detectChanges();
    await f2.whenStable();
    f2.detectChanges();

    expect(f2.nativeElement.textContent).toContain('2');
  });

  // --- Filtering ---

  describe('filtering', () => {
    it('filter all returns all transactions', () => {
      c.setFilter('all');
      expect(c.filteredTransactions()).toHaveLength(2);
    });

    it('filter expenses returns only debit transactions', () => {
      c.setFilter('expenses');
      expect(c.filteredTransactions().every((t: any) => t.type === 'debit')).toBe(true);
      expect(c.filteredTransactions()).toHaveLength(2);
    });

    it('filter income returns empty when no credit transactions', () => {
      c.setFilter('income');
      expect(c.filteredTransactions()).toHaveLength(0);
    });
  });

  // --- Totals ---

  describe('totals', () => {
    it('totalExpenses sums all debit amounts', () => {
      expect(c.totalExpenses()).toBe(1700);
    });

    it('totalIncome is 0 when no credit transactions', () => {
      expect(c.totalIncome()).toBe(0);
    });
  });

  // --- API failure ---

  describe('API failure', () => {
    it('sets loadError and keeps transactions empty without crashing', async () => {
      mockList.mockReturnValue(throwError(() => new Error('Network error')));
      const f2 = TestBed.createComponent(HistoryComponent);
      const c2 = f2.componentInstance as any;
      f2.detectChanges();
      await f2.whenStable();
      f2.detectChanges();

      expect(c2.loadError()).toBe(true);
      expect(c2.isLoading()).toBe(false);
      expect(c2.transactions()).toHaveLength(0);
    });
  });

  // --- Edit action ---

  describe('edit action', () => {
    it('transactions carry the expense id from the API response', () => {
      expect(c.transactions()[0].id).toBe('b');
      expect(c.transactions()[1].id).toBe('a');
    });
  });

  // --- Delete action ---

  describe('delete action', () => {
    it('does not call the API when the user cancels confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      mockDelete.mockReturnValue(of(mockExpenses[0]));

      c.deleteExpense('a');

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('removes the transaction from the list after successful delete', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockDelete.mockReturnValue(of(mockExpenses[0]));

      expect(c.transactions()).toHaveLength(2);
      c.deleteExpense('a');
      expect(c.transactions()).toHaveLength(1);
      expect(c.transactions()[0].id).toBe('b');
    });

    it('calls DELETE API with the correct expense id', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockDelete.mockReturnValue(of(mockExpenses[1]));

      c.deleteExpense('b');

      expect(mockDelete).toHaveBeenCalledWith('b');
    });

    it('sets deleteError and keeps the transaction when delete fails', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockDelete.mockReturnValue(throwError(() => new Error('Network error')));

      c.deleteExpense('a');

      expect(c.deleteError()).toBe(true);
      expect(c.transactions()).toHaveLength(2);
    });
  });
});
