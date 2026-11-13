import { BadRequestException, Injectable } from '@nestjs/common';
import { CurrencyCode } from '../budgets/currency-code';
import { LedgerSolver } from './domain/ledger-solver';
import { PeerSplitValidationError } from './domain/peer-split.errors';
import type { AllocationRule, PeerSplitInput } from './domain/peer-split.types';

@Injectable()
export class PeerSplitsService {
  private readonly solver = new LedgerSolver();

  preview(value: unknown) {
    const input = this.parseInput(value);
    try {
      return this.solver.solve(input);
    } catch (error) {
      if (error instanceof PeerSplitValidationError) {
        throw new BadRequestException({
          message: 'Check the split details.',
          issues: error.issues,
        });
      }
      throw error;
    }
  }

  private parseInput(value: unknown): PeerSplitInput {
    if (!this.record(value))
      throw new BadRequestException('Invalid split draft.');
    const participants = value['participants'];
    const contributions = value['contributions'];
    const rules = value['allocationRules'];
    if (
      !Array.isArray(participants) ||
      !Array.isArray(contributions) ||
      !Array.isArray(rules) ||
      participants.length > 100 ||
      contributions.length > 100 ||
      rules.length > 100
    ) {
      throw new BadRequestException('Invalid split draft.');
    }
    if (
      !Object.values(CurrencyCode).includes(value['currency'] as CurrencyCode)
    ) {
      throw new BadRequestException('Unsupported currency.');
    }
    const parsedParticipants = participants.map((item: unknown) => {
      if (
        !this.record(item) ||
        typeof item['id'] !== 'string' ||
        typeof item['displayName'] !== 'string' ||
        item['id'].length > 80 ||
        item['displayName'].length > 80
      )
        throw new BadRequestException('Invalid participant.');
      return { id: item['id'], displayName: item['displayName'] };
    });
    const parsedContributions = contributions.map((item: unknown) => {
      if (
        !this.record(item) ||
        typeof item['participantId'] !== 'string' ||
        typeof item['amountMinor'] !== 'number'
      )
        throw new BadRequestException('Invalid contribution.');
      return {
        participantId: item['participantId'],
        amountMinor: item['amountMinor'],
      };
    });
    const parsedRules = rules.map((item: unknown): AllocationRule => {
      if (!this.record(item) || typeof item['kind'] !== 'string')
        throw new BadRequestException('Invalid allocation rule.');
      if (
        item['kind'] === 'EQUAL_REMAINDER' &&
        Array.isArray(item['participantIds']) &&
        item['participantIds'].every((id: unknown) => typeof id === 'string')
      )
        return {
          kind: 'EQUAL_REMAINDER',
          participantIds: item['participantIds'],
        };
      if (typeof item['participantId'] !== 'string')
        throw new BadRequestException('Invalid allocation rule.');
      if (
        item['kind'] === 'FIXED_AMOUNT' &&
        typeof item['amountMinor'] === 'number'
      )
        return {
          kind: 'FIXED_AMOUNT',
          participantId: item['participantId'],
          amountMinor: item['amountMinor'],
        };
      if (
        item['kind'] === 'PERCENTAGE' &&
        typeof item['basisPoints'] === 'number'
      )
        return {
          kind: 'PERCENTAGE',
          participantId: item['participantId'],
          basisPoints: item['basisPoints'],
        };
      if (item['kind'] === 'WEIGHT' && typeof item['weight'] === 'number')
        return {
          kind: 'WEIGHT',
          participantId: item['participantId'],
          weight: item['weight'],
        };
      throw new BadRequestException('Invalid allocation rule.');
    });
    if (typeof value['totalAmountMinor'] !== 'number')
      throw new BadRequestException('Invalid total.');
    return {
      totalAmountMinor: value['totalAmountMinor'],
      currency: value['currency'] as CurrencyCode,
      participants: parsedParticipants,
      contributions: parsedContributions,
      allocationRules: parsedRules,
    };
  }

  private record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
