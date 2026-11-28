/** Validates PENNY's proposed edits to unsaved personal transaction drafts. */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { XpenseSemanticSdk } from '@adityavardan/xpense-semantics';
import type { RequestTrace } from '../request-trace';
import { PARSER_CATEGORIES, type ParserCategory } from './dto/parse-result.dto';
import type {
  PersonalDraftContext,
  PersonalEditProposal,
} from './cloudflare-personal-follow-up';
import { ParserService } from './parser.service';

export interface PersonalFollowUpUpdate {
  ordinal: number;
  delete?: true;
  amount?: number;
  date?: string;
  category?: ParserCategory;
  merchant?: string;
  splitResolution?: 'personal' | 'split';
  splitFactor?: number;
}

@Injectable()
export class PersonalFollowUpService {
  private readonly logger = new Logger(PersonalFollowUpService.name);

  constructor(
    private readonly parser: ParserService,
    private readonly semantics: XpenseSemanticSdk,
  ) {}

  /** Interprets a follow-up against the current draft snapshot, without storing it. */
  async analyze(
    text: unknown,
    drafts: unknown,
    trace: RequestTrace,
    referenceDate = new Date(),
    timeZone?: string,
    mode: 'EDIT' | 'FILL_MISSING' = 'EDIT',
    accessToken?: string,
  ) {
    if (typeof text !== 'string' || !text.trim() || text.length > 4000)
      throw new BadRequestException('A follow-up message is required.');
    if (Number.isNaN(referenceDate.getTime()))
      throw new BadRequestException('Invalid reference time.');
    if (
      !Array.isArray(drafts) ||
      !drafts.length ||
      drafts.length > 20 ||
      !drafts.every(
        (item: unknown) =>
          isRecord(item) &&
          Number.isInteger(item.ordinal) &&
          Number(item.ordinal) > 0 &&
          (item.amount === null ||
            (typeof item.amount === 'number' &&
              Number.isFinite(item.amount))) &&
          ['category', 'merchant', 'date', 'note', 'splitResolution'].every(
            (field) =>
              typeof item[field] === 'string' &&
              String(item[field]).length <= 500,
          ) &&
          (item.splitFactor === null ||
            (Number.isInteger(item.splitFactor) &&
              Number(item.splitFactor) >= 2 &&
              Number(item.splitFactor) <= 100)),
      )
    ) {
      throw new BadRequestException('Valid personal drafts are required.');
    }
    const context = drafts as PersonalDraftContext[];
    if (new Set(context.map((item) => item.ordinal)).size !== context.length)
      throw new BadRequestException('Draft numbers must be unique.');
    if (!this.semantics.isPersonalFollowUpConfigured())
      return this.result([], false, false, trace);
    const proposals = await this.semantics.interpretPersonalFollowUp(
      text,
      context,
      referenceDate.toISOString(),
      timeZone,
      mode,
      trace,
      accessToken,
    );
    let localDate: string | null = null;
    try {
      localDate = this.parser.parse(text, referenceDate, timeZone).draft.date;
    } catch {
      /* Invalid temporal language cannot ground a date edit. */
    }
    const updates =
      proposals &&
      this.validate(
        proposals,
        text,
        context,
        localDate,
        mode,
        referenceDate,
        timeZone,
      );
    return this.result(updates ?? [], true, Boolean(updates?.length), trace);
  }

  /** Rejects unknown targets, unsupported fields, and values absent from the message. */
  private validate(
    proposals: PersonalEditProposal[],
    text: string,
    drafts: PersonalDraftContext[],
    localDate: string | null,
    mode: 'EDIT' | 'FILL_MISSING',
    referenceDate: Date,
    timeZone?: string,
  ): PersonalFollowUpUpdate[] | null {
    if (
      !Array.isArray(proposals) ||
      !proposals.length ||
      proposals.length > drafts.length
    )
      return null;
    const rangeTargets =
      mode === 'EDIT' ? this.deleteRangeTargets(text, drafts) : null;
    if (
      rangeTargets &&
      (!rangeTargets.size ||
        proposals.length !== rangeTargets.size ||
        proposals.some(
          (proposal) =>
            proposal.action !== 'DELETE' || !rangeTargets.has(proposal.ordinal),
        ))
    )
      return null;
    const known = new Set(drafts.map((item) => item.ordinal));
    const seen = new Set<number>();
    const updates: PersonalFollowUpUpdate[] = [];
    for (const proposal of proposals) {
      if (
        !isRecord(proposal) ||
        !Number.isInteger(proposal.ordinal) ||
        !known.has(proposal.ordinal) ||
        seen.has(proposal.ordinal) ||
        Object.keys(proposal).some(
          (key) =>
            ![
              'ordinal',
              'action',
              'amount',
              'date',
              'dateEvidence',
              'category',
              'merchant',
              'splitResolution',
              'splitFactor',
            ].includes(key),
        )
      )
        return null;
      seen.add(proposal.ordinal);
      const update: PersonalFollowUpUpdate = { ordinal: proposal.ordinal };
      if (proposal.action === 'DELETE') {
        if (
          mode !== 'EDIT' ||
          !/\b(?:delete|remove|discard)\b/i.test(text) ||
          [
            'amount',
            'date',
            'category',
            'merchant',
            'splitResolution',
            'splitFactor',
          ].some(
            (field) =>
              proposal[field] !== null && proposal[field] !== undefined,
          )
        )
          return null;
        const draft = drafts.find((item) => item.ordinal === proposal.ordinal)!;
        const ordinalReference = new RegExp(
          `\\b(?:transaction|expense|draft)\\s+${proposal.ordinal}\\b`,
          'i',
        );
        const explicitOrdinal = ordinalReference.test(text);
        const numbers = [
          ...text
            .replace(ordinalReference, ' ')
            .matchAll(/\b\d[\d,]*(?:\.\d{1,2})?\b/g),
        ].map((match) => Number(match[0].replace(/,/g, '')));
        if (!rangeTargets) {
          if (
            numbers.length
              ? !numbers.includes(draft.amount ?? NaN)
              : drafts.length !== 1 && !explicitOrdinal
          )
            return null;
          if (
            !explicitOrdinal &&
            drafts.filter((item) => item.amount === draft.amount).length !== 1
          )
            return null;
        }
        update.delete = true;
        updates.push(update);
        continue;
      }
      if (proposal.action !== undefined && proposal.action !== 'UPDATE')
        return null;
      if (proposal.amount !== null && proposal.amount !== undefined) {
        if (
          typeof proposal.amount !== 'string' ||
          !text.includes(proposal.amount)
        )
          return null;
        const amount = Number(proposal.amount.replace(/,/g, ''));
        if (
          !Number.isFinite(amount) ||
          amount <= 0 ||
          Math.round(amount * 100) / 100 !== amount
        )
          return null;
        update.amount = amount;
      }
      if (proposal.date !== null && proposal.date !== undefined) {
        if (typeof proposal.date !== 'string') return null;
        if (mode === 'EDIT' && proposal.date !== localDate) return null;
        if (mode === 'FILL_MISSING') {
          const evidence = proposal.dateEvidence;
          const draft = drafts.find(
            (item) => item.ordinal === proposal.ordinal,
          )!;
          if (
            typeof evidence !== 'string' ||
            evidence.length > 120 ||
            !text.includes(evidence)
          )
            return null;
          let grounded: { date: string | null; amount: number | null } | null =
            null;
          try {
            grounded = this.parser.parse(
              evidence,
              referenceDate,
              timeZone,
            ).draft;
          } catch {
            /* Reject unsupported date evidence. */
          }
          const expectedAmount = draft.amount ?? update.amount ?? null;
          if (
            grounded?.date !== proposal.date ||
            (drafts.length > 1 &&
              (expectedAmount === null || grounded?.amount !== expectedAmount))
          )
            return null;
        }
        update.date = proposal.date;
      }
      if (proposal.category !== null && proposal.category !== undefined) {
        if (
          typeof proposal.category !== 'string' ||
          !PARSER_CATEGORIES.includes(proposal.category as ParserCategory)
        )
          return null;
        const locallyDetected = this.parser.parse(text).draft.category;
        if (
          mode === 'EDIT' &&
          locallyDetected !== proposal.category &&
          !text
            .toLocaleLowerCase()
            .includes(proposal.category.toLocaleLowerCase())
        )
          return null;
        update.category = proposal.category as ParserCategory;
      }
      if (proposal.merchant !== null && proposal.merchant !== undefined) {
        if (
          typeof proposal.merchant !== 'string' ||
          !proposal.merchant.trim() ||
          !text
            .toLocaleLowerCase()
            .includes(proposal.merchant.toLocaleLowerCase())
        )
          return null;
        update.merchant = proposal.merchant.trim();
      }
      if (
        proposal.splitResolution !== null &&
        proposal.splitResolution !== undefined
      ) {
        if (
          proposal.splitResolution !== 'personal' &&
          proposal.splitResolution !== 'split'
        )
          return null;
        const lower = text.toLowerCase();
        if (
          proposal.splitResolution === 'personal' &&
          !['personal', 'my amount', 'mine'].some((word) =>
            lower.includes(word),
          )
        )
          return null;
        if (
          proposal.splitResolution === 'split' &&
          !['split', 'share', 'divide'].some((word) => lower.includes(word))
        )
          return null;
        update.splitResolution = proposal.splitResolution;
      }
      if (proposal.splitFactor !== null && proposal.splitFactor !== undefined) {
        if (
          !Number.isInteger(proposal.splitFactor) ||
          proposal.splitFactor < 2 ||
          proposal.splitFactor > 100 ||
          !text.includes(String(proposal.splitFactor))
        )
          return null;
        update.splitFactor = proposal.splitFactor;
      }
      if (Object.keys(update).length === 1) return null;
      updates.push(update);
    }
    return updates;
  }

  /** Grounds an explicit amount threshold against the supplied unsaved drafts. */
  private deleteRangeTargets(
    text: string,
    drafts: PersonalDraftContext[],
  ): Set<number> | null {
    if (!/\b(?:delete|remove|discard)\b/i.test(text)) return null;
    const match = text.match(
      /\b(above|over|greater than|more than|below|under|less than)\s*(?:₹\s*|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)\b/i,
    );
    if (!match) return null;
    const threshold = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(threshold)) return new Set();
    const above = ['above', 'over', 'greater than', 'more than'].includes(
      match[1].toLowerCase(),
    );
    return new Set(
      drafts
        .filter(
          (draft) =>
            draft.amount !== null &&
            (above ? draft.amount > threshold : draft.amount < threshold),
        )
        .map((draft) => draft.ordinal),
    );
  }

  private result(
    updates: PersonalFollowUpUpdate[],
    modelAttempted: boolean,
    modelAccepted: boolean,
    trace: RequestTrace,
  ) {
    this.logger.log(
      JSON.stringify({
        ...trace,
        route: 'personal-follow-up',
        updateCount: updates.length,
        modelAttempted,
        modelAccepted,
      }),
    );
    return {
      updates,
      modelAttempted,
      modelAccepted,
      interpretationSource: modelAccepted
        ? ('MODEL' as const)
        : ('LOCAL' as const),
      clarificationPrompt: updates.length
        ? undefined
        : 'Tell me which draft to change or remove, such as its transaction number or unique amount.',
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
