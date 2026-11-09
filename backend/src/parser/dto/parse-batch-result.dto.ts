import type { ParseResultDto, ParserStatus } from './parse-result.dto';

export interface ParseBatchResultDto {
  status: ParserStatus;
  drafts: ParseResultDto[];
  clarificationPrompt?: string;
}
