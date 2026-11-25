/** Saves a user-approved Penny example to the development evaluation table. */
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_CONFIG } from '../config/api.config';

export interface EvalCaseInput {
  conversationId: string;
  requestId: string;
  responseId: string;
  input: Record<string, unknown>;
  observed: Record<string, unknown>;
  modelAttempted: boolean;
  expectedDescription: string;
}

@Injectable({ providedIn: 'root' })
export class EvalCasesService {
  private readonly http = inject(HttpClient);

  create(input: EvalCaseInput) {
    return this.http.post<{ id: string }>(`${API_CONFIG.baseUrl}/parser/eval-cases`, input);
  }
}
