import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ExpenseService } from '../expense.service';
import { NewExpenseComponent } from './new-expense';

describe('NewExpenseComponent', () => {
  let component: NewExpenseComponent;
  let mockExpenseService: { create: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let router: Router;

  const validExpenseResponse = {
    id: 'uuid-1',
    userId: 1,
    amount: 500,
    category: 'Food & Dining',
    merchant: 'Swiggy',
    date: '2026-09-17',
    createdAt: '2026-09-17T10:00:00.000Z',
  };

  beforeEach(async () => {
    mockExpenseService = { create: vi.fn(), list: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewExpenseComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: mockExpenseService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewExpenseComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  describe('invalid form — no API call', () => {
    it('does not call API when amount is empty', () => {
      component['amount'] = '';
      component['merchant'] = 'Swiggy';
      component['saveExpense']();
      expect(mockExpenseService.create).not.toHaveBeenCalled();
    });

    it('does not call API when amount is zero', () => {
      component['amount'] = '0';
      component['merchant'] = 'Swiggy';
      component['saveExpense']();
      expect(mockExpenseService.create).not.toHaveBeenCalled();
    });

    it('does not call API when merchant is blank', () => {
      component['amount'] = '500';
      component['merchant'] = '   ';
      component['saveExpense']();
      expect(mockExpenseService.create).not.toHaveBeenCalled();
    });
  });

  describe('valid form — POST request', () => {
    it('calls ExpenseService.create with correct payload', () => {
      mockExpenseService.create.mockReturnValue(of(validExpenseResponse));
      component['amount'] = '750';
      component['category'] = 'Transport';
      component['merchant'] = 'Ola';
      component['date'] = '2026-09-17';
      component['note'] = '';

      component['saveExpense']();

      expect(mockExpenseService.create).toHaveBeenCalledWith({
        amount: 750,
        category: 'Transport',
        merchant: 'Ola',
        date: '2026-09-17',
        note: undefined,
      });
    });

    it('sends note when provided', () => {
      mockExpenseService.create.mockReturnValue(of(validExpenseResponse));
      component['amount'] = '300';
      component['merchant'] = 'DMart';
      component['note'] = 'Weekly groceries';

      component['saveExpense']();

      expect(mockExpenseService.create).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'Weekly groceries' }),
      );
    });

    it('trims merchant whitespace before sending', () => {
      mockExpenseService.create.mockReturnValue(of(validExpenseResponse));
      component['amount'] = '200';
      component['merchant'] = '  Zomato  ';

      component['saveExpense']();

      expect(mockExpenseService.create).toHaveBeenCalledWith(
        expect.objectContaining({ merchant: 'Zomato' }),
      );
    });
  });

  describe('successful save', () => {
    it('navigates to /history after successful API response', () => {
      mockExpenseService.create.mockReturnValue(of(validExpenseResponse));
      component['amount'] = '500';
      component['merchant'] = 'Swiggy';

      component['saveExpense']();

      expect(router.navigate).toHaveBeenCalledWith(['/history']);
    });

    it('does not set errorMessage on success', () => {
      mockExpenseService.create.mockReturnValue(of(validExpenseResponse));
      component['amount'] = '500';
      component['merchant'] = 'Swiggy';

      component['saveExpense']();

      expect(component['errorMessage']).toBe('');
    });

    it('resets isSubmitting to false after success', () => {
      mockExpenseService.create.mockReturnValue(of(validExpenseResponse));
      component['amount'] = '500';
      component['merchant'] = 'Swiggy';

      component['saveExpense']();

      expect(component['isSubmitting']).toBe(false);
    });
  });

  describe('API failure', () => {
    it('sets errorMessage when API call fails', () => {
      mockExpenseService.create.mockReturnValue(throwError(() => new Error('Network error')));
      component['amount'] = '500';
      component['merchant'] = 'Swiggy';

      component['saveExpense']();

      expect(component['errorMessage']).toBeTruthy();
    });

    it('does not navigate on API failure', () => {
      mockExpenseService.create.mockReturnValue(throwError(() => new Error('Network error')));
      component['amount'] = '500';
      component['merchant'] = 'Swiggy';

      component['saveExpense']();

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('resets isSubmitting to false after failure', () => {
      mockExpenseService.create.mockReturnValue(throwError(() => new Error('Network error')));
      component['amount'] = '500';
      component['merchant'] = 'Swiggy';

      component['saveExpense']();

      expect(component['isSubmitting']).toBe(false);
    });
  });
});
