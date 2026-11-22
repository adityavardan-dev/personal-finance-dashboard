/** Verifies minor-unit conversion and transactional Supabase budget persistence. */
import { SupabaseService } from '../supabase/supabase.service';
import { BudgetsService } from './budgets.service';
import { CurrencyCode } from './currency-code';

describe('BudgetsService', () => {
  const supabase = { data: jest.fn() };
  const service = new BudgetsService(supabase as unknown as SupabaseService);

  beforeEach(() => jest.clearAllMocks());

  it('returns the canonical default when no budget exists', async () => {
    supabase.data.mockResolvedValue([]);
    await expect(service.getMine('user-1', 'token')).resolves.toEqual({
      monthlyLimit: null,
      categoryLimits: [],
      currency: CurrencyCode.INR,
      createdAt: null,
      updatedAt: null,
    });
  });

  it('maps PostgreSQL minor units to API major units', async () => {
    supabase.data.mockResolvedValue([{
      monthly_limit_minor: 3000050,
      currency: CurrencyCode.INR,
      created_at: 'created',
      updated_at: 'updated',
      budget_category_limits: [{ category: 'Food', limit_minor: 800025 }],
    }]);
    await expect(service.getMine('user-1', 'token')).resolves.toMatchObject({
      monthlyLimit: 30000.5,
      categoryLimits: [{ category: 'Food', limit: 8000.25 }],
    });
  });

  it('calls the atomic budget RPC with minor units', async () => {
    supabase.data.mockResolvedValue({
      monthly_limit_minor: 3000000,
      currency: CurrencyCode.INR,
      created_at: 'created',
      updated_at: 'updated',
      category_limits: [{ category: 'Food', limit_minor: 800000 }],
    });
    await service.upsert('user-1', 'token', {
      monthlyLimit: 30000,
      categoryLimits: [{ category: 'Food', limit: 8000 }],
      currency: CurrencyCode.INR,
    });
    expect(supabase.data).toHaveBeenCalledWith('token', 'rpc/upsert_my_budget', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('3000000'),
    }));
  });
});
