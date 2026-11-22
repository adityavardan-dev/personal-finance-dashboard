/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RequestTrace } from '../request-trace';
import type { ParseBatchResultDto } from './dto/parse-batch-result.dto';
import { INTENT_SEGMENTER, type IntentSegmenter } from './intent-segmenter';
import { ParserService } from './parser.service';

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);
  /** Creates this class and receives its required dependencies. */
  constructor(
    private readonly parser: ParserService,
    @Inject(INTENT_SEGMENTER) private readonly model: IntentSegmenter,
  ) {}

  /** Handles analyze. */
  async analyze(
    text: string,
    referenceDate = new Date(),
    timeZone?: string,
    trace?: RequestTrace,
  ): Promise<ParseBatchResultDto> {
    const local = this.parser.parseBatch(text, referenceDate, timeZone);
    const localResult: ParseBatchResultDto = {
      ...local,
      modelAttempted: false,
      modelAccepted: false,
      interpretationSource: 'LOCAL',
    };
    if (local.intent === 'GREETING') {
      this.logDecision(trace, localResult, 'GREETING');
      return localResult;
    }
    if (!this.needsSegmentation(local, text)) {
      this.logDecision(trace, localResult, 'LOCAL_SUFFICIENT');
      return localResult;
    }
    if (!this.model.isConfigured()) {
      this.logDecision(trace, localResult, 'MODEL_NOT_CONFIGURED');
      return localResult;
    }

    const segments = await this.model.segment(text);
    const attemptedResult: ParseBatchResultDto = {
      ...localResult,
      modelAttempted: true,
    };
    const alignedSegments = segments
      ? this.alignWithOriginalText(text, segments)
      : null;
    if (!alignedSegments) {
      this.logDecision(trace, attemptedResult, 'MODEL_SEGMENTS_INVALID');
      return attemptedResult;
    }

    const transactionSegments =
      this.combineTransactionFragments(alignedSegments);
    const parserInput = transactionSegments
      .map((segment) => this.ensureTransactionVerb(segment))
      .join('; ');

    const candidate = this.parser.parseBatch(
      parserInput,
      referenceDate,
      timeZone,
    );
    if (
      candidate.drafts.length <= local.drafts.length ||
      candidate.drafts.some((draft) => draft.draft.amount === null)
    ) {
      this.logDecision(trace, attemptedResult, 'MODEL_CANDIDATE_REJECTED');
      return attemptedResult;
    }
    const drafts = candidate.drafts.map((result, index) => ({
      ...result,
      draft: {
        ...result.draft,
        notes: transactionSegments[index] ?? result.draft.notes,
      },
    }));
    const result: ParseBatchResultDto = {
      ...candidate,
      drafts,
      modelAttempted: true,
      modelAccepted: true,
      interpretationSource: 'MODEL',
    };
    this.logDecision(trace, result, 'MODEL_ACCEPTED');
    return result;
  }

  /** Handles log decision. */
  private logDecision(
    trace: RequestTrace | undefined,
    result: ParseBatchResultDto,
    reason: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        ...trace,
        route: 'parse-batch',
        reason,
        status: result.status,
        draftCount: result.drafts.length,
        modelAttempted: result.modelAttempted,
        modelAccepted: result.modelAccepted,
      }),
    );
  }

  /** Checks whether needs segmentation. */
  private needsSegmentation(
    result: ParseBatchResultDto,
    text: string,
  ): boolean {
    if (result.drafts.length !== 1 || result.status === 'READY') return false;
    const amountLike = text.match(
      /(?:₹|\$|€|\b(?:rs\.?|inr|usd|eur)\b)?\s*\d[\d,]*(?:\.\d{1,2})?/gi,
    );
    return (amountLike?.length ?? 0) > 1;
  }

  /** Handles align with original text. */
  private alignWithOriginalText(
    text: string,
    segments: string[],
  ): string[] | null {
    let position = 0;
    const aligned: string[] = [];
    const searchableText = text.toLocaleLowerCase();
    for (const segment of segments) {
      const index = searchableText.indexOf(
        segment.toLocaleLowerCase(),
        position,
      );
      if (index < 0 || !this.onlySeparators(text.slice(position, index)))
        return null;
      aligned.push(text.slice(index, index + segment.length));
      position = index + segment.length;
    }
    return this.onlySeparators(text.slice(position)) ? aligned : null;
  }

  /** Handles combine transaction fragments. */
  private combineTransactionFragments(segments: string[]): string[] {
    const transactions: string[] = [];
    let pendingDescriptions: string[] = [];

    for (const segment of segments) {
      if (this.containsAmount(segment)) {
        transactions.push([...pendingDescriptions, segment].join(' '));
        pendingDescriptions = [];
      } else if (this.isTrailingContext(segment) && transactions.length) {
        transactions[transactions.length - 1] += ` ${segment}`;
      } else {
        pendingDescriptions.push(segment);
      }
    }

    if (pendingDescriptions.length && transactions.length) {
      transactions[transactions.length - 1] +=
        ` ${pendingDescriptions.join(' ')}`;
    }
    return transactions.length ? transactions : segments;
  }

  /** Provides contains amount. */
  private containsAmount(text: string): boolean {
    return /(?:₹|\$|€|\b(?:rs\.?|inr|usd|eur)\b)?\s*\d[\d,]*(?:\.\d{1,2})?/i.test(
      text,
    );
  }

  /** Checks whether is trailing context. */
  private isTrailingContext(text: string): boolean {
    return /^(?:today|yesterday|tomorrow|last\s+(?:night|week|month)|\d{4}-\d{2}-\d{2})$/i.test(
      text.trim(),
    );
  }

  /** Handles ensure transaction verb. */
  private ensureTransactionVerb(text: string): string {
    if (
      /\b(?:spent|paid|bought|purchased|received|earned|credited|refunded)\b/i.test(
        text,
      )
    ) {
      return text;
    }
    if (
      /\b(?:salary|income|refund|freelance|reimbursement|dividend)\b/i.test(
        text,
      )
    ) {
      return `received ${text}`;
    }
    return `spent ${text}`;
  }

  /** Provides only separators. */
  private onlySeparators(text: string): boolean {
    return /^[\s,;.!?]*(?:(?:and|then)[\s,;.!?]*)*$/i.test(text);
  }
}
