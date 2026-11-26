import { BadRequestException } from '@nestjs/common';
import { SplitFollowUpService } from './split-follow-up.service';
import type { XpenseSemanticSdk } from '../expense-semantics';

const trace = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};
const pending = [
  { ordinal: 1, peopleCount: 5 },
  { ordinal: 2, peopleCount: 2 },
  { ordinal: 3, peopleCount: 3 },
];

describe('SplitFollowUpService', () => {
  it('normalizes a local myself participant to You', async () => {
    const model = {
      isPeerConfigured: () => true,
      interpretPeerFollowUp: jest.fn(),
    };
    const service = new SplitFollowUpService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Use myself, Katty and Sridevi for split 1',
      [{ ordinal: 1, peopleCount: 3 }],
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: false,
      updates: [{ ordinal: 1, names: ['You', 'Katty', 'Sridevi'] }],
    });
  });
  it('updates two numbered splits locally without calling the model', async () => {
    const model = {
      isPeerConfigured: jest.fn().mockReturnValue(true),
      interpretPeerFollowUp: jest.fn(),
    };
    const service = new SplitFollowUpService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Use Jashu, Harsha and Aditya for split 1 and use Aditya and Katty for 2nd split',
      pending,
      trace,
    );
    expect(result.updates).toEqual([
      { ordinal: 1, names: ['Jashu', 'Harsha', 'Aditya'] },
      { ordinal: 2, names: ['Aditya', 'Katty'] },
    ]);
    expect(result.modelAttempted).toBe(false);
    expect(model.interpretPeerFollowUp).not.toHaveBeenCalled();
  });

  it('keeps the explicit payer on a numbered expense', async () => {
    const service = new SplitFollowUpService({
      isPeerConfigured: () => false,
    } as XpenseSemanticSdk);
    const result = await service.analyze(
      'expense 2: You, Harsha; paid by Harsha',
      pending,
      trace,
    );
    expect(result.updates).toEqual([
      { ordinal: 2, names: ['You', 'Harsha'], paidBy: 'Harsha' },
    ]);
  });

  it('uses the model for wording the local parser cannot map', async () => {
    const model = {
      isPeerConfigured: () => true,
      interpretPeerFollowUp: jest
        .fn()
        .mockResolvedValue([{ ordinal: 2, names: ['Aditya', 'Katty'] }]),
    };
    const service = new SplitFollowUpService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'The second cab should be shared by Aditya and Katty',
      pending,
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      interpretationSource: 'MODEL',
      updates: [{ ordinal: 2 }],
    });
  });

  it('accepts a payer-only later turn using existing participant context', async () => {
    const model = {
      isPeerConfigured: () => true,
      interpretPeerFollowUp: jest
        .fn()
        .mockResolvedValue([
          {
            ordinal: 2,
            names: null,
            paidBy: 'Katty',
            amount: null,
            peopleCount: null,
          },
        ]),
    };
    const service = new SplitFollowUpService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Katty paid for the second split',
      [
        {
          ordinal: 2,
          peopleCount: 2,
          amountMinor: 30000,
          names: ['You', 'Katty'],
          paidBy: '',
        },
      ],
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      updates: [{ ordinal: 2, paidBy: 'Katty' }],
    });
  });

  it('retains a payer supplied before participant names', async () => {
    const model = {
      isPeerConfigured: () => true,
      interpretPeerFollowUp: jest
        .fn()
        .mockResolvedValue([
          {
            ordinal: 1,
            names: null,
            paidBy: 'Harsha',
            amount: null,
            peopleCount: null,
          },
        ]),
    };
    const service = new SplitFollowUpService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Harsha paid for split 1',
      [
        {
          ordinal: 1,
          peopleCount: 2,
          amountMinor: 50000,
          names: [],
          paidBy: '',
        },
      ],
      trace,
    );
    expect(result.updates).toEqual([{ ordinal: 1, paidBy: 'Harsha' }]);
  });

  it('accepts a corrected total without replacing names', async () => {
    const model = {
      isPeerConfigured: () => true,
      interpretPeerFollowUp: jest
        .fn()
        .mockResolvedValue([
          {
            ordinal: 2,
            names: null,
            paidBy: null,
            amount: '350',
            peopleCount: null,
          },
        ]),
    };
    const service = new SplitFollowUpService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Actually split 2 total was 350',
      [
        {
          ordinal: 2,
          peopleCount: 2,
          amountMinor: 30000,
          names: ['You', 'Katty'],
        },
      ],
      trace,
    );
    expect(result.updates).toEqual([{ ordinal: 2, amountMinor: 35000 }]);
  });

  it('rejects an invented name or mismatched group size', async () => {
    const model = {
      isPeerConfigured: () => true,
      interpretPeerFollowUp: jest
        .fn()
        .mockResolvedValue([{ ordinal: 2, names: ['Aditya', 'Invented'] }]),
    };
    const service = new SplitFollowUpService(
      model as unknown as XpenseSemanticSdk,
    );
    const result = await service.analyze(
      'Aditya and Katty for split 2',
      pending,
      trace,
    );
    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: false,
      updates: [],
    });
  });

  it('rejects invalid pending context', async () => {
    const service = new SplitFollowUpService({
      isPeerConfigured: () => false,
    } as XpenseSemanticSdk);
    await expect(
      service.analyze(
        'use A and B for split 1',
        [
          { ordinal: 1, peopleCount: 2 },
          { ordinal: 1, peopleCount: 2 },
        ],
        trace,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
