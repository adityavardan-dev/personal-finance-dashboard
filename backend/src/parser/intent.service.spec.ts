/**
 * Purpose: Tests the behavior of the related backend feature.
 */
import { IntentService } from './intent.service';
import { ParserService } from './parser.service';

describe('IntentService', () => {
  const parser = new ParserService();
  const referenceDate = new Date('2026-11-19T12:00:00Z');
  const text =
    'I spent ₹200 on breakfast ₹50 on bus ₹700 on groceries ₹100 on tea ₹300 on petrol today';
  const segments = [
    'I spent ₹200 on breakfast',
    '₹50 on bus',
    '₹700 on groceries',
    '₹100 on tea',
    '₹300 on petrol today',
  ];

  it('turns five unclear expenses into five reviewable drafts' /** Checks that turns five unclear expenses into five reviewable drafts. */, async () => {
    const model = {
      isConfigured: jest.fn().mockReturnValue(true),
      segment: jest.fn().mockResolvedValue(segments),
    };
    const service = new IntentService(parser, model);

    const result = await service.analyze(text, referenceDate, 'Asia/Kolkata');

    expect(model.segment).toHaveBeenCalledWith(text);
    expect(result.drafts).toHaveLength(5);
    expect(result.modelAttempted).toBe(true);
    expect(result.modelAccepted).toBe(true);
    expect(result.interpretationSource).toBe('MODEL');
    expect(result.drafts.map((draft) => draft.draft.amount)).toEqual([
      200, 50, 700, 100, 300,
    ]);
  });

  it('does not send clearly separated expenses to the model' /** Checks that does not send clearly separated expenses to the model. */, async () => {
    const model = { isConfigured: jest.fn(), segment: jest.fn() };
    const service = new IntentService(parser, model);

    const result = await service.analyze(
      'spent ₹200 on breakfast today; spent ₹50 on bus today',
      referenceDate,
      'Asia/Kolkata',
    );

    expect(result.drafts).toHaveLength(2);
    expect(model.segment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      modelAttempted: false,
      modelAccepted: false,
      interpretationSource: 'LOCAL',
    });
  });

  it('rejects model output that drops part of the original message' /** Checks that rejects model output that drops part of the original message. */, async () => {
    const model = {
      isConfigured: jest.fn().mockReturnValue(true),
      segment: jest.fn().mockResolvedValue(segments.slice(0, 4)),
    };
    const service = new IntentService(parser, model);
    const original = parser.parseBatch(text, referenceDate, 'Asia/Kolkata');

    const result = await service.analyze(text, referenceDate, 'Asia/Kolkata');

    expect(result).toEqual({
      ...original,
      modelAttempted: true,
      modelAccepted: false,
      interpretationSource: 'LOCAL',
    });
  });

  it('repairs exact model fragments while preserving the original text' /** Checks that repairs exact model fragments while preserving the original text. */, async () => {
    const fragmentedText =
      'Coffee ₹180 metro ₹70 lunch ₹350 movie ₹500 petrol ₹1000 today';
    const model = {
      isConfigured: jest.fn().mockReturnValue(true),
      segment: jest
        .fn()
        .mockResolvedValue([
          'Coffee',
          '₹180',
          'metro',
          '₹70',
          'Lunch',
          '₹350',
          'Movie',
          '₹500',
          'Petrol',
          '₹1000',
          'today',
        ]),
    };
    const service = new IntentService(parser, model);

    const result = await service.analyze(
      fragmentedText,
      referenceDate,
      'Asia/Kolkata',
    );

    expect(result).toMatchObject({
      modelAttempted: true,
      modelAccepted: true,
      interpretationSource: 'MODEL',
    });
    expect(result.drafts.map((draft) => draft.draft.amount)).toEqual([
      180, 70, 350, 500, 1000,
    ]);
  });

  it('does not mark the model attempted when hosted AI is not configured' /** Checks that does not mark the model attempted when hosted AI is not configured. */, async () => {
    const model = {
      isConfigured: jest.fn().mockReturnValue(false),
      segment: jest.fn(),
    };
    const service = new IntentService(parser, model);

    const result = await service.analyze(text, referenceDate, 'Asia/Kolkata');

    expect(model.segment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      modelAttempted: false,
      modelAccepted: false,
      interpretationSource: 'LOCAL',
    });
  });
});
