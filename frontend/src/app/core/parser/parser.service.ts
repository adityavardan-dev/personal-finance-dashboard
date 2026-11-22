import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { ParseBatchResult, ParseRequest, ParseResult, SplitIntentResult, SplitFollowUpResult, PersonalFollowUpResult } from './parser.models';
import type { PendingSplit } from '../../features/peer-splits/counted-split-parser';
import { RequestTrace, requestTraceHeaders } from '../request-trace';

@Injectable({ providedIn: 'root' })
export class ParserService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_CONFIG.baseUrl}/parser/parse`;

  parse(text: string, trace: RequestTrace) {
    const payload = this.createPayload(text);
    return this.http.post<ParseResult>(this.url, payload, { headers: requestTraceHeaders(trace) });
  }

  parseBatch(text: string, trace: RequestTrace) {
    return this.http.post<ParseBatchResult>(`${this.url}-batch`, this.createPayload(text), {
      headers: requestTraceHeaders(trace),
    });
  }

  interpretSplit(text: string, trace: RequestTrace) {
    return this.http.post<SplitIntentResult>(
      `${API_CONFIG.baseUrl}/parser/split-intent`,
      this.createPayload(text),
      {
        headers: requestTraceHeaders(trace),
      },
    );
  }

  interpretSplitFollowUp(text: string, pendingSplits: PendingSplit[], trace: RequestTrace) {
    return this.http.post<SplitFollowUpResult>(
      `${API_CONFIG.baseUrl}/parser/split-follow-up`,
      { text, pendingSplits: pendingSplits.map(({ ordinal, peopleCount, amountMinor, names, paidBy }) => ({
        ordinal, peopleCount, amountMinor,
        names: names.split(/\s*,\s*|\s+and\s+/i).map((name) => name.trim()).filter(Boolean),
        paidBy,
      })) },
      { headers: requestTraceHeaders(trace) },
    );
  }

  interpretPersonalFollowUp(text: string, drafts: Array<{ amount: string; category: string; merchant: string; date: string; note: string; splitResolution: string; splitFactor: string }>, trace: RequestTrace) {
    return this.http.post<PersonalFollowUpResult>(
      `${API_CONFIG.baseUrl}/parser/personal-follow-up`,
      { ...this.createPayload(text), drafts: drafts.map((draft, index) => ({
        ordinal: index + 1,
        amount: Number(draft.amount) || null,
        category: draft.category,
        merchant: draft.merchant,
        date: draft.date,
        note: draft.note,
        splitResolution: draft.splitResolution,
        splitFactor: Number(draft.splitFactor) || null,
      })) },
      { headers: requestTraceHeaders(trace) },
    );
  }

  private createPayload(text: string): ParseRequest {
    return {
      text,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referenceTimestamp: new Date().toISOString(),
    };
  }
}
