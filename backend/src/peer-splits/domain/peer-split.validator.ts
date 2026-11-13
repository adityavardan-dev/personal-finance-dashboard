import { isMinorUnitAmount } from './money';
import type {
  AllocationRule,
  PeerSplitInput,
  PeerSplitValidationIssue,
} from './peer-split.types';

export class PeerSplitValidator {
  validate(input: PeerSplitInput): PeerSplitValidationIssue[] {
    const issues: PeerSplitValidationIssue[] = [];

    if (
      !isMinorUnitAmount(input.totalAmountMinor) ||
      input.totalAmountMinor === 0
    ) {
      issues.push({
        code: 'INVALID_TOTAL',
        message: 'The expense total must be a positive integer in minor units.',
      });
    }

    const participantIds = new Set<string>();
    if (input.participants.length < 2) {
      issues.push({
        code: 'TOO_FEW_PARTICIPANTS',
        message: 'A peer expense requires at least two participants.',
      });
    }

    for (const participant of input.participants) {
      if (!participant.id.trim() || !participant.displayName.trim()) {
        issues.push({
          code: 'INVALID_PARTICIPANT',
          message:
            'Every participant requires a non-empty ID and display name.',
          participantId: participant.id || undefined,
        });
      }
      if (participantIds.has(participant.id)) {
        issues.push({
          code: 'DUPLICATE_PARTICIPANT',
          message: `Participant ${participant.id} appears more than once.`,
          participantId: participant.id,
        });
      }
      participantIds.add(participant.id);
    }

    this.validateContributions(input, participantIds, issues);
    this.validateAllocations(input, participantIds, issues);
    return issues;
  }

  private validateContributions(
    input: PeerSplitInput,
    participantIds: ReadonlySet<string>,
    issues: PeerSplitValidationIssue[],
  ): void {
    const contributors = new Set<string>();
    let contributionTotal = 0n;

    for (const contribution of input.contributions) {
      if (!participantIds.has(contribution.participantId)) {
        issues.push({
          code: 'INVALID_CONTRIBUTION',
          message: `Contribution references unknown participant ${contribution.participantId}.`,
          participantId: contribution.participantId,
        });
      }
      if (
        !isMinorUnitAmount(contribution.amountMinor) ||
        contribution.amountMinor === 0
      ) {
        issues.push({
          code: 'INVALID_CONTRIBUTION',
          message: `Contribution for ${contribution.participantId} must be a positive integer in minor units.`,
          participantId: contribution.participantId,
        });
      }
      if (contributors.has(contribution.participantId)) {
        issues.push({
          code: 'DUPLICATE_CONTRIBUTION',
          message: `Participant ${contribution.participantId} has more than one contribution.`,
          participantId: contribution.participantId,
        });
      }
      contributors.add(contribution.participantId);
      if (isMinorUnitAmount(contribution.amountMinor)) {
        contributionTotal += BigInt(contribution.amountMinor);
      }
    }

    if (
      isMinorUnitAmount(input.totalAmountMinor) &&
      contributionTotal !== BigInt(input.totalAmountMinor)
    ) {
      issues.push({
        code: 'CONTRIBUTIONS_DO_NOT_EQUAL_TOTAL',
        message: `Contributions total ${contributionTotal.toString()}, but the expense total is ${input.totalAmountMinor}.`,
      });
    }
  }

  private validateAllocations(
    input: PeerSplitInput,
    participantIds: ReadonlySet<string>,
    issues: PeerSplitValidationIssue[],
  ): void {
    const allocatedParticipants = new Set<string>();
    const fixedRules: Extract<AllocationRule, { kind: 'FIXED_AMOUNT' }>[] = [];
    const percentageRules: Extract<AllocationRule, { kind: 'PERCENTAGE' }>[] =
      [];
    let hasWeights = false;
    let hasEqualRemainder = false;
    let equalRemainderRuleCount = 0;

    for (const rule of input.allocationRules) {
      if (rule.kind === 'EQUAL_REMAINDER') {
        hasEqualRemainder = true;
        equalRemainderRuleCount += 1;
        if (rule.participantIds.length === 0) {
          issues.push({
            code: 'INVALID_ALLOCATION',
            message:
              'An equal-remainder rule requires at least one participant.',
          });
        }
        for (const participantId of rule.participantIds) {
          this.registerAllocationParticipant(
            participantId,
            participantIds,
            allocatedParticipants,
            issues,
          );
        }
        continue;
      }

      this.registerAllocationParticipant(
        rule.participantId,
        participantIds,
        allocatedParticipants,
        issues,
      );

      if (rule.kind === 'FIXED_AMOUNT') {
        fixedRules.push(rule);
        if (!isMinorUnitAmount(rule.amountMinor) || rule.amountMinor === 0) {
          issues.push({
            code: 'INVALID_ALLOCATION',
            message: `Fixed allocation for ${rule.participantId} must be a positive integer in minor units.`,
            participantId: rule.participantId,
          });
        }
      } else if (rule.kind === 'PERCENTAGE') {
        percentageRules.push(rule);
        if (
          !Number.isSafeInteger(rule.basisPoints) ||
          rule.basisPoints <= 0 ||
          rule.basisPoints > 10_000
        ) {
          issues.push({
            code: 'INVALID_ALLOCATION',
            message: `Percentage allocation for ${rule.participantId} must be between 1 and 10000 basis points.`,
            participantId: rule.participantId,
          });
        }
      } else {
        hasWeights = true;
        if (!Number.isSafeInteger(rule.weight) || rule.weight <= 0) {
          issues.push({
            code: 'INVALID_ALLOCATION',
            message: `Weight for ${rule.participantId} must be a positive integer.`,
            participantId: rule.participantId,
          });
        }
      }
    }

    for (const participantId of participantIds) {
      if (!allocatedParticipants.has(participantId)) {
        issues.push({
          code: 'MISSING_ALLOCATION',
          message: `Participant ${participantId} does not have an allocation rule.`,
          participantId,
        });
      }
    }

    if (hasWeights && hasEqualRemainder) {
      issues.push({
        code: 'MIXED_REMAINDER_RULES',
        message:
          'Weighted and equal-remainder rules cannot be mixed in one expense.',
      });
    }

    if (equalRemainderRuleCount > 1) {
      issues.push({
        code: 'MULTIPLE_EQUAL_REMAINDER_RULES',
        message: 'Only one equal-remainder rule is allowed per expense.',
      });
    }

    const percentageBasisPoints = percentageRules.reduce(
      (total, rule) => total + rule.basisPoints,
      0,
    );
    if (percentageBasisPoints > 10_000) {
      issues.push({
        code: 'PERCENTAGES_EXCEED_TOTAL',
        message: 'Percentage allocations exceed 100%.',
      });
    }

    const allocationNumbersAreValid =
      isMinorUnitAmount(input.totalAmountMinor) &&
      fixedRules.every(
        (rule) => isMinorUnitAmount(rule.amountMinor) && rule.amountMinor > 0,
      ) &&
      percentageRules.every(
        (rule) =>
          Number.isSafeInteger(rule.basisPoints) &&
          rule.basisPoints > 0 &&
          rule.basisPoints <= 10_000,
      );
    if (allocationNumbersAreValid) {
      const fixedTotal = fixedRules.reduce(
        (total, rule) => total + BigInt(rule.amountMinor),
        0n,
      );
      const expectedNumerator = BigInt(input.totalAmountMinor) * 10_000n;
      const claimedNumerator =
        fixedTotal * 10_000n +
        BigInt(input.totalAmountMinor) * BigInt(percentageBasisPoints);
      if (claimedNumerator > expectedNumerator) {
        issues.push({
          code: 'FIXED_AND_PERCENTAGES_EXCEED_TOTAL',
          message: 'Fixed and percentage allocations exceed the expense total.',
        });
      }

      const hasRemainderRule = hasWeights || hasEqualRemainder;
      if (!hasRemainderRule && claimedNumerator !== expectedNumerator) {
        issues.push({
          code: 'MISSING_REMAINDER_RULE',
          message:
            'Allocations do not cover the total and no remainder rule was provided.',
        });
      }
    }
  }

  private registerAllocationParticipant(
    participantId: string,
    participantIds: ReadonlySet<string>,
    allocatedParticipants: Set<string>,
    issues: PeerSplitValidationIssue[],
  ): void {
    if (!participantIds.has(participantId)) {
      issues.push({
        code: 'INVALID_ALLOCATION',
        message: `Allocation references unknown participant ${participantId}.`,
        participantId,
      });
    }
    if (allocatedParticipants.has(participantId)) {
      issues.push({
        code: 'DUPLICATE_ALLOCATION',
        message: `Participant ${participantId} appears in more than one allocation rule.`,
        participantId,
      });
    }
    allocatedParticipants.add(participantId);
  }
}
