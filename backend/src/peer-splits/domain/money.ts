import { PeerSplitInvariantError } from './peer-split.errors';

export interface RationalShare {
  participantId: string;
  numerator: bigint;
  denominator: bigint;
}

export function isMinorUnitAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function allocateRationalShares(
  targetAmountMinor: number,
  shares: RationalShare[],
  tieBreakOrder: ReadonlyMap<string, number>,
): Map<string, number> {
  if (!isMinorUnitAmount(targetAmountMinor)) {
    throw new PeerSplitInvariantError(
      'Allocation target must be a non-negative safe integer.',
    );
  }

  if (shares.length === 0) {
    if (targetAmountMinor === 0) return new Map();
    throw new PeerSplitInvariantError(
      'A positive allocation target requires at least one share.',
    );
  }

  const allocations = new Map<string, number>();
  const ranked = shares.map((share) => {
    if (share.numerator < 0n || share.denominator <= 0n) {
      throw new PeerSplitInvariantError(
        'Rational shares must use non-negative numerators and positive denominators.',
      );
    }

    const floor = Number(share.numerator / share.denominator);
    if (!Number.isSafeInteger(floor)) {
      throw new PeerSplitInvariantError(
        'A rational share exceeded the safe integer range.',
      );
    }
    allocations.set(share.participantId, floor);
    return {
      participantId: share.participantId,
      remainder: share.numerator % share.denominator,
      denominator: share.denominator,
    };
  });

  let remaining = targetAmountMinor - sumMinorUnits(allocations.values());
  if (remaining < 0 || remaining > shares.length) {
    throw new PeerSplitInvariantError(
      'Rational shares do not reconcile with their allocation target.',
    );
  }

  ranked.sort((left, right) => {
    const remainderComparison =
      right.remainder * left.denominator - left.remainder * right.denominator;
    if (remainderComparison !== 0n) return remainderComparison > 0n ? 1 : -1;
    return (
      (tieBreakOrder.get(left.participantId) ?? Number.MAX_SAFE_INTEGER) -
      (tieBreakOrder.get(right.participantId) ?? Number.MAX_SAFE_INTEGER)
    );
  });

  for (let index = 0; index < remaining; index += 1) {
    const participantId = ranked[index].participantId;
    allocations.set(participantId, (allocations.get(participantId) ?? 0) + 1);
  }

  remaining = targetAmountMinor - sumMinorUnits(allocations.values());
  if (remaining !== 0) {
    throw new PeerSplitInvariantError(
      'Remainder distribution failed to reach the allocation target.',
    );
  }

  return allocations;
}

export function sumMinorUnits(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  if (!Number.isSafeInteger(total)) {
    throw new PeerSplitInvariantError(
      'Money total exceeded the safe integer range.',
    );
  }
  return total;
}
