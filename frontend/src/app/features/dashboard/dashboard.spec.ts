import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DashboardComponent } from './dashboard';
import { ExpenseService } from '../expenses/expense.service';

const mockExpenses = [
  { id: 'a', userId: 1, amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-16', createdAt: '2026-09-16T10:00:00.000Z' },
  { id: 'b', userId: 1, amount: 1200, category: 'Shopping', merchant: 'Amazon', date: '2026-09-17', createdAt: '2026-09-17T11:00:00.000Z' },
];

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockExpenseService: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockExpenseService = { list: vi.fn().mockReturnValue(of(mockExpenses)), create: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: mockExpenseService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calls ExpenseService.list() on init', () => {
    expect(mockExpenseService.list).toHaveBeenCalledTimes(1);
  });

  it('calculates totalSpent as sum of all expense amounts', () => {
    expect(component['totalSpent']).toBe(1700);
  });

  it('populates recentTransactions newest-first (reversed)', () => {
    expect(component['recentTransactions']).toHaveLength(2);
    expect(component['recentTransactions'][0].merchant).toBe('Amazon');
    expect(component['recentTransactions'][1].merchant).toBe('Swiggy');
  });

  it('all recent transactions have type debit', () => {
    expect(component['recentTransactions'].every((t) => t.type === 'debit')).toBe(true);
  });

  it('limits recentTransactions to 5 even when more expenses exist', () => {
    const manyExpenses = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`, userId: 1, amount: 100, category: 'Other',
      merchant: `Merchant ${i}`, date: '2026-09-17', createdAt: '',
    }));
    mockExpenseService.list.mockReturnValue(of(manyExpenses));
    component.ngOnInit();
    expect(component['recentTransactions']).toHaveLength(5);
  });

  it('handles empty expense list without crashing', () => {
    mockExpenseService.list.mockReturnValue(of([]));
    component.ngOnInit();
    expect(component['totalSpent']).toBe(0);
    expect(component['recentTransactions']).toHaveLength(0);
  });

  it('handles API failure without crashing', () => {
    mockExpenseService.list.mockReturnValue(throwError(() => new Error('Network error')));
    expect(() => component.ngOnInit()).not.toThrow();
  });
});
