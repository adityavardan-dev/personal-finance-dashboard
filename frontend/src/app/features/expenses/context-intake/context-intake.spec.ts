import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { BudgetStore } from '../../../core/budget/budget.store';
import { FinanceMetricsStore } from '../../../core/finance/finance-metrics.store';
import { ParseBatchResult, ParseResult } from '../../../core/parser/parser.models';
import { ParserService } from '../../../core/parser/parser.service';
import { EvalCasesService } from '../../../core/parser/eval-cases.service';
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
    interpretSplit: ReturnType<typeof vi.fn>;
    interpretSplitFollowUp: ReturnType<typeof vi.fn>;
    interpretPersonalFollowUp: ReturnType<typeof vi.fn>;
  };
  let expenseService: { createBatch: ReturnType<typeof vi.fn> };
  let evalCases: { create: ReturnType<typeof vi.fn> };
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
    parserService = { parse: vi.fn(), parseBatch: vi.fn(), interpretSplit: vi.fn(), interpretSplitFollowUp: vi.fn(), interpretPersonalFollowUp: vi.fn().mockReturnValue(of({ updates: [], clarificationPrompt: 'I could not identify which transaction to update.' })) };
    expenseService = { createBatch: vi.fn() };
    evalCases = { create: vi.fn().mockReturnValue(of({ id: 'case-1' })) };
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
        { provide: EvalCasesService, useValue: evalCases },
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

  it('shows PENNY as the conversation assistant', () => {
    expect(fixture.nativeElement.textContent).toContain('Chat with PENNY');
    component['rawText'] = 'Hi';
    component['submitMessage']();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('PENNY');
  });

  it.each(['Hi', 'Hello!', 'hey there'])(
    'answers "%s" without making a transaction draft',
    (text) => {
      component['rawText'] = text;
      component['submitMessage']();

      expect(parserService.parseBatch).not.toHaveBeenCalled();
      expect(splitService.preview).not.toHaveBeenCalled();
      expect(component['drafts']()).toHaveLength(0);
      expect(component['messages']().map((message) => message.text)).toEqual([
        text,
        "Hi, I'm PENNY. How much did you spend today?",
      ]);
      expect(component['messages']()[0].requestId).toBe(component['messages']()[1].requestId);
    },
  );

  it('asks for the amount and participants when greeted in split mode', () => {
    Object.defineProperty(component, 'splitMode', { value: true });
    component['rawText'] = 'Hey!';
    component['submitMessage']();

    expect(splitService.preview).not.toHaveBeenCalled();
    expect(parserService.parseBatch).not.toHaveBeenCalled();
    expect(component['drafts']()).toHaveLength(0);
    expect(component['messages']().at(-1)?.text).toBe(
      "Hi, I'm PENNY. How much did you spend today, and who are you splitting it with?",
    );
  });

  it('parses a transaction that starts with a greeting', () => {
    parserService.parseBatch.mockReturnValue(of({ status: 'READY', drafts: [readyDraft] }));
    component['rawText'] = 'Hi, I spent INR 350 on lunch today';
    component['submitMessage']();

    expect(parserService.parseBatch).toHaveBeenCalledOnce();
    expect(component['drafts']()).toHaveLength(1);
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
    expect(splitService.preview.mock.calls[0][1]).toMatchObject({
      conversationId: expect.any(String),
      requestId: expect.any(String),
    });
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

  it('offers a DEV test case beneath a local split reply and saves the human expectation', () => {
    splitService.preview.mockReturnValue(of({
      totalAmountMinor: 90000, currency: 'INR', allocations: [], balances: [], obligations: [],
    }));
    component['rawText'] = 'Today I paid ₹900 for dinner with Asha and Ravi. Split it equally among the three of us. I also spent ₹150 on coffee just for myself';
    component['submitMessage']();
    fixture.detectChanges();

    const addButton = [...fixture.nativeElement.querySelectorAll('button')]
      .find((button: HTMLButtonElement) => button.textContent?.trim() === 'Add test case');
    expect(addButton).toBeTruthy();
    addButton.click();
    component['expectedTestCase'] = 'Keep the dinner split and also create a ₹150 personal coffee draft.';
    component['saveTestCase'](component['messages']().at(-1)!);

    expect(evalCases.create).toHaveBeenCalledWith(expect.objectContaining({
      modelAttempted: false,
      expectedDescription: 'Keep the dinner split and also create a ₹150 personal coffee draft.',
      input: expect.objectContaining({ message: expect.stringContaining('₹150 on coffee') }),
      observed: expect.objectContaining({ reply: expect.stringContaining('Split preview ready') }),
    }));
    expect(component['messages']().at(-1)?.testCaseId).toBe('case-1');
  });

  it('offers a test case for an attempted but rejected AI response and stores the response', () => {
    const response = { status: 'NEEDS_CLARIFICATION', drafts: [readyDraft],
      modelAttempted: true, modelAccepted: false, interpretationSource: 'LOCAL' as const,
      clarificationPrompt: 'Could not separate safely.' };
    parserService.parseBatch.mockReturnValue(of(response));
    component['rawText'] = 'personal was 700 2 days ago and 1000 spent yesterday with harsha and jaswanth';
    component['submitMessage']();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Add test case');
    component['expectedTestCase'] = 'Create a personal draft and a separate split draft, preserving both dates.';
    component['saveTestCase'](component['messages']().at(-1)!);
    expect(evalCases.create).toHaveBeenCalledWith(expect.objectContaining({
      modelAttempted: true,
      observed: expect.objectContaining({
        modelAttempted: true,
        modelAccepted: false,
        interpretationSource: 'LOCAL',
        response,
      }),
    }));
  });

  it('keeps multiple unnamed splits as drafts and previews one after names and payer arrive', () => {
    parserService.interpretSplit.mockReturnValue(
      of({
        drafts: [
          { ordinal: 1, amountMinor: 400000, peopleCount: 5, currency: 'INR', date: '2026-11-22' },
          { ordinal: 2, amountMinor: 30000, peopleCount: 2, currency: 'INR', date: '2026-11-22' },
          { ordinal: 3, amountMinor: 50000, peopleCount: 3, currency: 'INR', date: '2026-11-22' },
        ],
        modelAttempted: false,
        modelAccepted: false,
        interpretationSource: 'LOCAL',
      }),
    );
    splitService.preview.mockReturnValue(
      of({
        totalAmountMinor: 30000,
        currency: 'INR',
        allocations: [],
        balances: [],
        obligations: [],
      }),
    );
    component['rawText'] =
      'need to split 3 expenses today, 1st expense 4000 among 5 people 2nd one 300 with 2 people 3rd one 500 with 3 people';
    component['submitMessage']();

    expect(component['pendingSplits']()).toHaveLength(3);
    expect(parserService.interpretSplit).toHaveBeenCalledOnce();
    expect(splitService.preview).not.toHaveBeenCalled();
    expect(component['messages']().at(-1)?.text).toContain('I found 3 split expenses');

    component['rawText'] = 'expense 2: You, Harsha; paid by Harsha';
    parserService.interpretSplitFollowUp.mockReturnValue(of({ updates: [{ ordinal: 2, names: ['You', 'Harsha'], paidBy: 'Harsha' }] }));
    component['submitMessage']();
    const second = component['pendingSplits']()[1];
    expect(second.names).toBe('You, Harsha');
    expect(second.paidBy).toBe('Harsha');
    expect(parserService.interpretSplitFollowUp).toHaveBeenCalledWith(
      'expense 2: You, Harsha; paid by Harsha',
      expect.arrayContaining([expect.objectContaining({ ordinal: 2 })]),
      expect.objectContaining({ conversationId: expect.any(String), requestId: expect.any(String) }),
    );

    component['previewPendingSplit'](second);
    expect(splitService.preview).toHaveBeenCalledOnce();
    expect(component['pendingSplits']()).toHaveLength(2);
  });

  it('applies one follow-up to two pending splits while preserving amounts and the third split', () => {
    component['pendingSplits'].set([
      { id: 'one', ordinal: 1, amountMinor: 400000, peopleCount: 5, currency: 'INR', date: null, names: '', paidBy: '' },
      { id: 'two', ordinal: 2, amountMinor: 30000, peopleCount: 2, currency: 'INR', date: null, names: '', paidBy: '' },
      { id: 'three', ordinal: 3, amountMinor: 50000, peopleCount: 3, currency: 'INR', date: null, names: '', paidBy: '' },
    ]);
    parserService.interpretSplitFollowUp.mockReturnValue(of({ updates: [
      { ordinal: 1, names: ['Jashu', 'Harsha', 'Aditya'] },
      { ordinal: 2, names: ['Aditya', 'Katty'] },
    ] }));
    component['rawText'] = 'Use Jashu, Harsha and Aditya for split 1 and use Aditya and Katty for 2nd split';
    component['submitMessage']();

    expect(component['pendingSplits']().map((item) => [item.amountMinor, item.names, item.paidBy])).toEqual([
      [400000, 'Jashu, Harsha, Aditya', ''],
      [30000, 'Aditya, Katty', ''],
      [50000, '', ''],
    ]);
    expect(splitService.preview).not.toHaveBeenCalled();
    expect(component['messages']().at(-1)?.text).toContain('split 1 and split 2');
    expect(component['messages']().at(-1)?.text).toContain('Split 1 still needs 2 names');
  });

  it('keeps split details across turns and applies a payer-only AI follow-up', () => {
    component['pendingSplits'].set([{ id: 'one', ordinal: 1, amountMinor: 50000, peopleCount: 2, currency: 'INR', date: null, names: 'You, Harsha', paidBy: '' }]);
    parserService.interpretSplitFollowUp.mockReturnValue(of({ updates: [{ ordinal: 1, paidBy: 'Harsha' }] }));
    component['rawText'] = 'Harsha paid for the first split';
    component['submitMessage']();
    expect(parserService.interpretSplitFollowUp).toHaveBeenCalledOnce();
    expect(component['pendingSplits']()[0]).toMatchObject({ names: 'You, Harsha', paidBy: 'Harsha', amountMinor: 50000 });
  });

  it('uses AI split details after a split clarification and previews both obligations', () => {
    parserService.interpretSplit.mockReturnValueOnce(of({ drafts: [], modelAttempted: false, modelAccepted: false, interpretationSource: 'LOCAL' })).mockReturnValueOnce(of({
      drafts: [
        { ordinal: 1, amountMinor: 50000, peopleCount: 2, currency: 'INR', date: null, names: ['You', 'Harsha'], paidBy: 'Harsha', allocationKind: 'EQUAL' },
        { ordinal: 2, amountMinor: 30000, peopleCount: 2, currency: 'INR', date: null, names: ['You', 'Katty'], paidBy: 'You', allocationKind: 'FULL_TO_OTHER', beneficiary: 'Katty' },
      ], modelAttempted: true, modelAccepted: true, interpretationSource: 'MODEL',
    }));
    splitService.preview.mockImplementation((input) => of({ totalAmountMinor: input.totalAmountMinor, currency: input.currency, allocations: [], balances: [], obligations: [] }));

    component['rawText'] = 'I want split';
    component['submitMessage']();
    expect(component['messages']().at(-1)?.text).toContain('Tell me each expense amount');

    component['rawText'] = 'Harsha paid 500 for me and him and I paid 300 to Katty';
    component['submitMessage']();

    expect(parserService.interpretSplit).toHaveBeenCalledTimes(2);
    expect(splitService.preview).toHaveBeenCalledTimes(2);
    expect(splitService.preview.mock.calls[0][0]).toMatchObject({
      totalAmountMinor: 50000,
      contributions: [{ participantId: 'person-1', amountMinor: 50000 }],
      allocationRules: [{ kind: 'EQUAL_REMAINDER', participantIds: ['self', 'person-1'] }],
    });
    expect(splitService.preview.mock.calls[1][0]).toMatchObject({
      totalAmountMinor: 30000,
      contributions: [{ participantId: 'self', amountMinor: 30000 }],
      allocationRules: [
        { kind: 'FIXED_AMOUNT', participantId: 'person-1', amountMinor: 30000 },
        { kind: 'EQUAL_REMAINDER', participantIds: ['self'] },
      ],
    });
    expect(component['pendingSplits']()).toHaveLength(0);
    expect(component['messages']().filter((message) => message.splitPreview)).toHaveLength(2);
  });

  it('carries unresolved split facts across several turns until a draft exists', () => {
    parserService.interpretSplit.mockReturnValueOnce(of({ drafts: [] }))
      .mockReturnValueOnce(of({ drafts: [] }))
      .mockReturnValueOnce(of({ drafts: [{ ordinal: 1, amountMinor: 50000, peopleCount: 2, currency: 'INR', date: null }] }));
    component['rawText'] = 'I want to split an expense';
    component['submitMessage']();
    component['rawText'] = 'The total was 500';
    component['submitMessage']();
    component['rawText'] = 'It was between two people';
    component['submitMessage']();

    expect(parserService.interpretSplit).toHaveBeenNthCalledWith(3,
      'I want to split an expense The total was 500 It was between two people',
      expect.objectContaining({ conversationId: expect.any(String), requestId: expect.any(String) }),
    );
    expect(component['pendingSplits']()).toHaveLength(1);
    expect(component['unresolvedSplitMessages']).toEqual([]);
  });

  it('applies a date-only chat follow-up to the split preview', () => {
    splitService.preview.mockReturnValue(
      of({
        totalAmountMinor: 300000,
        currency: 'INR',
        allocations: [],
        balances: [],
        obligations: [],
      }),
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
    expect(
      component['messages']().find((message) => message.splitPreview)?.splitPreview?.date,
    ).toBe(today);
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

  it('keeps one conversation ID and creates a new request ID for each submitted turn', () => {
    parserService.parseBatch.mockReturnValue(of({ status: 'READY', drafts: [readyDraft] }));

    component['rawText'] = 'spent 350 on lunch today';
    component['submitMessage']();
    component['rawText'] = 'spent 500 on petrol today';
    component['submitMessage']();

    const firstTrace = parserService.parseBatch.mock.calls[0][1];
    const secondTrace = parserService.parseBatch.mock.calls[1][1];
    expect(firstTrace.conversationId).toBe(secondTrace.conversationId);
    expect(firstTrace.requestId).not.toBe(secondTrace.requestId);
    expect(component['messages']().map((message) => message.requestId)).toEqual([
      firstTrace.requestId,
      firstTrace.requestId,
      secondTrace.requestId,
      secondTrace.requestId,
    ]);
    expect(session.save.mock.calls.at(-1)?.[1].messages[0]).toMatchObject(firstTrace);

    component['startNewConversation']();
    expect(component['conversationId']).not.toBe(firstTrace.conversationId);
  });

  it('keeps a parsed personal expense ready when merchant is missing', () => {
    parserService.parseBatch.mockReturnValue(
      of({
        status: 'READY',
        drafts: [{ ...readyDraft, draft: { ...readyDraft.draft, merchant: null } }],
      }),
    );
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

    expect(parserService.parse).toHaveBeenCalledWith('yesterday', {
      conversationId: expect.any(String),
      requestId: expect.any(String),
    });
    expect(component['drafts']()[0].date).toBe('2026-11-09');
    expect(component['canSaveDraft'](component['drafts']()[0])).toBe(true);
    expect(parserService.interpretPersonalFollowUp).not.toHaveBeenCalled();
  });

  it('uses PENNY to apply successive personal edits when local parsing cannot', () => {
    parserService.parseBatch.mockReturnValue(of({ status: 'READY', drafts: [readyDraft] }));
    parserService.parse.mockReturnValue(of({ draft: { amount: null, category: null, merchant: null, date: null }, missingFields: [] }));
    parserService.interpretPersonalFollowUp
      .mockReturnValueOnce(of({ updates: [{ ordinal: 1, merchant: 'New Cafe' }] }))
      .mockReturnValueOnce(of({ updates: [{ ordinal: 1, amount: 420 }] }));
    component['rawText'] = 'spent 350 at Cafe on food today';
    component['submitMessage']();
    component['rawText'] = 'Actually the place was New Cafe';
    component['submitMessage']();
    component['rawText'] = 'Make that 420 instead';
    component['submitMessage']();

    expect(parserService.interpretPersonalFollowUp).toHaveBeenCalledTimes(2);
    expect(component['drafts']()[0]).toMatchObject({ merchant: 'New Cafe', amount: '420' });
    expect(parserService.interpretPersonalFollowUp.mock.calls[1][1][0].merchant).toBe('New Cafe');
  });

  it('removes only the unsaved draft selected by a PENNY deletion proposal', () => {
    parserService.parseBatch.mockReturnValue(of({ status: 'READY', drafts: [
      { ...readyDraft, draft: { ...readyDraft.draft, amount: 3000, originalAmount: 3000, merchant: 'Rent' } },
      { ...readyDraft, draft: { ...readyDraft.draft, amount: 350, originalAmount: 350, merchant: 'Cafe' } },
    ] }));
    parserService.interpretPersonalFollowUp.mockReturnValue(of({ updates: [{ ordinal: 1, delete: true }] }));
    component['rawText'] = 'spent 3000 on rent and 350 at Cafe';
    component['submitMessage']();
    component['rawText'] = 'delete the expense for 3000';

    component['submitMessage']();

    expect(parserService.interpretPersonalFollowUp).toHaveBeenCalledWith('delete the expense for 3000', expect.any(Array), expect.any(Object));
    expect(parserService.parse).not.toHaveBeenCalled();
    expect(component['drafts']()).toHaveLength(1);
    expect(component['drafts']()[0]).toMatchObject({ amount: '350', merchant: 'Cafe' });
    expect(component['messages']().at(-1)?.text).toContain('removed');
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
    parserService.interpretPersonalFollowUp.mockReturnValue(throwError(() => new Error('offline')));
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
