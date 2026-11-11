import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParserController } from './parser.controller';
import { ParserService } from './parser.service';

describe('ParserController', () => {
  let controller: ParserController;
  let service: jest.Mocked<Pick<ParserService, 'parse' | 'parseBatch'>>;

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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParserController],
      providers: [{ provide: ParserService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ParserController);
  });

  it('returns multiple drafts through the batch parser', () => {
    controller.parseBatch({
      text: 'spent 350 on food today, spent 500 on petrol today',
    });

    expect(service.parseBatch).toHaveBeenCalledWith(
      'spent 350 on food today, spent 500 on petrol today',
      expect.any(Date),
      undefined,
    );
  });

  it('returns a draft without calling expense persistence', () => {
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
  });

  it('protects raw financial text with the JWT guard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ParserController,
    ) as unknown;
    expect(Array.isArray(guards) ? guards : []).toContain(JwtAuthGuard);
  });
});
