import { ParserService } from './parser.service';

describe('ParserService', () => {
  const service = new ParserService();
  const referenceDate = new Date(2026, 10, 9, 12, 0, 0);

  it('computes a split expense and requires date clarification without inventing a date', () => {
    const result = service.parse(
      'Had lunch with flatmates at Meghana ₹1200 split by 3',
      referenceDate,
    );

    expect(result).toEqual({
      status: 'NEEDS_CLARIFICATION',
      draft: {
        amount: 400,
        currency: 'INR',
        originalAmount: 1200,
        splitFactor: 3,
        category: 'Food & Dining',
        merchant: 'Meghana',
        date: null,
        notes: 'Had lunch with flatmates at Meghana ₹1200 split by 3',
      },
      missingFields: ['date'],
      clarificationPrompt: 'What exact date should I use for this transaction?',
    });
  });

  it('parses an authenticated UPI-style notification into a ready draft', () => {
    const result = service.parse(
      'Paid INR 1,250 to UBER on 2026-11-09',
      referenceDate,
    );

    expect(result.status).toBe('READY');
    expect(result.draft).toMatchObject({
      amount: 1250,
      currency: 'INR',
      category: 'Transportation',
      merchant: 'UBER',
      date: '2026-11-09',
    });
    expect(result.missingFields).toEqual([]);
    expect(result.clarificationPrompt).toBeUndefined();
  });

  it.each([
    ['coffee ₹200 today', '2026-11-09'],
    ['coffee Rs. 200 yesterday', '2026-11-08'],
    ['coffee ₹200 Nov 8', '2026-11-08'],
    ['coffee ₹200 8-Nov-2025', '2025-11-08'],
    ['coffee ₹200 on 2026-11-09', '2026-11-09'],
  ])('parses explicit date expression in "%s"', (text, expectedDate) => {
    expect(service.parse(text, referenceDate).draft.date).toBe(expectedDate);
  });

  it('supports slash split syntax and rounds the personal amount to two decimals', () => {
    const result = service.parse(
      'Dinner at Bistro ₹1,000 / 3 today',
      referenceDate,
    );

    expect(result.draft.amount).toBe(333.33);
    expect(result.draft.originalAmount).toBe(1000);
    expect(result.draft.splitFactor).toBe(3);
  });

  it('supports half as a split factor of two', () => {
    const result = service.parse(
      'Movie at PVR Rs 900 half today',
      referenceDate,
    );

    expect(result.draft.amount).toBe(450);
    expect(result.draft.originalAmount).toBe(900);
    expect(result.draft.splitFactor).toBe(2);
    expect(result.draft.category).toBe('Entertainment');
  });

  it.each([
    ['₹1,200 today lunch', 'INR'],
    ['Rs. 1,200 today lunch', 'INR'],
    ['INR 1,200 today lunch', 'INR'],
    ['1,200 INR today lunch', 'INR'],
    ['$1,200 today lunch', 'USD'],
    ['US$1,200 today lunch', 'USD'],
    ['USD 1,200 today lunch', 'USD'],
    ['1,200 USD today lunch', 'USD'],
    ['€1,200 today lunch', 'EUR'],
    ['EUR 1,200 today lunch', 'EUR'],
    ['1,200 EUR today lunch', 'EUR'],
  ])('detects supported application currency in "%s"', (text, currency) => {
    const result = service.parse(text, referenceDate);

    expect(result.draft.amount).toBe(1200);
    expect(result.draft.currency).toBe(currency);
  });

  it('leaves currency null for a bare amount so the app preference can apply', () => {
    const result = service.parse('Spent 1200 on lunch today', referenceDate);

    expect(result.draft.amount).toBe(1200);
    expect(result.draft.currency).toBeNull();
  });

  it('parses a bare amount after a spending verb', () => {
    const result = service.parse('I spent 3000 on movies today', referenceDate);

    expect(result.status).toBe('READY');
    expect(result.draft).toMatchObject({
      amount: 3000,
      currency: null,
      category: 'Entertainment',
      date: '2026-11-09',
      notes: 'I spent 3000 on movies today',
    });
  });

  it('maps plural snacks to Food & Dining', () => {
    const result = service.parse('spent 200 on snacks today', referenceDate);

    expect(result.draft).toMatchObject({
      amount: 200,
      category: 'Food & Dining',
      date: '2026-11-09',
    });
    expect(result.status).toBe('READY');
  });

  it('requires amount clarification when currencies conflict', () => {
    const result = service.parse('Lunch was $100 or €100 today', referenceDate);

    expect(result.draft.amount).toBeNull();
    expect(result.draft.currency).toBeNull();
    expect(result.missingFields).toEqual(['amount']);
  });

  it('does not guess when category tokens are ambiguous', () => {
    const result = service.parse(
      'Paid ₹500 for lunch and an Uber today',
      referenceDate,
    );

    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.draft.category).toBeNull();
    expect(result.missingFields).toEqual(['category']);
    expect(result.clarificationPrompt).toBe(
      'Which category should I use for this transaction?',
    );
  });

  it('does not guess when multiple currency amounts are present', () => {
    const result = service.parse(
      'Food bill ₹500, paid ₹450 today',
      referenceDate,
    );

    expect(result.draft.amount).toBeNull();
    expect(result.missingFields).toContain('amount');
  });

  it('rejects an impossible explicit date instead of normalizing it', () => {
    const result = service.parse('Lunch ₹200 on 2026-02-30', referenceDate);

    expect(result.draft.date).toBeNull();
    expect(result.missingFields).toEqual(['date']);
  });

  it('requires clarification when explicit dates conflict', () => {
    const result = service.parse('Lunch ₹200 on Nov 8 or Nov 9', referenceDate);

    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.draft.date).toBeNull();
    expect(result.missingFields).toEqual(['date']);
    expect(result.clarificationPrompt).toBe(
      'What exact date should I use for this transaction?',
    );
  });

  it('requires an exact date for vague date language without inferring a split', () => {
    const result = service.parse(
      'we spent 5000 on travelling few days ago',
      referenceDate,
    );

    expect(result).toMatchObject({
      status: 'NEEDS_CLARIFICATION',
      draft: {
        amount: 5000,
        currency: null,
        category: 'Transportation',
        date: null,
      },
      missingFields: ['date', 'split'],
      clarificationPrompt:
        'What exact date should I use, and is this already your personal amount or a total to split?',
    });
    expect(result.draft.originalAmount).toBeUndefined();
    expect(result.draft.splitFactor).toBeUndefined();
  });

  it.each([
    ['Lunch at Bistro $20 today', 'Bistro', 'USD'],
    ['Lunch at Bistro USD 20 today', 'Bistro', 'USD'],
    ['Lunch at Bistro €20 today', 'Bistro', 'EUR'],
    ['Lunch at Bistro EUR 20 today', 'Bistro', 'EUR'],
    ['Lunch at Bistro ₹20 today', 'Bistro', 'INR'],
  ])(
    'keeps currency text out of the merchant for "%s"',
    (text, merchant, currency) => {
      const result = service.parse(text, referenceDate);

      expect(result.draft.merchant).toBe(merchant);
      expect(result.draft.currency).toBe(currency);
    },
  );

  it('requires a split decision for shared-expense wording with a precise date', () => {
    const result = service.parse(
      'we spent 5000 on travelling today',
      referenceDate,
    );

    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.missingFields).toEqual(['split']);
    expect(result.clarificationPrompt).toBe(
      'Is this already your personal amount, or should the total be split?',
    );
    expect(result.draft.amount).toBe(5000);
    expect(result.draft.originalAmount).toBeUndefined();
  });

  it('parses currency words and an explicitly named pair without unnecessary clarification', () => {
    const result = service.parse(
      'me and Harsha spent 50 dollars at a bar today',
      referenceDate,
    );

    expect(result).toMatchObject({
      status: 'READY',
      draft: {
        amount: 25,
        currency: 'USD',
        originalAmount: 50,
        splitFactor: 2,
        category: 'Food & Dining',
        merchant: null,
        date: '2026-11-09',
      },
      missingFields: [],
    });
  });

  it('parses a numeric relative date and currency word as exact context', () => {
    const result = service.parse(
      'breakfast goa 10000 rupees 3 days ago',
      referenceDate,
    );

    expect(result).toMatchObject({
      status: 'READY',
      draft: {
        amount: 10000,
        currency: 'INR',
        category: 'Food & Dining',
        date: '2026-11-06',
      },
      missingFields: [],
    });
  });

  it.each([
    ['breakfast 10000 rupees 3 days ago', '2026-11-06'],
    ['breakfast 10000 rupees 2 weeks back', '2026-10-26'],
    ['breakfast 10000 rupees 2 months ago', '2026-09-09'],
    ['breakfast 10000 rupees 2 years back', '2024-11-09'],
  ])('resolves exact numeric relative date in "%s"', (text, expectedDate) => {
    const result = service.parse(text, referenceDate);

    expect(result.status).toBe('READY');
    expect(result.draft.date).toBe(expectedDate);
    expect(result.missingFields).toEqual([]);
  });

  it('uses a compatible precise relative date when vague month context is also present', () => {
    const result = service.parse(
      'I spent 3000 last month 30 days ago',
      new Date('2026-11-11T12:00:00+05:30'),
      'Asia/Kolkata',
    );

    expect(result.draft).toMatchObject({
      amount: 3000,
      date: '2026-10-12',
      category: null,
    });
    expect(result.missingFields).toEqual(['category']);
  });

  it('requires date clarification when precise and vague month context conflict', () => {
    const result = service.parse(
      'I spent 3000 last month 3 days ago',
      new Date('2026-11-11T12:00:00+05:30'),
      'Asia/Kolkata',
    );

    expect(result.draft.date).toBeNull();
    expect(result.missingFields).toEqual(['date', 'category']);
  });

  it('clamps calendar-relative years to a valid local date', () => {
    const leapDay = new Date(2024, 1, 29, 12, 0, 0);
    const result = service.parse('breakfast 10000 rupees 1 year ago', leapDay);

    expect(result.draft.date).toBe('2023-02-28');
  });

  it('resolves half an hour ago in the user timezone across midnight', () => {
    const result = service.parse(
      'half hour ago spent 350 on swiggy food order',
      new Date('2026-11-09T18:45:00.000Z'),
      'Asia/Kolkata',
    );

    expect(result).toMatchObject({
      status: 'READY',
      draft: {
        amount: 350,
        currency: null,
        category: 'Food & Dining',
        merchant: 'Swiggy',
        date: '2026-11-09',
      },
      missingFields: [],
    });
  });

  it.each([
    ['45 minutes ago spent 350 on swiggy', '2026-11-09'],
    ['2 hours back spent 350 on swiggy', '2026-11-09'],
    ['15 mins ago spent 350 on swiggy', '2026-11-10'],
  ])('resolves sub-day timestamp in "%s"', (text, expectedDate) => {
    const result = service.parse(
      text,
      new Date('2026-11-09T18:45:00.000Z'),
      'Asia/Kolkata',
    );

    expect(result.status).toBe('READY');
    expect(result.draft.date).toBe(expectedDate);
  });

  it('rejects an invalid user timezone', () => {
    expect(() =>
      service.parse('Lunch 200 today', referenceDate, 'Mars/Olympus'),
    ).toThrow('Unsupported timeZone');
  });

  it.each([
    'Lunch ₹200 recently',
    'Lunch ₹200 last week',
    'Lunch ₹200 around Nov 8',
  ])('asks for an exact date when "%s" is vague', (text) => {
    const result = service.parse(text, referenceDate);

    expect(result.draft.date).toBeNull();
    expect(result.missingFields).toEqual(['date']);
    expect(result.clarificationPrompt).toBe(
      'What exact date should I use for this transaction?',
    );
  });

  it.each([
    ['lunch ₹100 today', 'Food & Dining'],
    ['Uber ₹100 today', 'Transportation'],
    ['Amazon shopping ₹100 today', 'Shopping'],
    ['Netflix ₹100 today', 'Entertainment'],
    ['electricity bill ₹100 today', 'Bills & Utilities'],
    ['pharmacy ₹100 today', 'Health & Personal Care'],
    ['salary INR 100 today', 'Income'],
    ['misc ₹100 today', 'Other'],
  ])('maps "%s" to %s', (text, category) => {
    expect(service.parse(text, referenceDate).draft.category).toBe(category);
  });

  it('keeps the parser non-destructive by returning only a draft', () => {
    const result = service.parse('Lunch ₹400 today', referenceDate);

    expect(result.draft).not.toHaveProperty('id');
    expect(result.draft).not.toHaveProperty('userId');
    expect(result.draft).not.toHaveProperty('createdAt');
  });

  it('creates separate drafts for repeated transaction clauses', () => {
    const result = service.parseBatch(
      'spent 350 on food, spent 500 on petrol and spent 50 on sweets today',
      referenceDate,
    );

    expect(result.status).toBe('READY');
    expect(result.drafts).toHaveLength(3);
    expect(result.drafts.map((draft) => draft.draft.amount)).toEqual([
      350, 500, 50,
    ]);
    expect(result.drafts.map((draft) => draft.draft.category)).toEqual([
      'Food & Dining',
      'Transportation',
      'Food & Dining',
    ]);
    expect(
      result.drafts.every((draft) => draft.draft.date === '2026-11-09'),
    ).toBe(true);
  });

  it('applies one precise trailing date to every draft in a batch', () => {
    const result = service.parseBatch(
      'spent 350 on food, spent 500 on petrol and spent 50 on sweets yesterday',
      referenceDate,
    );

    expect(
      result.drafts.every((draft) => draft.draft.date === '2026-11-08'),
    ).toBe(true);
    expect(result.drafts.every((draft) => draft.status === 'READY')).toBe(true);
  });

  it('keeps all batch drafts in clarification when the shared date is absent', () => {
    const result = service.parseBatch(
      'spent 350 on food, spent 500 on petrol and spent 50 on sweets',
      referenceDate,
    );

    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.drafts).toHaveLength(3);
    expect(
      result.drafts.every((draft) => draft.missingFields.includes('date')),
    ).toBe(true);
  });

  it('inherits the expense verb for a shortened third clause', () => {
    const result = service.parseBatch(
      'I spent 400 on petrol today, spent 1000 on food orders yesterday and 500 on movie tickets 3 days ago',
      referenceDate,
    );

    expect(result.drafts).toHaveLength(3);
    expect(result.drafts.map((draft) => draft.draft.amount)).toEqual([
      400, 1000, 500,
    ]);
    expect(result.drafts.map((draft) => draft.draft.category)).toEqual([
      'Transportation',
      'Food & Dining',
      'Entertainment',
    ]);
    expect(result.drafts.map((draft) => draft.draft.date)).toEqual([
      '2026-11-09',
      '2026-11-08',
      '2026-11-06',
    ]);
    expect(result.drafts[2].draft.notes).toBe(
      '500 on movie tickets 3 days ago',
    );
  });

  it('separates repeated transaction verbs when punctuation is missing', () => {
    const result = service.parseBatch(
      'spent 400 on petrol today spent 1000 on food yesterday spent 500 on movies 3 days ago',
      referenceDate,
    );

    expect(result.drafts).toHaveLength(3);
    expect(result.drafts.map((draft) => draft.draft.amount)).toEqual([
      400, 1000, 500,
    ]);
  });

  it('normalizes curated misspellings without changing the original notes', () => {
    const result = service.parseBatch(
      'spnet 400 on petorl todya and 500 on moveis yestday',
      referenceDate,
    );

    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0].draft).toMatchObject({
      amount: 400,
      category: 'Transportation',
      date: '2026-11-09',
      notes: 'spnet 400 on petorl todya',
    });
    expect(result.drafts[1].draft).toMatchObject({
      amount: 500,
      category: 'Entertainment',
      date: '2026-11-08',
      notes: '500 on moveis yestday',
    });
  });

  it('does not split a comma-formatted amount', () => {
    const result = service.parseBatch(
      'spent 1,200 on food today',
      referenceDate,
    );

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].draft.amount).toBe(1200);
  });

  it('requests boundaries when several amounts cannot be separated safely', () => {
    const result = service.parseBatch(
      '400 petrol 1000 food 500 movies',
      referenceDate,
    );

    expect(result.drafts).toHaveLength(1);
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationPrompt).toContain(
      'could not separate them safely',
    );
  });
});
