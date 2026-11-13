import { describe, expect, it } from 'vitest';
import { parseSplitPrompt, toMinor } from './prompt-parser';

describe('peer split prompt draft', () => {
  it('extracts the bowling example and creates both named people', () => {
    const draft = parseSplitPrompt('Self paid INR 1800; Jaswanth owes INR 400; Self and Harsha split the remainder.');
    expect(draft?.input).toMatchObject({
      totalAmountMinor: 180000,
      participants: [{ id: 'self' }, { id: 'jaswanth' }, { id: 'harsha' }],
      allocationRules: [
        { kind: 'FIXED_AMOUNT', participantId: 'jaswanth', amountMinor: 40000 },
        { kind: 'EQUAL_REMAINDER', participantIds: ['self', 'harsha'] },
      ],
    });
  });

  it('extracts a named equal split', () => {
    const draft = parseSplitPrompt('I paid INR 1200 for lunch with Harsha and Jaswanth, split equally.');
    expect(draft?.input.participants.map((person) => person.displayName)).toEqual(['You', 'Harsha', 'Jaswanth']);
  });

  it('parses exact major currency amounts', () => {
    expect(toMinor('700.05')).toBe(70005);
    expect(toMinor('700.005')).toBeNull();
  });
});
