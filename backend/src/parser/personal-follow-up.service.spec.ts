import { PersonalFollowUpService } from './personal-follow-up.service';
import type { XpenseSemanticSdk } from '../expense-semantics';
import type { ParserService } from './parser.service';
import { ParserService as RealParserService } from './parser.service';

const trace = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};
const drafts = [
  {
    ordinal: 1,
    amount: 350,
    category: 'Food & Dining',
    merchant: 'Cafe',
    date: '2026-11-22',
    note: 'coffee',
    splitResolution: 'personal',
    splitFactor: null,
  },
  {
    ordinal: 2,
    amount: 100,
    category: 'Transportation',
    merchant: 'Metro',
    date: '2026-11-22',
    note: 'ride',
    splitResolution: 'personal',
    splitFactor: null,
  },
];

describe('PersonalFollowUpService', () => {
  const parser = {
    parse: jest.fn().mockReturnValue({ draft: { date: null, category: null } }),
  } as unknown as ParserService;

  it('accepts a grounded edit to a named existing draft', async () => {
    const model = {
      isPersonalFollowUpConfigured: () => true,
      interpretPersonalFollowUp: jest
        .fn()
        .mockResolvedValue([
          {
            ordinal: 1,
            amount: '420',
            date: null,
            category: null,
            merchant: 'New Cafe',
            splitResolution: null,
            splitFactor: null,
          },
        ]),
    };
    const service = new PersonalFollowUpService(
      parser,
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Make the Cafe amount 420 at New Cafe',
      drafts,
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      updates: [{ ordinal: 1, amount: 420, merchant: 'New Cafe' }],
    });
    expect(model.interpretPersonalFollowUp).toHaveBeenCalledWith(
      expect.any(String),
      drafts,
      expect.any(String),
      undefined,
      'EDIT',
      trace,
      undefined,
    );
  });

  it('rejects invented values and unknown targets', async () => {
    const model = {
      isPersonalFollowUpConfigured: () => true,
      interpretPersonalFollowUp: jest
        .fn()
        .mockResolvedValue([
          {
            ordinal: 3,
            amount: '999',
            date: null,
            category: null,
            merchant: null,
            splitResolution: null,
            splitFactor: null,
          },
        ]),
    };
    const service = new PersonalFollowUpService(
      parser,
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Make the Cafe amount 420',
      drafts,
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: false,
      updates: [],
    });
  });

  it('accepts removal of the unique unsaved draft matching the stated amount', async () => {
    const current = [{ ...drafts[0], amount: 3000 }, drafts[1]];
    const model = {
      isPersonalFollowUpConfigured: () => true,
      interpretPersonalFollowUp: jest.fn().mockResolvedValue([
        {
          ordinal: 1,
          action: 'DELETE',
          amount: null,
          date: null,
          category: null,
          merchant: null,
          splitResolution: null,
          splitFactor: null,
        },
      ]),
    };
    const service = new PersonalFollowUpService(
      parser,
      model as unknown as XpenseSemanticSdk,
    );

    const result = await service.analyze(
      'delete the expense for 3000',
      current,
      trace,
    );

    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      updates: [{ ordinal: 1, delete: true }],
    });
  });

  it('rejects a deletion when the amount is wrong or matches multiple drafts', async () => {
    const model = {
      isPersonalFollowUpConfigured: () => true,
      interpretPersonalFollowUp: jest.fn().mockResolvedValue([
        {
          ordinal: 1,
          action: 'DELETE',
          amount: null,
          date: null,
          category: null,
          merchant: null,
          splitResolution: null,
          splitFactor: null,
        },
      ]),
    };
    const service = new PersonalFollowUpService(
      parser,
      model as unknown as XpenseSemanticSdk,
    );

    expect(
      (await service.analyze('delete the expense for 3000', drafts, trace))
        .updates,
    ).toEqual([]);
    expect(
      (
        await service.analyze(
          'delete the expense for 3000',
          [
            { ...drafts[0], amount: 3000 },
            { ...drafts[1], amount: 3000 },
          ],
          trace,
        )
      ).updates,
    ).toEqual([]);
  });

  it('accepts all and only unsaved drafts above a stated amount', async () => {
    const current = [180, 70, 350, 500, 1000].map((amount, index) => ({
      ...drafts[0],
      ordinal: index + 1,
      amount,
    }));
    const model = {
      isPersonalFollowUpConfigured: () => true,
      interpretPersonalFollowUp: jest.fn().mockResolvedValue(
        [4, 5].map((ordinal) => ({
          ordinal,
          action: 'DELETE',
          amount: null,
          date: null,
          category: null,
          merchant: null,
          splitResolution: null,
          splitFactor: null,
        })),
      ),
    };
    const service = new PersonalFollowUpService(
      parser,
      model as unknown as XpenseSemanticSdk,
    );

    const result = await service.analyze(
      'delete the draft for expenses above 400',
      current,
      trace,
    );

    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      updates: [
        { ordinal: 4, delete: true },
        { ordinal: 5, delete: true },
      ],
    });
  });

  it('rejects an incomplete or wrong range deletion proposed by the model', async () => {
    const current = [180, 70, 350, 500, 1000].map((amount, index) => ({
      ...drafts[0],
      ordinal: index + 1,
      amount,
    }));
    const model = {
      isPersonalFollowUpConfigured: () => true,
      interpretPersonalFollowUp: jest.fn(),
    };
    const service = new PersonalFollowUpService(
      parser,
      model as unknown as XpenseSemanticSdk,
    );

    for (const ordinals of [[4], [4, 3], [4, 5, 3]]) {
      model.interpretPersonalFollowUp.mockResolvedValueOnce(
        ordinals.map((ordinal) => ({ ordinal, action: 'DELETE' })),
      );
      expect(
        (await service.analyze('delete expenses above 400', current, trace))
          .updates,
      ).toEqual([]);
    }
  });

  it('accepts different grounded dates for two initial drafts', async () => {
    const text =
      'I spent a lot today, almost 5000 on shopping and yesterday I have spent 500 tops.';
    const initial = [
      {
        ...drafts[0],
        ordinal: 1,
        amount: 5000,
        date: '',
        category: 'Shopping',
      },
      { ...drafts[1], ordinal: 2, amount: 500, date: '', category: '' },
    ];
    const model = {
      isPersonalFollowUpConfigured: () => true,
      interpretPersonalFollowUp: jest.fn().mockResolvedValue([
        {
          ordinal: 1,
          date: '2026-11-25',
          dateEvidence: 'today, almost 5000',
          category: null,
        },
        {
          ordinal: 2,
          date: '2026-11-24',
          dateEvidence: 'yesterday I have spent 500',
          category: 'Shopping',
        },
      ]),
    };
    const service = new PersonalFollowUpService(
      new RealParserService(),
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      text,
      initial,
      trace,
      new Date('2026-11-25T06:00:00Z'),
      'Asia/Kolkata',
      'FILL_MISSING',
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      updates: [
        { ordinal: 1, date: '2026-11-25' },
        { ordinal: 2, date: '2026-11-24', category: 'Shopping' },
      ],
    });
  });

  it('rejects an invented date or evidence from the wrong amount', async () => {
    const text = 'spent 5000 today and yesterday spent 500';
    const initial = [
      { ...drafts[0], ordinal: 1, amount: 5000, date: '' },
      { ...drafts[1], ordinal: 2, amount: 500, date: '' },
    ];
    const model = {
      isPersonalFollowUpConfigured: () => true,
      interpretPersonalFollowUp: jest
        .fn()
        .mockResolvedValue([
          {
            ordinal: 1,
            date: '2026-11-24',
            dateEvidence: 'yesterday spent 500',
          },
        ]),
    };
    const service = new PersonalFollowUpService(
      new RealParserService(),
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      text,
      initial,
      trace,
      new Date('2026-11-25T06:00:00Z'),
      'Asia/Kolkata',
      'FILL_MISSING',
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: false,
      updates: [],
    });
  });
});
