import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { ParseBatchResult, ParseRequest, ParseResult } from './parser.models';

@Injectable({ providedIn: 'root' })
export class ParserService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_CONFIG.baseUrl}/parser/parse`;

  parse(text: string) {
    const payload = this.createPayload(text);
    return this.http.post<ParseResult>(this.url, payload);
  }

  parseBatch(text: string) {
    return this.http.post<ParseBatchResult>(`${this.url}-batch`, this.createPayload(text));
  }

  private createPayload(text: string): ParseRequest {
    return {
      text,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referenceTimestamp: new Date().toISOString(),
    };
  }
}
