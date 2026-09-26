import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { BudgetConfig, UpsertBudgetPayload } from './budget.models';

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_CONFIG.baseUrl}/budgets/me`;

  getMine() {
    return this.http.get<BudgetConfig>(this.url);
  }

  saveMine(payload: UpsertBudgetPayload) {
    return this.http.put<BudgetConfig>(this.url, payload);
  }
}
