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
import { PeerSplitsService } from '../../peer-splits/peer-splits.service';

describe('ContextIntakeComponent', () => {
  let component: ContextIntakeComponent;
  let fixture: ComponentFixture<ContextIntakeComponent>;
  let parserService: {
    parse: ReturnType<typeof vi.fn>;
    parseBatch: ReturnType<typeof vi.fn>;
  };
  let expenseService: { createBatch: ReturnType<typeof vi.fn> };
  let metricsStore: { refresh: ReturnType<typeof vi.fn> };
  let splitService: {
    preview: ReturnType<typeof vi.fn>;
    addPreview: ReturnType<typeof vi.fn>;
    getGroup: ReturnType<typeof vi.fn>;
    updateDate: ReturnType<typeof vi.fn>;
  };
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
    splitService = {
      preview: vi.fn(),
      addPreview: vi.fn().mockReturnValue('split-1'),
      getGroup: vi.fn(),
      updateDate: vi.fn(),
    };
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
        { provide: PeerSplitsService, useValue: splitService },
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

  it('turns a named split message into a linked summary without personal parser persistence', () => {
    splitService.preview.mockReturnValue(
      of({
        totalAmountMinor: 180000,
        currency: 'INR',
        allocations: [],
        balances: [],
        obligations: [],
      }),
    );
    component['rawText'] =
      'Self paid INR 1800; Jaswanth owes INR 400; Self and Harsha split the remainder.';

    component['submitMessage']();
    fixture.detectChanges();

    expect(splitService.preview).toHaveBeenCalledOnce();
    expect(parserService.parseBatch).not.toHaveBeenCalled();
    expect(expenseService.createBatch).not.toHaveBeenCalled();
    expect(component['messages']().at(-1)?.splitPreview).toMatchObject({
      id: 'split-1',
      totalAmountMinor: 180000,
      people: 3,
    });
    expect(
      fixture.nativeElement.querySelector('a[aria-label="View split details for Group split"]'),
    ).toBeTruthy();
  });

  it('applies a date-only chat follow-up to the split preview', () => {
    splitService.preview.mockReturnValue(
      of({ totalAmountMinor: 300000, currency: 'INR', allocations: [], balances: [], obligations: [] }),
    );
    splitService.getGroup.mockReturnValue({ id: 'split-1', date: null, example: false });
    splitService.updateDate.mockReturnValue(true);
    component['rawText'] = 'I paid INR 3000 with Harsha and Khyathi, split equally';
    component['submitMessage']();

    component['rawText'] = 'today is the date';
    component['submitMessage']();
    fixture.detectChanges();

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(splitService.updateDate).toHaveBeenCalledWith('split-1', today);
    expect(splitService.preview).toHaveBeenCalledOnce();
    expect(parserService.parseBatch).not.toHaveBeenCalled();
    expect(component['messages']().find((message) => message.splitPreview)?.splitPreview?.date).toBe(today);
    expect(fixture.nativeElement.textContent).toContain(today);
  });

  it('creates multiple editable drafts without saving during parsing', () => {
    expect(fixture.nativeElement.querySelector('#workspace-title')).toBeNull();

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
    fixture.detectChanges();

    expect(parserService.parseBatch).toHaveBeenCalledOnce();
    expect(component['drafts']()).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('#workspace-title')).not.toBeNull();
    expect(component['drafts']()[1].category).toBe('Transport');
    expect(expenseService.createBatch).not.toHaveBeenCalled();
    expect(session.save).toHaveBeenCalled();
  });

  it('keeps a parsed personal expense ready when merchant is missing', () => {
    parserService.parseBatch.mockReturnValue(of({
      status: 'READY',
      drafts: [{ ...readyDraft, draft: { ...readyDraft.draft, merchant: null } }],
    }));
    component['rawText'] = 'spent 350 on food today';
    component['submitMessage']();

    expect(component['canSaveDraft'](component['drafts']()[0])).toBe(true);
  });

  it('uses an icon-only composer action with an accessible label', () => {
    const submitButton = fixture.nativeElement.querySelector(
      'button[aria-label="Send transaction description"]',
    ) as HTMLButtonElement;

    expect(submitButton).not.toBeNull();
    expect(submitButton.textContent?.trim()).toBe('');
    expect(submitButton.querySelector('svg')).not.toBeNull();
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

  it('shows the parser clarification and focuses the first missing control', async () => {
    const missingDate: ParseResult = {
      ...readyDraft,
      status: 'NEEDS_CLARIFICATION',
      draft: { ...readyDraft.draft, date: null },
      missingFields: ['date'],
      clarificationPrompt: 'What exact date should I use for this transaction?',
    };
    parserService.parseBatch.mockReturnValue(
      of({
        status: 'NEEDS_CLARIFICATION',
        drafts: [missingDate],
        clarificationPrompt: 'What exact date should I use for this transaction?',
      }),
    );
    component['rawText'] = 'spent 350 at Cafe on food';

    component['submitMessage']();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    const draft = component['drafts']()[0];
    const dateInput = fixture.nativeElement.querySelector(`#date-${draft.id}`) as HTMLInputElement;
    expect(component['messages']().at(-1)?.text).toContain(
      'What exact date should I use for this transaction?',
    );
    expect(dateInput.getAttribute('aria-invalid')).toBe('true');
    expect(dateInput.classList.contains('field-needs-attention')).toBe(true);
    expect(document.activeElement).toBe(dateInput);
  });

  it('does not guess an ambiguous follow-up target across multiple drafts', () => {
    const missingDate = (merchant: string): ParseResult => ({
      ...readyDraft,
      status: 'NEEDS_CLARIFICATION',
      draft: { ...readyDraft.draft, merchant, date: null },
      missingFields: ['date'],
    });
    parserService.parseBatch.mockReturnValue(
      of({
        status: 'NEEDS_CLARIFICATION',
        drafts: [missingDate('Cafe'), missingDate('Fuel stop')],
      }),
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
    component['rawText'] = 'two transactions without dates';
    component['submitMessage']();
    component['rawText'] = 'yesterday';

    component['submitMessage']();

    expect(component['drafts']().every((draft) => draft.date === '')).toBe(true);
    expect(component['messages']().at(-1)?.text).toContain('could not identify which transaction');
  });

  it('saves all selected ready drafts through one batch request', () => {
    parserService.parseBatch.mockReturnValue(
      of({ status: 'READY', drafts: [readyDraft, readyDraft] }),
    );
    expenseService.createBatch.mockReturnValue(of([]));
    component['rawText'] = 'two ready transactions';
    component['submitMessage']();

    component['saveSelected']();
    fixture.detectChanges();

    expect(expenseService.createBatch).toHaveBeenCalledTimes(1);
    expect(expenseService.createBatch.mock.calls[0][0]).toHaveLength(2);
    expect(component['drafts']()).toHaveLength(0);
    expect(component['messages']().at(-1)?.savedSummary).toMatchObject({
      count: 2,
      total: 700,
      currency: 'INR',
    });
    expect(fixture.nativeElement.querySelector('#workspace-title')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Saved transaction summary"]'),
    ).not.toBeNull();
    expect(metricsStore.refresh).toHaveBeenCalledOnce();
    expect(session.clear).not.toHaveBeenCalled();
    expect(session.save).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ drafts: [] }),
    );
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

  it('keeps ready drafts editable when batch saving fails', () => {
    parserService.parseBatch.mockReturnValue(of({ status: 'READY', drafts: [readyDraft] }));
    expenseService.createBatch.mockReturnValue(throwError(() => new Error('offline')));
    component['rawText'] = readyDraft.draft.notes;
    component['submitMessage']();

    component['saveAllReady']();
    fixture.detectChanges();

    expect(component['drafts']()).toHaveLength(1);
    expect(component['drafts']()[0].saveStatus).toBe('error');
    expect(component['errorMessage']()).toContain('No transactions from this batch were saved');
    expect(metricsStore.refresh).not.toHaveBeenCalled();
  });

  it('converts a legacy cached saved draft into a chat summary instead of reopening it', () => {
    parserService.parseBatch.mockReturnValue(of({ status: 'READY', drafts: [readyDraft] }));
    component['rawText'] = readyDraft.draft.notes;
    component['submitMessage']();
    const savedDraft = { ...component['drafts']()[0], saveStatus: 'saved' as const };
    const messages = component['messages']();

    fixture.destroy();
    session.load.mockReturnValue({
      conversationId: 'legacy-conversation',
      lastActivityAt: '2026-11-10T10:00:00.000Z',
      expiresAt: '2026-11-10T10:30:00.000Z',
      value: { messages, drafts: [savedDraft] },
    });
    session.save.mockClear();
    fixture = TestBed.createComponent(ContextIntakeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['drafts']()).toHaveLength(0);
    expect(component['messages']().at(-1)?.savedSummary).toMatchObject({ count: 1, total: 350 });
    expect(fixture.nativeElement.querySelector('#workspace-title')).toBeNull();
    expect(session.save).toHaveBeenCalledOnce();
  });
});
