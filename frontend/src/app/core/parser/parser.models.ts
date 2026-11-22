import { CurrencyCode } from '../budget/budget.models';

export type ParserStatus = 'READY' | 'NEEDS_CLARIFICATION';
export type ParserMissingField = 'date' | 'amount' | 'category' | 'split';
export type ParserCategory =
  | 'Food & Dining'
  | 'Transportation'
  | 'Shopping'
  | 'Entertainment'
  | 'Bills & Utilities'
  | 'Health & Personal Care'
  | 'Income'
  | 'Other';

export interface ParseResult {
  conversationId?: string;
  requestId?: string;
  status: ParserStatus;
  draft: {
    amount: number | null;
    currency: CurrencyCode | null;
    originalAmount?: number;
    splitFactor?: number;
    category: ParserCategory | null;
    merchant: string | null;
    date: string | null;
    notes: string;
  };
  missingFields: ParserMissingField[];
  clarificationPrompt?: string;
}

export interface ParseRequest {
  text: string;
  timeZone: string;
  referenceTimestamp: string;
}

export interface ParseBatchResult {
  intent?: 'GREETING';
  conversationId?: string;
  requestId?: string;
  status: ParserStatus;
  drafts: ParseResult[];
  clarificationPrompt?: string;
  modelAttempted?: boolean;
  modelAccepted?: boolean;
  interpretationSource?: 'LOCAL' | 'MODEL';
}

export interface SplitIntentResult {
  drafts: Array<{
    ordinal: number;
    amountMinor: number;
    peopleCount: number;
    currency: 'INR' | 'USD' | 'EUR';
    date: string | null;
    names?: string[];
    paidBy?: string;
    allocationKind?: 'EQUAL' | 'FULL_TO_OTHER';
    beneficiary?: string;
  }>;
  clarificationPrompt?: string;
  modelAttempted: boolean;
  modelAccepted: boolean;
  interpretationSource: 'LOCAL' | 'MODEL';
  conversationId: string;
  requestId: string;
}

export interface SplitFollowUpResult {
  updates: Array<{ ordinal: number; names?: string[]; paidBy?: string; amountMinor?: number; peopleCount?: number }>;
  clarificationPrompt?: string;
  modelAttempted: boolean;
  modelAccepted: boolean;
  interpretationSource: 'LOCAL' | 'MODEL';
  conversationId: string;
  requestId: string;
}

export interface PersonalFollowUpResult {
  updates: Array<{
    ordinal: number;
    delete?: true;
    amount?: number;
    date?: string;
    category?: ParserCategory;
    merchant?: string;
    splitResolution?: 'personal' | 'split';
    splitFactor?: number;
  }>;
  clarificationPrompt?: string;
  modelAttempted: boolean;
  modelAccepted: boolean;
  interpretationSource: 'LOCAL' | 'MODEL';
  conversationId: string;
  requestId: string;
}
