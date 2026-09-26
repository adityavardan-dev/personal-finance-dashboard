import { CurrencyCode } from '../budget/budget.models';

export interface UserPreferences { currency: CurrencyCode; theme: 'system'; }
export interface UserPublicProfile { id: number; username: string; email: string; preferences: UserPreferences; }
export interface UpdateUserPreferencesResponse { preferences: UserPreferences; }

export function initialsFromUsername(username: string): string {
  return username.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U';
}
