import type { CurrencyCode } from '../../budgets/currency-code';

export type ParserStatus = 'READY' | 'NEEDS_CLARIFICATION';

export type ParserMissingField = 'date' | 'amount' | 'category' | 'split';

export const PARSER_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health & Personal Care',
  'Income',
  'Other',
] as const;

export type ParserCategory = (typeof PARSER_CATEGORIES)[number];

export interface ParseResultDto {
  status: ParserStatus;
  draft: {
    amount: number | null;
    /** Detected from a supported symbol/code; null means use the user's selected app currency. */
    currency: CurrencyCode | null;
    /** The detected total before a split is applied. */
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
