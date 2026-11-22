/** Applies participant and payer follow-ups to existing split drafts. */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { RequestTrace } from '../request-trace';
import { CloudflareSplitInterpreter } from './cloudflare-split-interpreter';

export interface PendingSplitContext {
  ordinal: number;
  peopleCount: number;
  amountMinor?: number;
  names?: string[];
  paidBy?: string;
}

export interface SplitFollowUpUpdate {
  ordinal: number;
  names?: string[];
  paidBy?: string;
  amountMinor?: number;
  peopleCount?: number;
}

export interface SplitFollowUpProposal {
  ordinal: number;
  names?: string[] | null;
  paidBy?: string | null;
  amount?: string | null;
  peopleCount?: number | null;
}

export interface SplitFollowUpResult {
  updates: SplitFollowUpUpdate[];
  clarificationPrompt?: string;
  modelAttempted: boolean;
  modelAccepted: boolean;
  interpretationSource: 'LOCAL' | 'MODEL';
}

@Injectable()
export class SplitFollowUpService {
  private readonly logger = new Logger(SplitFollowUpService.name);

  constructor(private readonly model: CloudflareSplitInterpreter) {}

  /** Tries explicit split-number clauses, then asks the model for a structured edit. */
  async analyze(
    text: unknown,
    pendingSplits: unknown,
    trace: RequestTrace,
  ): Promise<SplitFollowUpResult> {
    if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
      throw new BadRequestException('A follow-up message is required.');
    }
    if (
      !Array.isArray(pendingSplits) ||
      !pendingSplits.length ||
      pendingSplits.length > 20 ||
      !pendingSplits.every(
        (item: unknown) =>
          isRecord(item) &&
          Number.isInteger(item.ordinal) &&
          Number(item.ordinal) > 0 &&
          Number.isInteger(item.peopleCount) &&
          Number(item.peopleCount) >= 2 &&
          Number(item.peopleCount) <= 100 &&
          (item.amountMinor === undefined || (Number.isSafeInteger(item.amountMinor) && Number(item.amountMinor) > 0)) &&
          (item.names === undefined || (Array.isArray(item.names) && item.names.every((name: unknown) => typeof name === 'string'))) &&
          (item.paidBy === undefined || typeof item.paidBy === 'string'),
      )
    ) {
      throw new BadRequestException('Valid pending splits are required.');
    }
    const pending = pendingSplits as PendingSplitContext[];
    if (new Set(pending.map((item) => item.ordinal)).size !== pending.length) {
      throw new BadRequestException('Split numbers must be unique.');
    }

    const local = this.parseLocal(text);
    const localUpdates = local && this.validate(local, text, pending);
    if (localUpdates?.length) return this.result(localUpdates, false, false, 'LOCAL', trace);

    if (!this.model.isConfigured()) return this.result([], false, false, 'LOCAL', trace);
    const proposed = await this.model.interpretFollowUp(text, pending);
    const updates = proposed && this.validate(proposed, text, pending);
    return this.result(updates ?? [], true, Boolean(updates?.length), updates?.length ? 'MODEL' : 'LOCAL', trace);
  }

  /** Reads complete clauses such as “Use A and B for split 1”. */
  private parseLocal(text: string): SplitFollowUpUpdate[] | null {
    const clauses = text.trim().replace(/[.!?]+$/, '').split(/\s+and\s+(?=(?:use|set|change)\b)/i);
    const updates: SplitFollowUpUpdate[] = [];
    for (const clause of clauses) {
      const use = clause.match(/^(?:use|set|change)\s+(.+?)\s+for\s+(?:split\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s+split)$/i);
      const prefix = clause.match(/^(?:expense|split)\s+(\d{1,2})\s*[:\-]\s*(.+)$/i);
      if (!use && !prefix) return null;
      const ordinal = Number(use?.[2] ?? use?.[3] ?? prefix?.[1]);
      const raw = (use?.[1] ?? prefix?.[2] ?? '').trim();
      const [nameText, paidBy] = raw.split(/\s*;\s*paid\s+by\s+/i);
      if (!nameText || raw.split(/\s*;\s*paid\s+by\s+/i).length > 2) return null;
      const names = nameText.split(/\s*,\s*|\s+and\s+/i).map((name) => name.trim()).filter(Boolean);
      updates.push({ ordinal, names, ...(paidBy ? { paidBy: paidBy.trim() } : {}) });
    }
    return updates;
  }

  /** Rejects unknown splits, wrong counts, duplicate or invented names and payer. */
  private validate(
    proposed: SplitFollowUpProposal[],
    text: string,
    pending: PendingSplitContext[],
  ): SplitFollowUpUpdate[] | null {
    if (!Array.isArray(proposed) || !proposed.length || proposed.length > pending.length) return null;
    const known = new Map(pending.map((item) => [item.ordinal, item]));
    const seen = new Set<number>();
    const updates: SplitFollowUpUpdate[] = [];
    for (const update of proposed) {
      if (!isRecord(update) || !Number.isInteger(update.ordinal) || seen.has(update.ordinal)) return null;
      seen.add(update.ordinal);
      const current = known.get(update.ordinal);
      if (!current) return null;
      const names = update.names ?? undefined;
      const count = update.peopleCount ?? current.peopleCount;
      const revised: SplitFollowUpUpdate = { ordinal: update.ordinal };
      if (update.peopleCount !== null && update.peopleCount !== undefined) {
        if (!Number.isInteger(count) || count < 2 || count > 100 || !text.includes(String(count)) || (names ?? current.names ?? []).length > count) return null;
        revised.peopleCount = count;
      }
      if (names !== undefined) {
        if (!Array.isArray(names) || !names.length || names.length > count) return null;
        if (!names.every((name) => typeof name === 'string' && /^[\p{L}][\p{L}\p{M}' .-]{0,59}$/u.test(name) && (this.appearsInMessage(name, text) || current.names?.some((old) => old.toLowerCase() === name.toLowerCase())))) return null;
        if (!names.some((name) => this.appearsInMessage(name, text))) return null;
        if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) return null;
        revised.names = names.map((name) => name.trim());
      }
      if (update.paidBy !== null && update.paidBy !== undefined) {
        const knownNames = names ?? current.names ?? [];
        if (typeof update.paidBy !== 'string' || (knownNames.length > 0 && !knownNames.some((name) => name.toLowerCase() === update.paidBy?.toLowerCase())) || !this.appearsInMessage(update.paidBy, text)) return null;
        revised.paidBy = update.paidBy.trim();
      }
      if (update.amount !== null && update.amount !== undefined) {
        if (typeof update.amount !== 'string' || !text.includes(update.amount)) return null;
        const amountMinor = Math.round(Number(update.amount.replace(/,/g, '')) * 100);
        if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
        revised.amountMinor = amountMinor;
      }
      if (Object.keys(revised).length === 1) return null;
      updates.push(revised);
    }
    return updates;
  }

  private appearsInMessage(name: string, text: string): boolean {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, 'iu').test(text);
  }

  private result(updates: SplitFollowUpUpdate[], modelAttempted: boolean, modelAccepted: boolean, interpretationSource: 'LOCAL' | 'MODEL', trace: RequestTrace): SplitFollowUpResult {
    this.logger.log(JSON.stringify({ ...trace, route: 'split-follow-up', updateCount: updates.length, modelAttempted, modelAccepted, interpretationSource }));
    return { updates, modelAttempted, modelAccepted, interpretationSource, clarificationPrompt: updates.length ? undefined : 'Tell me the participant names for each split number, for example: Use Jashu, Harsha and Aditya for split 1.' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
