import { PersonalFollowUpService } from './personal-follow-up.service';
import type { CloudflarePersonalFollowUp } from './cloudflare-personal-follow-up';
import type { ParserService } from './parser.service';

const trace = { conversationId: '11111111-1111-4111-8111-111111111111', requestId: '22222222-2222-4222-8222-222222222222' };
const drafts = [
  { ordinal: 1, amount: 350, category: 'Food & Dining', merchant: 'Cafe', date: '2026-11-22', note: 'coffee', splitResolution: 'personal', splitFactor: null },
  { ordinal: 2, amount: 100, category: 'Transportation', merchant: 'Metro', date: '2026-11-22', note: 'ride', splitResolution: 'personal', splitFactor: null },
];

describe('PersonalFollowUpService', () => {
  const parser = { parse: jest.fn().mockReturnValue({ draft: { date: null, category: null } }) } as unknown as ParserService;

  it('accepts a grounded edit to a named existing draft', async () => {
    const model = { isConfigured: () => true, interpret: jest.fn().mockResolvedValue([{ ordinal: 1, amount: '420', date: null, category: null, merchant: 'New Cafe', splitResolution: null, splitFactor: null }]) };
    const service = new PersonalFollowUpService(parser, model as unknown as CloudflarePersonalFollowUp);
    const result = await service.analyze('Make the Cafe amount 420 at New Cafe', drafts, trace);
    expect(result).toMatchObject({ modelAttempted: true, modelAccepted: true, updates: [{ ordinal: 1, amount: 420, merchant: 'New Cafe' }] });
    expect(model.interpret).toHaveBeenCalledWith(
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
    const model = { isConfigured: () => true, interpret: jest.fn().mockResolvedValue([{ ordinal: 3, amount: '999', date: null, category: null, merchant: null, splitResolution: null, splitFactor: null }]) };
    const service = new PersonalFollowUpService(parser, model as unknown as CloudflarePersonalFollowUp);
    const result = await service.analyze('Make the Cafe amount 420', drafts, trace);
    expect(result).toMatchObject({ modelAttempted: true, modelAccepted: false, updates: [] });
  });

  it('accepts removal of the unique unsaved draft matching the stated amount', async () => {
    const current = [{ ...drafts[0], amount: 3000 }, drafts[1]];
    const model = { isConfigured: () => true, interpret: jest.fn().mockResolvedValue([{
      ordinal: 1, action: 'DELETE', amount: null, date: null,
      category: null, merchant: null, splitResolution: null, splitFactor: null,
    }]) };
    const service = new PersonalFollowUpService(parser, model as unknown as CloudflarePersonalFollowUp);

    const result = await service.analyze('delete the expense for 3000', current, trace);

    expect(result).toMatchObject({ modelAttempted: true, modelAccepted: true, updates: [{ ordinal: 1, delete: true }] });
  });

  it('rejects a deletion when the amount is wrong or matches multiple drafts', async () => {
    const model = { isConfigured: () => true, interpret: jest.fn().mockResolvedValue([{
      ordinal: 1, action: 'DELETE', amount: null, date: null,
      category: null, merchant: null, splitResolution: null, splitFactor: null,
    }]) };
    const service = new PersonalFollowUpService(parser, model as unknown as CloudflarePersonalFollowUp);

    expect((await service.analyze('delete the expense for 3000', drafts, trace)).updates).toEqual([]);
    expect((await service.analyze('delete the expense for 3000', [{ ...drafts[0], amount: 3000 }, { ...drafts[1], amount: 3000 }], trace)).updates).toEqual([]);
  });
});
