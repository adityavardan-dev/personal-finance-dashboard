import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { BudgetStore } from '../../../core/budget/budget.store';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ExpenseService } from '../expense.service';
import { FinanceMetricsStore } from '../../../core/finance/finance-metrics.store';
import { NewExpenseComponent } from './new-expense';
import { PeerSplitsService, SplitGroup } from '../../peer-splits/peer-splits.service';

describe('NewExpenseComponent', () => {
  let component: NewExpenseComponent;
  let fixture: ComponentFixture<NewExpenseComponent>;
  let mockExpenseService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let router: Router;
  let splitService: { preview: ReturnType<typeof vi.fn>; addPreview: ReturnType<typeof vi.fn>; groups: ReturnType<typeof signal<SplitGroup[]>> };

  const validExpenseResponse = {
    id: 'uuid-1',
    userId: 1,
    type: 'expense' as const,
    amount: 500,
    category: 'Food & Dining',
    merchant: 'Swiggy',
    date: '2026-09-17',
    createdAt: '2026-09-17T10:00:00.000Z',
  };

  beforeEach(async () => {
    mockExpenseService = { create: vi.fn(), list: vi.fn(), getById: vi.fn(), update: vi.fn() };
    splitService = { preview: vi.fn(), addPreview: vi.fn().mockReturnValue('split-1'), groups: signal<SplitGroup[]>([]) };

    await TestBed.configureTestingModule({
      imports: [NewExpenseComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: PeerSplitsService, useValue: splitService },
        { provide: FinanceMetricsStore, useValue: { refresh: vi.fn() } },
        { provide: BudgetStore, useValue: { currency: signal('INR'), load: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue(null) } } },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NewExpenseComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('previews a split from the existing form without saving a personal expense', () => {
    component['isSplitMode'] = true;
    component['amount'] = 1800 as unknown as string;
    component['groupName'] = 'Bowling';
    component['splitPeople'][1].name = 'Harsha';
    splitService.preview.mockReturnValue(
      of({
        totalAmountMinor: 180000,
        currency: 'INR',
        allocations: [],
        balances: [],
        obligations: [],
      }),
    );

    component['saveExpense']();

    expect(splitService.preview).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmountMinor: 180000,
        participants: [
          { id: 'self', displayName: 'You' },
          { id: component['splitPeople'][1].id, displayName: 'Harsha' },
        ],
        contributions: [{ participantId: 'self', amountMinor: 180000 }],
      }),
    );
    expect(mockExpenseService.create).not.toHaveBeenCalled();
    expect(splitService.addPreview).toHaveBeenCalledWith(
      'Bowling',
      expect.any(Array),
      expect.any(Object),
      expect.objectContaining({ category: 'Bowling', merchant: null }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/peer-splits', 'split-1']);
  });

  it('adds multiple people from a recent group in one confirmation', () => {
    component['isSplitMode'] = true;
    splitService.groups.set([{
      id: 'recent-1', title: 'Weekend trip', example: false,
      participants: [
        { id: 'self', displayName: 'You' },
        { id: 'friend-1', displayName: 'Harsha' },
        { id: 'friend-2', displayName: 'Khyathi' },
      ],
      result: { totalAmountMinor: 300000, currency: 'INR', allocations: [], balances: [], obligations: [] },
    }]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#add-people-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    const group = [...fixture.nativeElement.querySelectorAll('.people-picker-row')]
      .find((row: Element) => row.textContent?.includes('Weekend trip')) as HTMLButtonElement;
    group.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.people-picker-footer button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component['splitPeople'].map((person) => person.name)).toEqual(['You', 'Harsha', 'Khyathi']);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('adds a typed name without a saved contact', async () => {
    component['isSplitMode'] = true;
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#add-people-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector('#people-search') as HTMLInputElement;
    search.value = 'Jaswanth';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.people-picker-create') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.people-picker-footer button') as HTMLButtonElement).click();

    expect(component['splitPeople'][1].name).toBe('Jaswanth');
  });

  it('shows ten people in seven-person pages and calculates shares across pages', () => {
    component['isSplitMode'] = true;
    component['amount'] = 5000 as unknown as string;
    component['splitPeople'] = [
      { id: 'self', name: 'You', paid: '', fixed: '' },
      ...Array.from({ length: 9 }, (_, index) => ({ id: `person-${index + 1}`, name: `Person ${index + 1}`, paid: '0', fixed: '0' })),
    ];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.split-person-row')).toHaveLength(7);
    expect(fixture.nativeElement.querySelector('.split-people-pagination').textContent).toContain('1–7 of 10');
    (fixture.nativeElement.querySelector('button[aria-label="Next participants"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.split-person-row')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.split-people-pagination').textContent).toContain('8–10 of 10');
    expect(component['estimatedShare'](component['splitPeople'][9])).toContain('500.00');

    const amountTab = [...fixture.nativeElement.querySelectorAll('[role="tab"]')]
      .find((tab: Element) => tab.textContent?.includes('By amount')) as HTMLButtonElement;
    amountTab.click();
    fixture.detectChanges();
    component['splitPeople'][9].fixed = '1000';
    expect(component['estimatedShare'](component['splitPeople'][9])).toContain('1,000.00');
    expect(component['estimatedShare'](component['splitPeople'][0])).toContain('444.44');
  });

  it('lets the user select income and resets to an income category', () => {
    const typeSelect = fixture.nativeElement.querySelector(
      '#transaction-type',
    ) as HTMLSelectElement;

    expect(typeSelect.value).toBe('expense');
    typeSelect.value = 'income';
    typeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component['type']).toBe('income');
    expect(component['category']).toBe('Salary');
    const categorySelect = fixture.nativeElement.querySelector('#category') as HTMLSelectElement;
    expect([...categorySelect.options].map((option) => option.value)).toContain('Salary');
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

    it('allows an expense without a merchant', () => {
      mockExpenseService.create.mockReturnValue(of(validExpenseResponse));
      component['amount'] = '500';
      component['merchant'] = '   ';
      component['saveExpense']();
      expect(mockExpenseService.create).toHaveBeenCalledWith(
        expect.objectContaining({ merchant: '' }),
      );
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
        type: 'expense',
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

    it('sends an explicit income type and category', () => {
      mockExpenseService.create.mockReturnValue(
        of({
          ...validExpenseResponse,
          type: 'income',
          category: 'Salary',
        }),
      );
      component['type'] = 'income';
      component['category'] = 'Salary';
      component['amount'] = '50000';
      component['merchant'] = 'Employer';

      component['saveExpense']();

      expect(mockExpenseService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'income', category: 'Salary' }),
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

describe('NewExpenseComponent — edit mode', () => {
  const existingExpense = {
    id: 'uuid-edit-1',
    userId: 1,
    type: 'expense' as const,
    amount: 750,
    category: 'Transport',
    merchant: 'Ola',
    date: '2026-09-15',
    note: 'Quick ride',
    createdAt: '2026-09-15T10:00:00.000Z',
  };

  let component: NewExpenseComponent;
  let mockExpenseService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  async function setupEditMode(id: string, updateMock?: ReturnType<typeof vi.fn>) {
    mockExpenseService = {
      create: vi.fn(),
      list: vi.fn(),
      getById: vi.fn().mockReturnValue(of(existingExpense)),
      update: updateMock ?? vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NewExpenseComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: FinanceMetricsStore, useValue: { refresh: vi.fn() } },
        { provide: BudgetStore, useValue: { currency: signal('INR'), load: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue(id) } } },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewExpenseComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('sets isEditMode to true when id param is present', async () => {
    await setupEditMode('uuid-edit-1');
    expect(component['isEditMode']).toBe(true);
    expect(component['expenseId']).toBe('uuid-edit-1');
  });

  it('populates form fields from the loaded expense', async () => {
    await setupEditMode('uuid-edit-1');
    expect(component['type']).toBe('expense');
    expect(component['amount']).toBe('750');
    expect(component['merchant']).toBe('Ola');
    expect(component['category']).toBe('Transport');
    expect(component['date']).toBe('2026-09-15');
    expect(component['note']).toBe('Quick ride');
  });

  it('calls getById with the correct id', async () => {
    await setupEditMode('uuid-edit-1');
    expect(mockExpenseService.getById).toHaveBeenCalledWith('uuid-edit-1');
  });

  it('calls update (not create) on submit', async () => {
    const updateMock = vi.fn().mockReturnValue(of(existingExpense));
    await setupEditMode('uuid-edit-1', updateMock);

    component['saveExpense']();

    expect(updateMock).toHaveBeenCalledWith(
      'uuid-edit-1',
      expect.objectContaining({ amount: 750, merchant: 'Ola' }),
    );
    expect(mockExpenseService.create).not.toHaveBeenCalled();
  });

  it('navigates to /history after successful update', async () => {
    await setupEditMode('uuid-edit-1', vi.fn().mockReturnValue(of(existingExpense)));

    component['saveExpense']();

    expect(router.navigate).toHaveBeenCalledWith(['/history']);
  });

  it('sets errorMessage when update fails', async () => {
    await setupEditMode(
      'uuid-edit-1',
      vi.fn().mockReturnValue(throwError(() => new Error('Server error'))),
    );

    component['saveExpense']();

    expect(component['errorMessage']).toBeTruthy();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('resets isSubmitting to false after update failure', async () => {
    await setupEditMode(
      'uuid-edit-1',
      vi.fn().mockReturnValue(throwError(() => new Error('Server error'))),
    );

    component['saveExpense']();

    expect(component['isSubmitting']).toBe(false);
  });

  it('sets errorMessage when getById fails', async () => {
    mockExpenseService = {
      create: vi.fn(),
      list: vi.fn(),
      getById: vi.fn().mockReturnValue(throwError(() => new Error('Not found'))),
      update: vi.fn(),
    };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NewExpenseComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: FinanceMetricsStore, useValue: { refresh: vi.fn() } },
        { provide: BudgetStore, useValue: { currency: signal('INR'), load: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue('bad-id') } } },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewExpenseComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance['errorMessage']).toBeTruthy();
    expect(fixture.componentInstance['isLoading']).toBe(false);
  });
});
