/** Verifies authenticated Supabase expense persistence and API field mapping. */
import { NotFoundException } from '@nestjs/common';
import { CurrencyCode } from '../budgets/currency-code';
import { SupabaseService } from '../supabase/supabase.service';
import { ExpensesService } from './expenses.service';
import { TransactionType } from './transaction-type';

const row = {
  id: 'expense-1',
  user_id: 'user-1',
  type: TransactionType.Expense,
  amount_minor: 300025,
  currency: CurrencyCode.INR,
  category: 'Other',
  merchant: 'Vendor',
  transaction_date: '2026-11-22',
  description: 'Project supplies',
  created_at: '2026-11-22T00:00:00.000Z',
};

describe('ExpensesService', () => {
  const supabase = { data: jest.fn() };
  const service = new ExpensesService(supabase as unknown as SupabaseService);

  beforeEach(() => jest.clearAllMocks());

  it('stores amount in minor units and maps API note to database description', async () => {
    supabase.data
      .mockResolvedValueOnce([{ currency: CurrencyCode.INR }])
      .mockResolvedValueOnce([row]);
    await expect(service.create('user-1', 'token', {
      type: TransactionType.Expense,
      amount: 3000.25,
      category: 'Other',
      merchant: 'Vendor',
      date: '2026-11-22',
      note: 'Project supplies',
    })).resolves.toMatchObject({ amount: 3000.25, note: 'Project supplies' });
    const insert = supabase.data.mock.calls[1][2];
    expect(insert.body).toContain('"amount_minor":300025');
    expect(insert.body).toContain('"description":"Project supplies"');
  });

  it('returns only rows supplied through the authenticated RLS query', async () => {
    supabase.data.mockResolvedValue([row]);
    await expect(service.findByUser('user-1', 'token')).resolves.toEqual([
      expect.objectContaining({ id: 'expense-1', userId: 'user-1' }),
    ]);
  });

  it('maps an update note to description', async () => {
    supabase.data.mockResolvedValue([{ ...row, description: 'Updated' }]);
    await service.update('user-1', 'token', 'expense-1', { note: 'Updated' });
    expect(supabase.data.mock.calls[0][2].body).toBe('{"description":"Updated"}');
  });

  it('does not pretend an RLS-hidden expense exists', async () => {
    supabase.data.mockResolvedValue([]);
    await expect(service.findOne('user-1', 'token', 'missing')).rejects.toThrow(NotFoundException);
  });
});
