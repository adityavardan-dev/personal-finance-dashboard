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
  status: ParserStatus;
  drafts: ParseResult[];
  clarificationPrompt?: string;
}
