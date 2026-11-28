/** Reads the authenticated user's profile and preferences from Supabase. */
import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode } from '../budgets/currency-code';
import { SupabaseService } from '../supabase/supabase.service';

export interface UserPublicProfile {
  id: string;
  username: string;
  email: string;
  preferences: { currency: CurrencyCode; theme: 'system' | 'light' | 'dark' };
}

interface ProfileRow {
  id: string;
  username: string;
  email: string;
  user_preferences: Array<{ currency: CurrencyCode; theme: 'system' | 'light' | 'dark' }>;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Returns the RLS-protected profile for the current Supabase user. */
  async getPublicProfile(id: string, accessToken: string): Promise<UserPublicProfile> {
    const rows = await this.supabase.data<ProfileRow[]>(
      accessToken,
      `profiles?id=eq.${encodeURIComponent(id)}&select=id,username,email,user_preferences(currency,theme)`,
    );
    const profile = rows[0];
    if (!profile) throw new NotFoundException('User not found');
    const preferences = profile.user_preferences[0] ?? {
      currency: CurrencyCode.INR,
      theme: 'system' as const,
    };
    return { id: profile.id, username: profile.username, email: profile.email, preferences };
  }

  /** Updates only the current user's preference row through RLS. */
  async updatePreferences(id: string, accessToken: string, currency: CurrencyCode) {
    const rows = await this.supabase.data<
      Array<{ currency: CurrencyCode; theme: 'system' | 'light' | 'dark' }>
    >(
      accessToken,
      `user_preferences?user_id=eq.${encodeURIComponent(id)}&select=currency,theme`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ currency }),
      },
    );
    if (!rows[0]) throw new NotFoundException('User preferences not found');
    return { preferences: rows[0] };
  }
}
