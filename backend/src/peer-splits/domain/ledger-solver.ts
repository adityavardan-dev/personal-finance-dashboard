import {
  PeerSplitInvariantError,
  PeerSplitValidationError,
} from './peer-split.errors';
import { allocateRationalShares, sumMinorUnits } from './money';
import type {
  AllocationRule,
  AllocationSourceRule,
  PeerAllocation,
  PeerBalance,
  PeerObligation,
  PeerSplitInput,
  PeerSplitResult,
} from './peer-split.types';
import { PeerSplitValidator } from './peer-split.validator';

interface AllocationEntry {
  amountMinor: number;
  sourceRule: AllocationSourceRule;
}

export class LedgerSolver {
  constructor(private readonly validator = new PeerSplitValidator()) {}

  solve(input: PeerSplitInput): PeerSplitResult {
    const issues = this.validator.validate(input);
    if (issues.length > 0) throw new PeerSplitValidationError(issues);

    const tieBreakOrder = this.createTieBreakOrder(input);
    const participantOrder = new Map(
      input.participants.map((participant, index) => [participant.id, index]),
    );
    const allocationByParticipant = this.calculateAllocations(
      input,
      tieBreakOrder,
    );
    const allocations = input.participants.map<PeerAllocation>(
      (participant) => {
        const allocation = allocationByParticipant.get(participant.id);
        if (!allocation) {
          throw new PeerSplitInvariantError(
            `No calculated allocation exists for ${participant.id}.`,
          );
        }
        return {
          participantId: participant.id,
          amountOwedMinor: allocation.amountMinor,
          sourceRule: allocation.sourceRule,
        };
      },
    );

    const contributionByParticipant = new Map(
      input.contributions.map((contribution) => [
        contribution.participantId,
        contribution.amountMinor,
      ]),
    );
    const balances = allocations.map<PeerBalance>((allocation) => {
      const amountPaidMinor =
        contributionByParticipant.get(allocation.participantId) ?? 0;
      return {
        participantId: allocation.participantId,
        amountPaidMinor,
        amountOwedMinor: allocation.amountOwedMinor,
        netBalanceMinor: amountPaidMinor - allocation.amountOwedMinor,
      };
    });
    const obligations = this.createObligations(balances, participantOrder);

    this.assertInvariants(input, allocations, balances, obligations);
    return {
      totalAmountMinor: input.totalAmountMinor,
      currency: input.currency,
      allocations,
      balances,
      obligations,
    };
  }

  private calculateAllocations(
    input: PeerSplitInput,
    tieBreakOrder: ReadonlyMap<string, number>,
  ): Map<string, AllocationEntry> {
    const allocations = new Map<string, AllocationEntry>();
    const fixedRules = input.allocationRules.filter(
      (rule): rule is Extract<AllocationRule, { kind: 'FIXED_AMOUNT' }> =>
        rule.kind === 'FIXED_AMOUNT',
    );
    const percentageRules = input.allocationRules.filter(
      (rule): rule is Extract<AllocationRule, { kind: 'PERCENTAGE' }> =>
        rule.kind === 'PERCENTAGE',
    );
    const weightRules = input.allocationRules.filter(
      (rule): rule is Extract<AllocationRule, { kind: 'WEIGHT' }> =>
        rule.kind === 'WEIGHT',
    );
    const equalRule = input.allocationRules.find(
      (rule): rule is Extract<AllocationRule, { kind: 'EQUAL_REMAINDER' }> =>
        rule.kind === 'EQUAL_REMAINDER',
    );

    for (const rule of fixedRules) {
      allocations.set(rule.participantId, {
        amountMinor: rule.amountMinor,
        sourceRule: rule.kind,
      });
    }

    const fixedTotal = sumMinorUnits(
      fixedRules.map((rule) => rule.amountMinor),
    );
    const percentageBasisPoints = percentageRules.reduce(
      (total, rule) => total + rule.basisPoints,
      0,
    );
    const exactPercentagePoolNumerator =
      BigInt(input.totalAmountMinor) * BigInt(percentageBasisPoints);
    const percentagePoolTarget = Number(exactPercentagePoolNumerator / 10_000n);
    const percentageAllocations = allocateRationalShares(
      percentagePoolTarget,
      percentageRules.map((rule) => ({
        participantId: rule.participantId,
        numerator: BigInt(input.totalAmountMinor) * BigInt(rule.basisPoints),
        denominator: 10_000n,
      })),
      tieBreakOrder,
    );
    for (const rule of percentageRules) {
      allocations.set(rule.participantId, {
        amountMinor: percentageAllocations.get(rule.participantId) ?? 0,
        sourceRule: rule.kind,
      });
    }

    const remainderAmount =
      input.totalAmountMinor - fixedTotal - percentagePoolTarget;
    if (weightRules.length > 0) {
      const totalWeight = weightRules.reduce(
        (total, rule) => total + rule.weight,
        0,
      );
      const weightedAllocations = allocateRationalShares(
        remainderAmount,
        weightRules.map((rule) => ({
          participantId: rule.participantId,
          numerator: BigInt(remainderAmount) * BigInt(rule.weight),
          denominator: BigInt(totalWeight),
        })),
        tieBreakOrder,
      );
      for (const rule of weightRules) {
        allocations.set(rule.participantId, {
          amountMinor: weightedAllocations.get(rule.participantId) ?? 0,
          sourceRule: rule.kind,
        });
      }
    } else if (equalRule) {
      const denominator = BigInt(equalRule.participantIds.length);
      const equalAllocations = allocateRationalShares(
        remainderAmount,
        equalRule.participantIds.map((participantId) => ({
          participantId,
          numerator: BigInt(remainderAmount),
          denominator,
        })),
        tieBreakOrder,
      );
      for (const participantId of equalRule.participantIds) {
        allocations.set(participantId, {
          amountMinor: equalAllocations.get(participantId) ?? 0,
          sourceRule: equalRule.kind,
        });
      }
    }

    return allocations;
  }

  private createTieBreakOrder(input: PeerSplitInput): Map<string, number> {
    const payers = new Set(
      input.contributions.map((item) => item.participantId),
    );
    const orderedIds = [
      ...input.participants.filter((participant) => payers.has(participant.id)),
      ...input.participants.filter(
        (participant) => !payers.has(participant.id),
      ),
    ].map((participant) => participant.id);
    return new Map(
      orderedIds.map((participantId, index) => [participantId, index]),
    );
  }

  private createObligations(
    balances: PeerBalance[],
    tieBreakOrder: ReadonlyMap<string, number>,
  ): PeerObligation[] {
    const byStableOrder = (left: PeerBalance, right: PeerBalance): number =>
      (tieBreakOrder.get(left.participantId) ?? Number.MAX_SAFE_INTEGER) -
      (tieBreakOrder.get(right.participantId) ?? Number.MAX_SAFE_INTEGER);
    const creditors = balances
      .filter((balance) => balance.netBalanceMinor > 0)
      .sort(byStableOrder)
      .map((balance) => ({ ...balance, remaining: balance.netBalanceMinor }));
    const debtors = balances
      .filter((balance) => balance.netBalanceMinor < 0)
      .sort(byStableOrder)
      .map((balance) => ({ ...balance, remaining: -balance.netBalanceMinor }));
    const obligations: PeerObligation[] = [];
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      const amountMinor = Math.min(creditor.remaining, debtor.remaining);
      obligations.push({
        fromParticipantId: debtor.participantId,
        toParticipantId: creditor.participantId,
        amountMinor,
      });
      creditor.remaining -= amountMinor;
      debtor.remaining -= amountMinor;
      if (creditor.remaining === 0) creditorIndex += 1;
      if (debtor.remaining === 0) debtorIndex += 1;
    }

    if (
      creditors.some((creditor) => creditor.remaining !== 0) ||
      debtors.some((debtor) => debtor.remaining !== 0)
    ) {
      throw new PeerSplitInvariantError(
        'Obligations did not clear every balance.',
      );
    }
    return obligations;
  }

  private assertInvariants(
    input: PeerSplitInput,
    allocations: PeerAllocation[],
    balances: PeerBalance[],
    obligations: PeerObligation[],
  ): void {
    if (
      sumMinorUnits(input.contributions.map((item) => item.amountMinor)) !==
      input.totalAmountMinor
    ) {
      throw new PeerSplitInvariantError(
        'Contributions do not equal the expense total.',
      );
    }
    if (
      sumMinorUnits(allocations.map((item) => item.amountOwedMinor)) !==
      input.totalAmountMinor
    ) {
      throw new PeerSplitInvariantError(
        'Allocations do not equal the expense total.',
      );
    }
    if (
      balances.reduce(
        (total, balance) => total + balance.netBalanceMinor,
        0,
      ) !== 0
    ) {
      throw new PeerSplitInvariantError('Net balances do not sum to zero.');
    }

    const clearedBalances = new Map(
      balances.map((balance) => [
        balance.participantId,
        balance.netBalanceMinor,
      ]),
    );
    for (const obligation of obligations) {
      clearedBalances.set(
        obligation.fromParticipantId,
        (clearedBalances.get(obligation.fromParticipantId) ?? 0) +
          obligation.amountMinor,
      );
      clearedBalances.set(
        obligation.toParticipantId,
        (clearedBalances.get(obligation.toParticipantId) ?? 0) -
          obligation.amountMinor,
      );
    }
    if ([...clearedBalances.values()].some((balance) => balance !== 0)) {
      throw new PeerSplitInvariantError(
        'Obligations do not clear the calculated balances.',
      );
    }
  }
}
