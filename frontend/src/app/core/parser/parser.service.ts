import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { ParseBatchResult, ParseRequest, ParseResult } from './parser.models';
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

  private createPayload(text: string): ParseRequest {
    return {
      text,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referenceTimestamp: new Date().toISOString(),
    };
  }
}
