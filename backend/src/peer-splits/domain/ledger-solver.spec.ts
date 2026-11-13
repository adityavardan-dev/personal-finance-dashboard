import { CurrencyCode } from '../../budgets/currency-code';
import { PeerSplitValidationError } from './peer-split.errors';
import type { PeerSplitInput } from './peer-split.types';
import { LedgerSolver } from './ledger-solver';

describe('LedgerSolver', () => {
  const solver = new LedgerSolver();

  it('solves a fixed share plus equal remainder and creates two-way obligations', () => {
    const result = solver.solve({
      totalAmountMinor: 180_000,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'self', displayName: 'Self' },
        { id: 'jaswanth', displayName: 'Jaswanth' },
        { id: 'harsha', displayName: 'Harsha' },
      ],
      contributions: [{ participantId: 'self', amountMinor: 180_000 }],
      allocationRules: [
        {
          kind: 'FIXED_AMOUNT',
          participantId: 'jaswanth',
          amountMinor: 40_000,
        },
        {
          kind: 'EQUAL_REMAINDER',
          participantIds: ['self', 'harsha'],
        },
      ],
    });

    expect(result.allocations).toEqual([
      {
        participantId: 'self',
        amountOwedMinor: 70_000,
        sourceRule: 'EQUAL_REMAINDER',
      },
      {
        participantId: 'jaswanth',
        amountOwedMinor: 40_000,
        sourceRule: 'FIXED_AMOUNT',
      },
      {
        participantId: 'harsha',
        amountOwedMinor: 70_000,
        sourceRule: 'EQUAL_REMAINDER',
      },
    ]);
    expect(result.balances).toEqual([
      {
        participantId: 'self',
        amountPaidMinor: 180_000,
        amountOwedMinor: 70_000,
        netBalanceMinor: 110_000,
      },
      {
        participantId: 'jaswanth',
        amountPaidMinor: 0,
        amountOwedMinor: 40_000,
        netBalanceMinor: -40_000,
      },
      {
        participantId: 'harsha',
        amountPaidMinor: 0,
        amountOwedMinor: 70_000,
        netBalanceMinor: -70_000,
      },
    ]);
    expect(result.obligations).toEqual([
      {
        fromParticipantId: 'jaswanth',
        toParticipantId: 'self',
        amountMinor: 40_000,
      },
      {
        fromParticipantId: 'harsha',
        toParticipantId: 'self',
        amountMinor: 70_000,
      },
    ]);
  });

  it('assigns equal-split remainder minor units to the payer first', () => {
    const result = solver.solve({
      totalAmountMinor: 100_000,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'self', displayName: 'Self' },
        { id: 'a', displayName: 'A' },
        { id: 'b', displayName: 'B' },
      ],
      contributions: [{ participantId: 'self', amountMinor: 100_000 }],
      allocationRules: [
        { kind: 'EQUAL_REMAINDER', participantIds: ['self', 'a', 'b'] },
      ],
    });

    expect(result.allocations.map((item) => item.amountOwedMinor)).toEqual([
      33_334, 33_333, 33_333,
    ]);
  });

  it('supports percentages plus an equal remainder', () => {
    const result = solver.solve({
      totalAmountMinor: 100_000,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'self', displayName: 'Self' },
        { id: 'a', displayName: 'A' },
        { id: 'b', displayName: 'B' },
      ],
      contributions: [{ participantId: 'self', amountMinor: 100_000 }],
      allocationRules: [
        { kind: 'PERCENTAGE', participantId: 'a', basisPoints: 2_000 },
        { kind: 'EQUAL_REMAINDER', participantIds: ['self', 'b'] },
      ],
    });

    expect(result.allocations.map((item) => item.amountOwedMinor)).toEqual([
      40_000, 20_000, 40_000,
    ]);
  });

  it('uses largest remainders for weighted allocations', () => {
    const result = solver.solve({
      totalAmountMinor: 1_001,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'a', displayName: 'A' },
        { id: 'b', displayName: 'B' },
        { id: 'c', displayName: 'C' },
      ],
      contributions: [{ participantId: 'a', amountMinor: 1_001 }],
      allocationRules: [
        { kind: 'WEIGHT', participantId: 'a', weight: 1 },
        { kind: 'WEIGHT', participantId: 'b', weight: 2 },
        { kind: 'FIXED_AMOUNT', participantId: 'c', amountMinor: 1 },
      ],
    });

    expect(result.allocations.map((item) => item.amountOwedMinor)).toEqual([
      333, 667, 1,
    ]);
  });

  it('supports multiple payers and clears one debtor across multiple creditors', () => {
    const result = solver.solve({
      totalAmountMinor: 100_000,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'a', displayName: 'A' },
        { id: 'b', displayName: 'B' },
        { id: 'c', displayName: 'C' },
      ],
      contributions: [
        { participantId: 'a', amountMinor: 60_000 },
        { participantId: 'b', amountMinor: 40_000 },
      ],
      allocationRules: [
        { kind: 'EQUAL_REMAINDER', participantIds: ['a', 'b', 'c'] },
      ],
    });

    expect(result.obligations).toEqual([
      { fromParticipantId: 'c', toParticipantId: 'a', amountMinor: 26_666 },
      { fromParticipantId: 'c', toParticipantId: 'b', amountMinor: 6_667 },
    ]);
  });

  it('rejects contribution totals that do not equal the expense total', () => {
    const input: PeerSplitInput = {
      totalAmountMinor: 100_000,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'self', displayName: 'Self' },
        { id: 'a', displayName: 'A' },
      ],
      contributions: [{ participantId: 'self', amountMinor: 90_000 }],
      allocationRules: [
        { kind: 'EQUAL_REMAINDER', participantIds: ['self', 'a'] },
      ],
    };

    expect(() => solver.solve(input)).toThrow(PeerSplitValidationError);
    try {
      solver.solve(input);
    } catch (error) {
      expect(error).toBeInstanceOf(PeerSplitValidationError);
      expect((error as PeerSplitValidationError).issues).toContainEqual(
        expect.objectContaining({ code: 'CONTRIBUTIONS_DO_NOT_EQUAL_TOTAL' }),
      );
    }
  });

  it('rejects duplicate and missing allocation rules', () => {
    const input: PeerSplitInput = {
      totalAmountMinor: 100_000,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'self', displayName: 'Self' },
        { id: 'a', displayName: 'A' },
        { id: 'b', displayName: 'B' },
      ],
      contributions: [{ participantId: 'self', amountMinor: 100_000 }],
      allocationRules: [
        { kind: 'FIXED_AMOUNT', participantId: 'a', amountMinor: 20_000 },
        { kind: 'EQUAL_REMAINDER', participantIds: ['self', 'a'] },
      ],
    };

    try {
      solver.solve(input);
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(PeerSplitValidationError);
      const codes = (error as PeerSplitValidationError).issues.map(
        (issue) => issue.code,
      );
      expect(codes).toEqual(
        expect.arrayContaining(['DUPLICATE_ALLOCATION', 'MISSING_ALLOCATION']),
      );
    }
  });

  it('rejects weighted and equal remainder rules in the same expense', () => {
    const input: PeerSplitInput = {
      totalAmountMinor: 100_000,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'self', displayName: 'Self' },
        { id: 'a', displayName: 'A' },
      ],
      contributions: [{ participantId: 'self', amountMinor: 100_000 }],
      allocationRules: [
        { kind: 'WEIGHT', participantId: 'self', weight: 1 },
        { kind: 'EQUAL_REMAINDER', participantIds: ['a'] },
      ],
    };

    try {
      solver.solve(input);
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(PeerSplitValidationError);
      expect((error as PeerSplitValidationError).issues).toContainEqual(
        expect.objectContaining({ code: 'MIXED_REMAINDER_RULES' }),
      );
    }
  });

  it('rejects more than one equal remainder rule', () => {
    const input: PeerSplitInput = {
      totalAmountMinor: 100_000,
      currency: CurrencyCode.INR,
      participants: [
        { id: 'self', displayName: 'Self' },
        { id: 'a', displayName: 'A' },
      ],
      contributions: [{ participantId: 'self', amountMinor: 100_000 }],
      allocationRules: [
        { kind: 'EQUAL_REMAINDER', participantIds: ['self'] },
        { kind: 'EQUAL_REMAINDER', participantIds: ['a'] },
      ],
    };

    try {
      solver.solve(input);
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(PeerSplitValidationError);
      expect((error as PeerSplitValidationError).issues).toContainEqual(
        expect.objectContaining({ code: 'MULTIPLE_EQUAL_REMAINDER_RULES' }),
      );
    }
  });

  it('preserves accounting invariants across generated equal splits', () => {
    for (
      let totalAmountMinor = 1;
      totalAmountMinor <= 250;
      totalAmountMinor += 1
    ) {
      for (
        let participantCount = 2;
        participantCount <= 8;
        participantCount += 1
      ) {
        const participants = Array.from(
          { length: participantCount },
          (_, index) => ({
            id: `p${index}`,
            displayName: `Participant ${index}`,
          }),
        );
        const result = solver.solve({
          totalAmountMinor,
          currency: CurrencyCode.INR,
          participants,
          contributions: [
            { participantId: 'p0', amountMinor: totalAmountMinor },
          ],
          allocationRules: [
            {
              kind: 'EQUAL_REMAINDER',
              participantIds: participants.map((participant) => participant.id),
            },
          ],
        });

        expect(
          result.allocations.reduce(
            (total, allocation) => total + allocation.amountOwedMinor,
            0,
          ),
        ).toBe(totalAmountMinor);
        expect(
          result.balances.reduce(
            (total, balance) => total + balance.netBalanceMinor,
            0,
          ),
        ).toBe(0);
        expect(
          result.obligations.reduce(
            (total, obligation) => total + obligation.amountMinor,
            0,
          ),
        ).toBe(totalAmountMinor - result.allocations[0].amountOwedMinor);
      }
    }
  });
});
