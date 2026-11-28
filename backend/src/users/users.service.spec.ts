/** Verifies profile and preference mapping through the Supabase Data API. */
import { NotFoundException } from '@nestjs/common';
import { CurrencyCode } from '../budgets/currency-code';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const supabase = { data: jest.fn() };
  const service = new UsersService(supabase as unknown as SupabaseService);

  beforeEach(() => jest.clearAllMocks());

  it('returns the current RLS-protected profile', async () => {
    supabase.data.mockResolvedValue([{
      id: 'user-1', username: 'Aditya', email: 'a@example.com',
      user_preferences: [{ currency: CurrencyCode.INR, theme: 'system' }],
    }]);
    await expect(service.getPublicProfile('user-1', 'token')).resolves.toMatchObject({
      id: 'user-1', username: 'Aditya', preferences: { currency: CurrencyCode.INR },
    });
  });

  it('rejects a profile hidden or missing under RLS', async () => {
    supabase.data.mockResolvedValue([]);
    await expect(service.getPublicProfile('user-1', 'token')).rejects.toThrow(NotFoundException);
  });

  it('updates the authenticated user preference', async () => {
    supabase.data.mockResolvedValue([{ currency: CurrencyCode.EUR, theme: 'system' }]);
    await expect(service.updatePreferences('user-1', 'token', CurrencyCode.EUR)).resolves.toEqual({
      preferences: { currency: CurrencyCode.EUR, theme: 'system' },
    });
  });
});
