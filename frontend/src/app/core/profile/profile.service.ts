import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { CurrencyCode } from '../budget/budget.models';
import { UpdateUserPreferencesResponse, UserPublicProfile } from './profile.models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_CONFIG.baseUrl}/users/me`;
  getMine() { return this.http.get<UserPublicProfile>(this.url); }
  updatePreferences(payload: { currency: CurrencyCode }) { return this.http.put<UpdateUserPreferencesResponse>(`${this.url}/preferences`, payload); }
}
