/**
 * Purpose: Tests the behavior of the related backend feature.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParserController } from './parser.controller';
import { IntentService } from './intent.service';
import { ParserService } from './parser.service';
import { SplitIntentService } from './split-intent.service';
import { SplitFollowUpService } from './split-follow-up.service';
import { PersonalFollowUpService } from './personal-follow-up.service';

describe('ParserController', () => {
  let controller: ParserController;
  let service: jest.Mocked<Pick<ParserService, 'parse' | 'parseBatch'>>;
  let intent: jest.Mocked<Pick<IntentService, 'analyze'>>;

  beforeEach(async () => {
    service = {
      parse: jest.fn().mockReturnValue({
        status: 'NEEDS_CLARIFICATION',
        draft: {
          amount: 400,
          currency: 'INR',
          category: 'Food & Dining',
          merchant: 'Meghana',
          date: null,
          notes: 'Lunch at Meghana ₹1200 split by 3',
          originalAmount: 1200,
          splitFactor: 3,
        },
        missingFields: ['date'],
        clarificationPrompt:
          'What exact date should I use for this transaction?',
      }),
      parseBatch: jest.fn().mockReturnValue({
        status: 'READY',
        drafts: [],
      }),
    };
    intent = {
      analyze: jest.fn().mockResolvedValue({
        status: 'READY',
        drafts: [],
        modelAttempted: false,
        modelAccepted: false,
        interpretationSource: 'LOCAL',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParserController],
      providers: [
        { provide: ParserService, useValue: service },
        { provide: IntentService, useValue: intent },
        {
          provide: SplitIntentService,
          useValue: { analyze: jest.fn().mockResolvedValue({ drafts: [] }) },
        },
        {
          provide: SplitFollowUpService,
          useValue: { analyze: jest.fn().mockResolvedValue({ updates: [] }) },
        },
        {
          provide: PersonalFollowUpService,
          useValue: { analyze: jest.fn().mockResolvedValue({ updates: [] }) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ParserController);
  });

  it('routes multiple drafts through the intent service' /** Checks that routes multiple drafts through the intent service. */, async () => {
    const conversationId = '11111111-1111-4111-8111-111111111111';
    const requestId = '22222222-2222-4222-8222-222222222222';
    const result = await controller.parseBatch(
      { text: 'spent 350 on food today, spent 500 on petrol today' },
      conversationId,
      requestId,
    );

    expect(intent.analyze).toHaveBeenCalledWith(
      'spent 350 on food today, spent 500 on petrol today',
      expect.any(Date),
      undefined,
      { conversationId, requestId },
    );
    expect(result).toMatchObject({ conversationId, requestId });
  });

  it('returns a draft without calling expense persistence' /** Checks that returns a draft without calling expense persistence. */, () => {
    const result = controller.parse({
      text: 'Lunch at Meghana ₹1200 split by 3',
    });

    expect(service.parse).toHaveBeenCalledWith(
      'Lunch at Meghana ₹1200 split by 3',
      expect.any(Date),
      undefined,
    );
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.draft.amount).toBe(400);
    expect(result.conversationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('protects raw financial text with the JWT guard' /** Checks that protects raw financial text with the JWT guard. */, () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ParserController,
    ) as unknown;
    expect(Array.isArray(guards) ? guards : []).toContain(JwtAuthGuard);
  });
});
