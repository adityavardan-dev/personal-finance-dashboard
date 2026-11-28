/** Persists personal expense records in Supabase using authenticated RLS requests. */
import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode } from '../budgets/currency-code';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { TransactionType } from './transaction-type';

export interface Expense {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  category: string;
  merchant: string;
  date: string;
  note?: string;
  createdAt: string;
}

interface ExpenseRow {
  id: string;
  user_id: string;
  type: TransactionType;
  amount_minor: number;
  currency: CurrencyCode;
  category: string;
  merchant: string;
  transaction_date: string;
  description: string | null;
  created_at: string;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(
    userId: string,
    accessToken: string,
    dto: CreateExpenseDto,
  ): Promise<Expense> {
    return (await this.createBatch(userId, accessToken, [dto]))[0];
  }

  /** Inserts a batch atomically through one PostgREST request. */
  async createBatch(
    userId: string,
    accessToken: string,
    dtos: CreateExpenseDto[],
  ): Promise<Expense[]> {
    const currency = await this.currency(accessToken, userId);
    const rows = await this.supabase.data<ExpenseRow[]>(
      accessToken,
      'expenses?select=*',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(
          dtos.map((dto) => ({
            user_id: userId,
            type: dto.type,
            amount_minor: toMinor(dto.amount),
            currency,
            category: dto.category.trim(),
            merchant: dto.merchant?.trim() ?? '',
            transaction_date: dto.date,
            description: dto.note?.trim() || null,
          })),
        ),
      },
    );
    return rows.map(toExpense);
  }

  async findByUser(userId: string, accessToken: string): Promise<Expense[]> {
    const rows = await this.supabase.data<ExpenseRow[]>(
      accessToken,
      `expenses?user_id=eq.${encodeURIComponent(userId)}&select=*&order=transaction_date.desc,created_at.desc`,
    );
    return rows.map(toExpense);
  }

  async findOne(userId: string, accessToken: string, id: string): Promise<Expense> {
    const rows = await this.supabase.data<ExpenseRow[]>(
      accessToken,
      `expenses?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
    );
    if (!rows[0]) throw new NotFoundException(`Expense ${id} not found`);
    return toExpense(rows[0]);
  }

  async update(
    userId: string,
    accessToken: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const body: Record<string, unknown> = {};
    if (dto.type !== undefined) body.type = dto.type;
    if (dto.amount !== undefined) body.amount_minor = toMinor(dto.amount);
    if (dto.category !== undefined) body.category = dto.category.trim();
    if (dto.merchant !== undefined) body.merchant = dto.merchant.trim();
    if (dto.date !== undefined) body.transaction_date = dto.date;
    if (dto.note !== undefined) body.description = dto.note.trim() || null;
    const rows = await this.supabase.data<ExpenseRow[]>(
      accessToken,
      `expenses?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      },
    );
    if (!rows[0]) throw new NotFoundException(`Expense ${id} not found`);
    return toExpense(rows[0]);
  }

  async remove(userId: string, accessToken: string, id: string): Promise<Expense> {
    const rows = await this.supabase.data<ExpenseRow[]>(
      accessToken,
      `expenses?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
      { method: 'DELETE', headers: { Prefer: 'return=representation' } },
    );
    if (!rows[0]) throw new NotFoundException(`Expense ${id} not found`);
    return toExpense(rows[0]);
  }

  private async currency(accessToken: string, userId: string): Promise<CurrencyCode> {
    const rows = await this.supabase.data<Array<{ currency: CurrencyCode }>>(
      accessToken,
      `user_preferences?user_id=eq.${encodeURIComponent(userId)}&select=currency`,
    );
    return rows[0]?.currency ?? CurrencyCode.INR;
  }
}

const toMinor = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  amount: row.amount_minor / 100,
  currency: row.currency,
  category: row.category,
  merchant: row.merchant,
  date: row.transaction_date,
  ...(row.description ? { note: row.description } : {}),
  createdAt: row.created_at,
});
