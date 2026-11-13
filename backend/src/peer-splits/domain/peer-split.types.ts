import type { CurrencyCode } from '../../budgets/currency-code';

export interface PeerParticipant {
  id: string;
  displayName: string;
}

export interface PaymentContribution {
  participantId: string;
  amountMinor: number;
}

export type AllocationRule =
  | {
      kind: 'FIXED_AMOUNT';
      participantId: string;
      amountMinor: number;
    }
  | {
      kind: 'PERCENTAGE';
      participantId: string;
      basisPoints: number;
    }
  | {
      kind: 'WEIGHT';
      participantId: string;
      weight: number;
    }
  | {
      kind: 'EQUAL_REMAINDER';
      participantIds: string[];
    };

export interface PeerSplitInput {
  totalAmountMinor: number;
  currency: CurrencyCode;
  participants: PeerParticipant[];
  contributions: PaymentContribution[];
  allocationRules: AllocationRule[];
}

export type AllocationSourceRule = AllocationRule['kind'];

export interface PeerAllocation {
  participantId: string;
  amountOwedMinor: number;
  sourceRule: AllocationSourceRule;
}

export interface PeerBalance {
  participantId: string;
  amountPaidMinor: number;
  amountOwedMinor: number;
  netBalanceMinor: number;
}

export interface PeerObligation {
  fromParticipantId: string;
  toParticipantId: string;
  amountMinor: number;
}

export interface PeerSplitResult {
  totalAmountMinor: number;
  currency: CurrencyCode;
  allocations: PeerAllocation[];
  balances: PeerBalance[];
  obligations: PeerObligation[];
}

export type PeerSplitValidationCode =
  | 'INVALID_TOTAL'
  | 'TOO_FEW_PARTICIPANTS'
  | 'DUPLICATE_PARTICIPANT'
  | 'INVALID_PARTICIPANT'
  | 'INVALID_CONTRIBUTION'
  | 'DUPLICATE_CONTRIBUTION'
  | 'CONTRIBUTIONS_DO_NOT_EQUAL_TOTAL'
  | 'INVALID_ALLOCATION'
  | 'DUPLICATE_ALLOCATION'
  | 'MISSING_ALLOCATION'
  | 'PERCENTAGES_EXCEED_TOTAL'
  | 'FIXED_AND_PERCENTAGES_EXCEED_TOTAL'
  | 'MIXED_REMAINDER_RULES'
  | 'MULTIPLE_EQUAL_REMAINDER_RULES'
  | 'MISSING_REMAINDER_RULE';

export interface PeerSplitValidationIssue {
  code: PeerSplitValidationCode;
  message: string;
  participantId?: string;
}
