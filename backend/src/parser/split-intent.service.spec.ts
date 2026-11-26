import { SplitIntentService } from './split-intent.service';
import type { XpenseSemanticSdk } from '../expense-semantics';

const trace = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};

describe('SplitIntentService', () => {
  it('extracts the three numbered splits locally without calling Cloudflare', async () => {
    const model = {
      isPeerConfigured: jest.fn().mockReturnValue(true),
      interpretPeerSplits: jest.fn(),
    };
    const service = new SplitIntentService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'need to split 3 expenses today, 1st expense 4000 among 5 people 2nd one 300 with 2 people 3rd one 500 with 3 people',
      trace,
    );
    expect(
      result.drafts.map((item) => [item.amountMinor, item.peopleCount]),
    ).toEqual([
      [400000, 5],
      [30000, 2],
      [50000, 3],
    ]);
    expect(result.modelAttempted).toBe(false);
    expect(model.interpretPeerSplits).not.toHaveBeenCalled();
  });

  it('uses validated model extraction when local rules cannot read the wording', async () => {
    const model = {
      isPeerConfigured: jest.fn().mockReturnValue(true),
      interpretPeerSplits: jest
        .fn()
        .mockResolvedValue([{ amount: '4000', peopleCount: '5' }]),
    };
    const service = new SplitIntentService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze('Share 4000 across 5 people', trace);
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      interpretationSource: 'MODEL',
      drafts: [{ amountMinor: 400000, peopleCount: 5 }],
    });
  });

  it('accepts an explicit people count written as a word across a split clarification', async () => {
    const model = {
      isPeerConfigured: () => true,
      interpretPeerSplits: jest
        .fn()
        .mockResolvedValue([
          {
            amount: '500',
            peopleCount: '2',
            participants: [],
            paidBy: null,
            allocationKind: 'EQUAL',
            beneficiary: null,
          },
        ]),
    };
    const service = new SplitIntentService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'I want to split an expense The total was 500 It was between two people',
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      drafts: [{ amountMinor: 50000, peopleCount: 2 }],
    });
  });

  it('rejects amounts invented by the model', async () => {
    const model = {
      isPeerConfigured: jest.fn().mockReturnValue(true),
      interpretPeerSplits: jest
        .fn()
        .mockResolvedValue([{ amount: '9000', peopleCount: '5' }]),
    };
    const service = new SplitIntentService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze('Share 4000 across 5 people', trace);
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: false,
      drafts: [],
    });
  });

  it('accepts named payers and an implied group size from the model', async () => {
    const model = {
      isPeerConfigured: jest.fn().mockReturnValue(true),
      interpretPeerSplits: jest.fn().mockResolvedValue([
        {
          amount: '500',
          peopleCount: '2',
          participants: ['You', 'Harsha'],
          paidBy: 'Harsha',
          allocationKind: 'EQUAL',
          beneficiary: null,
        },
        {
          amount: '300',
          peopleCount: '2',
          participants: ['You', 'Katty'],
          paidBy: 'You',
          allocationKind: 'FULL_TO_OTHER',
          beneficiary: 'Katty',
        },
      ]),
    };
    const service = new SplitIntentService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Harsha paid 500 for me and him and I paid 300 to Katty',
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      interpretationSource: 'MODEL',
      drafts: [
        {
          amountMinor: 50000,
          peopleCount: 2,
          names: ['You', 'Harsha'],
          paidBy: 'Harsha',
          allocationKind: 'EQUAL',
        },
        {
          amountMinor: 30000,
          peopleCount: 2,
          names: ['You', 'Katty'],
          paidBy: 'You',
          allocationKind: 'FULL_TO_OTHER',
          beneficiary: 'Katty',
        },
      ],
    });
  });

  it.each(['I', 'me', 'myself'])(
    'normalizes %s to the logged-in participant',
    async (alias) => {
      const model = {
        isPeerConfigured: () => true,
        interpretPeerSplits: jest
          .fn()
          .mockResolvedValue([
            {
              amount: '2000',
              peopleCount: '3',
              participants: [alias, 'Katty', 'Sridevi'],
              paidBy: alias,
              allocationKind: 'EQUAL',
              beneficiary: null,
            },
          ]),
      };
      const service = new SplitIntentService(
        model as unknown as XpenseSemanticSdk,
      );
      const result = await service.analyze(
        `Split 2000 between ${alias}, Katty and Sridevi`,
        trace,
      );
      expect(result).toMatchObject({
        modelAccepted: true,
        drafts: [{ names: ['You', 'Katty', 'Sridevi'], paidBy: 'You' }],
      });
    },
  );

  it('rejects model participants absent from the message', async () => {
    const model = {
      isPeerConfigured: jest.fn().mockReturnValue(true),
      interpretPeerSplits: jest
        .fn()
        .mockResolvedValue([
          {
            amount: '500',
            peopleCount: '2',
            participants: ['You', 'Invented'],
            paidBy: 'Invented',
            allocationKind: 'EQUAL',
            beneficiary: null,
          },
        ]),
    };
    const service = new SplitIntentService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Harsha paid 500 for me and him',
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: false,
      drafts: [],
    });
  });
});
