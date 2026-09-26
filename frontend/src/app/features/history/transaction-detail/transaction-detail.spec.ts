import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetStore } from '../../../core/budget/budget.store';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ExpenseService } from '../../expenses/expense.service';
import { TransactionDetailComponent } from './transaction-detail';

describe('TransactionDetailComponent', () => {
  let fixture: ComponentFixture<TransactionDetailComponent>;
  let getById: ReturnType<typeof vi.fn>;

  const income = {
    id: 'income-1',
    userId: 1,
    type: 'income' as const,
    amount: 50000,
    category: 'Salary',
    merchant: 'Employer',
    date: '2026-09-01',
    note: 'September salary',
    createdAt: '2026-09-01T09:00:00.000Z',
  };

  async function setup(response = of(income)) {
    getById = vi.fn().mockReturnValue(response);
    await TestBed.configureTestingModule({
      imports: [TransactionDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: { getById } },
        { provide: BudgetStore, useValue: { currency: signal('INR'), load: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'income-1' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('loads the owned transaction and renders its details read-only', async () => {
    await setup();

    expect(getById).toHaveBeenCalledWith('income-1');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Income');
    expect(text).toContain('Employer');
    expect(text).toContain('Salary');
    expect(text).toContain('September salary');
    expect(text).toContain('50,000');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('renders a safe not-found state for an unavailable transaction', async () => {
    await setup(throwError(() => ({ status: 404 })));

    expect(fixture.nativeElement.textContent).toContain('Transaction not found');
    expect(fixture.nativeElement.textContent).not.toContain('income-1');
  });

  it('renders a retryable generic error for non-404 failures', async () => {
    await setup(throwError(() => ({ status: 500 })));

    expect(fixture.nativeElement.textContent).toContain("couldn't load this transaction");
  });
});
