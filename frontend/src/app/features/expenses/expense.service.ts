import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../core/config/api.config';

export interface CreateExpensePayload {
  amount: number;
  category: string;
  merchant: string;
  date: string;
  note?: string;
}

export interface UpdateExpensePayload {
  amount?: number;
  category?: string;
  merchant?: string;
  date?: string;
  note?: string;
}

export interface Expense {
  id: string;
  userId: number;
  amount: number;
  category: string;
  merchant: string;
  date: string;
  note?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_CONFIG.baseUrl}/expenses`;

  create(payload: CreateExpensePayload) {
    return this.http.post<Expense>(this.url, payload);
  }

  list() {
    return this.http.get<Expense[]>(this.url);
  }

  getById(id: string) {
    return this.http.get<Expense>(`${this.url}/${id}`);
  }

  update(id: string, payload: UpdateExpensePayload) {
    return this.http.patch<Expense>(`${this.url}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<Expense>(`${this.url}/${id}`);
  }
}
