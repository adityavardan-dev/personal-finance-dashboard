/**
 * Purpose: Defines and validates the data shape accepted or returned by this backend feature.
 */
import type { ParseResultDto, ParserStatus } from './parse-result.dto';

export interface ParseBatchResultDto {
  intent?: 'GREETING';
  conversationId?: string;
  requestId?: string;
  status: ParserStatus;
  drafts: ParseResultDto[];
  clarificationPrompt?: string;
  modelAttempted?: boolean;
  modelAccepted?: boolean;
  interpretationSource?: 'LOCAL' | 'MODEL';
}
