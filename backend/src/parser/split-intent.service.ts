/** Extracts reviewable split drafts before participant names and payer are known. */
import { Injectable, Logger } from '@nestjs/common';
import {
  XpenseSemanticSdk,
  type ProposedSplit,
} from '@adityavardan/xpense-semantics';
import type { RequestTrace } from '../request-trace';
import {
  normalizeParticipantName,
  participantAppearsInText,
} from './participant-reference';

export interface SplitIntentDraft {
  ordinal: number;
  amountMinor: number;
  peopleCount: number;
  currency: 'INR' | 'USD' | 'EUR';
  date: string | null;
  names?: string[];
  paidBy?: string;
  allocationKind?: 'EQUAL' | 'FULL_TO_OTHER';
  beneficiary?: string;
}

export interface SplitIntentResult {
  drafts: SplitIntentDraft[];
  clarificationPrompt?: string;
  modelAttempted: boolean;
  modelAccepted: boolean;
  interpretationSource: 'LOCAL' | 'MODEL';
}

@Injectable()
export class SplitIntentService {
  private readonly logger = new Logger(SplitIntentService.name);
  constructor(private readonly semantics: XpenseSemanticSdk) {}

  /** Uses explicit local patterns first, then a validated model proposal. */
  async analyze(
    text: string,
    trace: RequestTrace,
    referenceDate = new Date(),
    timeZone?: string,
    accessToken?: string,
  ): Promise<SplitIntentResult> {
    const local = this.extractLocal(text, referenceDate, timeZone);
    if (local.length) return this.result(local, false, false, 'LOCAL', trace);
    if (!this.semantics.isPeerConfigured())
      return this.result([], false, false, 'LOCAL', trace);

    const proposed = await this.semantics.interpretPeerSplits(
      text,
      trace,
      accessToken,
    );
    const candidates =
      proposed?.map((item, index) => {
        const amount = Number(item.amount.replace(/,/g, ''));
        const peopleCount = Number(item.peopleCount);
        const amountMinor = Math.round(amount * 100);
        const names = (item.participants ?? []).map(normalizeParticipantName);
        const paidBy = item.paidBy
          ? normalizeParticipantName(item.paidBy)
          : undefined;
        const beneficiary = item.beneficiary
          ? normalizeParticipantName(item.beneficiary)
          : undefined;
        if (
          !text.includes(item.amount) ||
          (!this.countSupported(text, peopleCount, names.length) &&
            names.length !== peopleCount) ||
          !Number.isSafeInteger(amountMinor) ||
          amountMinor <= 0 ||
          !Number.isInteger(peopleCount) ||
          peopleCount < 2 ||
          peopleCount > 100 ||
          !this.validModelDetails(
            item,
            text,
            peopleCount,
            names,
            paidBy,
            beneficiary,
          )
        )
          return null;
        return {
          ordinal: index + 1,
          amountMinor,
          peopleCount,
          currency: this.currency(text),
          date: this.date(text, referenceDate, timeZone),
          ...(names.length ? { names } : {}),
          ...(paidBy ? { paidBy } : {}),
          ...(item.allocationKind
            ? { allocationKind: item.allocationKind }
            : {}),
          ...(beneficiary ? { beneficiary } : {}),
        };
      }) ?? [];
    const declared = text.match(/\bsplit\s+(\d{1,2})\s+expenses?\b/i);
    if (
      !candidates.length ||
      candidates.some((item) => item === null) ||
      (declared && Number(declared[1]) !== candidates.length)
    ) {
      return this.result([], true, false, 'LOCAL', trace);
    }
    return this.result(
      candidates as SplitIntentDraft[],
      true,
      true,
      'MODEL',
      trace,
    );
  }

  /** Accepts a count stated as digits or a common number word, or implied by named people. */
  private countSupported(
    text: string,
    peopleCount: number,
    namedCount: number,
  ): boolean {
    if (namedCount === peopleCount) return true;
    if (text.includes(String(peopleCount))) return true;
    const words: Record<number, string> = {
      2: 'two',
      3: 'three',
      4: 'four',
      5: 'five',
      6: 'six',
      7: 'seven',
      8: 'eight',
      9: 'nine',
      10: 'ten',
    };
    return Boolean(
      words[peopleCount] &&
      text
        .toLowerCase()
        .split(/[^a-z]+/)
        .includes(words[peopleCount]),
    );
  }

  /** Accepts only named participants, payers and beneficiaries grounded in the message. */
  private validModelDetails(
    item: ProposedSplit,
    text: string,
    peopleCount: number,
    names: string[],
    paidBy?: string,
    beneficiary?: string,
  ): boolean {
    if (
      names.length > peopleCount ||
      new Set(names.map((name) => name.toLocaleLowerCase())).size !==
        names.length
    )
      return false;
    if (!names.every((name) => this.nameInText(name, text))) return false;
    if (
      paidBy &&
      (!names.some(
        (name) => name.toLocaleLowerCase() === paidBy.toLocaleLowerCase(),
      ) ||
        !this.nameInText(paidBy, text))
    )
      return false;
    if (item.allocationKind === 'FULL_TO_OTHER') {
      if (
        !paidBy ||
        !beneficiary ||
        names.length !== peopleCount ||
        beneficiary.toLocaleLowerCase() === paidBy.toLocaleLowerCase()
      )
        return false;
      if (
        !names.some(
          (name) =>
            name.toLocaleLowerCase() === beneficiary.toLocaleLowerCase(),
        ) ||
        !this.nameInText(beneficiary, text)
      )
        return false;
    } else if (beneficiary) return false;
    return true;
  }

  private nameInText(name: string, text: string): boolean {
    if (!name || !/^[\p{L}][\p{L}\p{M}' .-]{0,59}$/u.test(name)) return false;
    return participantAppearsInText(name, text);
  }

  /** Extracts numbered clauses with explicit amount and group size. */
  private extractLocal(
    text: string,
    referenceDate: Date,
    timeZone?: string,
  ): SplitIntentDraft[] {
    const declared = text.match(/\bsplit\s+(\d{1,2})\s+expenses?\b/i);
    const pattern =
      /\b(\d{1,2})(?:st|nd|rd|th)\s+(?:(?:expense|one)\s+)?(?:(?:₹|rs\.?|inr|\$|usd|€|eur)\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s+(?:among|between|with)\s+(\d{1,2})\s+(?:people|persons?)\b/gi;
    const matches = [...text.matchAll(pattern)];
    if (!matches.length || (declared && Number(declared[1]) !== matches.length))
      return [];
    const drafts = matches.map((match) => {
      const amountMinor = Math.round(Number(match[2].replace(/,/g, '')) * 100);
      const peopleCount = Number(match[3]);
      if (
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0 ||
        peopleCount < 2 ||
        peopleCount > 100
      )
        return null;
      return {
        ordinal: Number(match[1]),
        amountMinor,
        peopleCount,
        currency: this.currency(text),
        date: this.date(text, referenceDate, timeZone),
      };
    });
    if (
      drafts.some((draft) => draft === null) ||
      new Set(drafts.map((draft) => draft?.ordinal)).size !== drafts.length
    )
      return [];
    return (drafts as SplitIntentDraft[]).sort((a, b) => a.ordinal - b.ordinal);
  }

  private currency(text: string): SplitIntentDraft['currency'] {
    return /\$|\busd\b/i.test(text)
      ? 'USD'
      : /€|\beur\b/i.test(text)
        ? 'EUR'
        : 'INR';
  }

  private date(
    text: string,
    referenceDate: Date,
    timeZone?: string,
  ): string | null {
    if (!/\btoday\b/i.test(text)) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(referenceDate);
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private result(
    drafts: SplitIntentDraft[],
    modelAttempted: boolean,
    modelAccepted: boolean,
    interpretationSource: 'LOCAL' | 'MODEL',
    trace: RequestTrace,
  ): SplitIntentResult {
    this.logger.log(
      JSON.stringify({
        ...trace,
        route: 'split-intent',
        draftCount: drafts.length,
        modelAttempted,
        modelAccepted,
        interpretationSource,
      }),
    );
    return {
      drafts,
      modelAttempted,
      modelAccepted,
      interpretationSource,
      clarificationPrompt: drafts.length
        ? undefined
        : 'Tell me each expense amount and how many people share it. I will ask for names and who paid next.',
    };
  }
}
