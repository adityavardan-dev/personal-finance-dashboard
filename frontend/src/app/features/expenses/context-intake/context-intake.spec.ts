import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { BudgetStore } from '../../../core/budget/budget.store';
import { FinanceMetricsStore } from '../../../core/finance/finance-metrics.store';
import { ParseBatchResult, ParseResult } from '../../../core/parser/parser.models';
import { ParserService } from '../../../core/parser/parser.service';
import { ExpenseService } from '../expense.service';
import { ContextIntakeSessionService } from './context-intake-session.service';
import { ContextIntakeComponent } from './context-intake';

describe('ContextIntakeComponent', () => {
  let component: ContextIntakeComponent;
  let fixture: ComponentFixture<ContextIntakeComponent>;
  let parserService: {
    parse: ReturnType<typeof vi.fn>;
    parseBatch: ReturnType<typeof vi.fn>;
  };
  let expenseService: { createBatch: ReturnType<typeof vi.fn> };
  let metricsStore: { refresh: ReturnType<typeof vi.fn> };
  let session: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  const currency = signal<'INR' | 'USD' | 'EUR'>('INR');

  const readyDraft: ParseResult = {
    status: 'READY',
    draft: {
      amount: 350,
      currency: null,
      category: 'Food & Dining',
      merchant: 'Cafe',
      date: '2026-11-10',
      notes: 'spent 350 at Cafe on food today',
    },
    missingFields: [],
  };

  beforeEach(async () => {
    parserService = { parse: vi.fn(), parseBatch: vi.fn() };
    expenseService = { createBatch: vi.fn() };
    metricsStore = { refresh: vi.fn() };
    session = {
      load: vi.fn().mockReturnValue(null),
      save: vi.fn().mockImplementation((conversationId, value) => ({
        conversationId,
        value,
        lastActivityAt: '2026-11-10T10:00:00.000Z',
        expiresAt: '2026-11-10T10:30:00.000Z',
      })),
      clear: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ContextIntakeComponent],
      providers: [
        provideRouter([]),
        { provide: ParserService, useValue: parserService },
        { provide: ExpenseService, useValue: expenseService },
        { provide: FinanceMetricsStore, useValue: metricsStore },
        { provide: BudgetStore, useValue: { currency, load: vi.fn() } },
        { provide: ContextIntakeSessionService, useValue: session },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextIntakeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates multiple editable drafts without saving during parsing', () => {
    const batch: ParseBatchResult = {
      status: 'READY',
      drafts: [
        readyDraft,
        {
          ...readyDraft,
          draft: {
            ...readyDraft.draft,
            amount: 500,
            category: 'Transportation',
            merchant: 'Petrol pump',
            notes: 'spent 500 at Petrol pump on petrol today',
          },
        },
      ],
    };
    parserService.parseBatch.mockReturnValue(of(batch));
    component['rawText'] = 'spent 350 on food and spent 500 on petrol today';

    component['submitMessage']();

    expect(parserService.parseBatch).toHaveBeenCalledOnce();
    expect(component['drafts']()).toHaveLength(2);
    expect(component['drafts']()[1].category).toBe('Transport');
    expect(expenseService.createBatch).not.toHaveBeenCalled();
    expect(session.save).toHaveBeenCalled();
  });

  it('uses a deterministic chat follow-up to fill the missing date', () => {
    const missingDate: ParseResult = {
      ...readyDraft,
      status: 'NEEDS_CLARIFICATION',
      draft: { ...readyDraft.draft, date: null },
      missingFields: ['date'],
    };
    parserService.parseBatch.mockReturnValue(
      of({ status: 'NEEDS_CLARIFICATION', drafts: [missingDate] }),
    );
    parserService.parse.mockReturnValue(
      of({
        status: 'NEEDS_CLARIFICATION',
        draft: {
          amount: null,
          currency: null,
          category: null,
          merchant: null,
          date: '2026-11-09',
          notes: 'yesterday',
        },
        missingFields: ['amount', 'category'],
      }),
    );

    component['rawText'] = 'spent 350 at Cafe on food';
    component['submitMessage']();
    component['rawText'] = 'yesterday';
    component['submitMessage']();

    expect(parserService.parse).toHaveBeenCalledWith('yesterday');
    expect(component['drafts']()[0].date).toBe('2026-11-09');
    expect(component['canSaveDraft'](component['drafts']()[0])).toBe(true);
  });

  it('saves all selected ready drafts through one batch request', () => {
    parserService.parseBatch.mockReturnValue(
      of({ status: 'READY', drafts: [readyDraft, readyDraft] }),
    );
    expenseService.createBatch.mockReturnValue(of([]));
    component['rawText'] = 'two ready transactions';
    component['submitMessage']();

    component['saveSelected']();

    expect(expenseService.createBatch).toHaveBeenCalledTimes(1);
    expect(expenseService.createBatch.mock.calls[0][0]).toHaveLength(2);
    expect(component['drafts']().every((draft) => draft.saveStatus === 'saved')).toBe(true);
    expect(metricsStore.refresh).toHaveBeenCalledOnce();
    expect(session.clear).toHaveBeenCalled();
  });

  it('keeps existing drafts when a follow-up request fails', () => {
    parserService.parseBatch.mockReturnValue(of({ status: 'READY', drafts: [readyDraft] }));
    parserService.parse.mockReturnValue(throwError(() => new Error('offline')));
    component['rawText'] = readyDraft.draft.notes;
    component['submitMessage']();
    component['rawText'] = 'change transaction 1 to 400';

    component['submitMessage']();

    expect(component['drafts']()).toHaveLength(1);
    expect(component['drafts']()[0].amount).toBe('350');
    expect(component['errorMessage']()).toContain("couldn't process");
  });
});
