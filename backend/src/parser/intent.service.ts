/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { RequestTrace } from '../request-trace';
import type { ParseBatchResultDto } from './dto/parse-batch-result.dto';
import { INTENT_SEGMENTER, type IntentSegmenter } from './intent-segmenter';
import { ParserService } from './parser.service';
import { PersonalFollowUpService } from './personal-follow-up.service';

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);
  /** Creates this class and receives its required dependencies. */
  constructor(
    private readonly parser: ParserService,
    @Inject(INTENT_SEGMENTER) private readonly model: IntentSegmenter,
    @Optional() private readonly personalFollowUp?: PersonalFollowUpService,
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
      if (local.drafts.length === 1 && local.status !== 'READY' && this.personalFollowUp) {
        const draft = local.drafts[0].draft;
        const completion = await this.personalFollowUp.analyze(text, [{
          ordinal: 1,
          amount: draft.amount,
          category: draft.category ?? '',
          merchant: draft.merchant ?? '',
          date: draft.date ?? '',
          note: draft.notes.slice(0, 500),
          splitResolution: local.drafts[0].missingFields.includes('split') ? '' : 'personal',
          splitFactor: draft.splitFactor ?? null,
        }], trace ?? { conversationId: '', requestId: '' }, referenceDate, timeZone, 'FILL_MISSING');
        if (completion.updates.length === 1) {
          const update = completion.updates[0];
          const filled = {
            ...draft,
            amount: draft.amount === null ? (update.amount ?? draft.amount) : draft.amount,
            date: draft.date === null ? (update.date ?? draft.date) : draft.date,
            category: draft.category === null ? (update.category ?? draft.category) : draft.category,
            merchant: draft.merchant === null ? (update.merchant ?? draft.merchant) : draft.merchant,
          };
          if (filled.amount === draft.amount && filled.date === draft.date && filled.category === draft.category && filled.merchant === draft.merchant) {
            localResult.modelAttempted = true;
            this.logDecision(trace, localResult, 'MODEL_NO_MISSING_FIELD_FILLED');
            return localResult;
          }
          const missingFields = local.drafts[0].missingFields.filter((field) =>
            (field === 'amount' && filled.amount === null) ||
            (field === 'date' && filled.date === null) ||
            (field === 'category' && filled.category === null) ||
            field === 'split');
          const completedDraft = { ...local.drafts[0], draft: filled,
            status: missingFields.length ? 'NEEDS_CLARIFICATION' as const : 'READY' as const,
            missingFields,
            clarificationPrompt: missingFields.length ? local.drafts[0].clarificationPrompt : undefined };
          const completed: ParseBatchResultDto = { ...localResult, drafts: [completedDraft],
            status: completedDraft.status, modelAttempted: true, modelAccepted: true, interpretationSource: 'MODEL',
            clarificationPrompt: missingFields.length ? localResult.clarificationPrompt : undefined };
          this.logDecision(trace, completed, 'MODEL_COMPLETED_SINGLE_DRAFT');
          return completed;
        }
        if (completion.modelAttempted) localResult.modelAttempted = true;
      }
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
