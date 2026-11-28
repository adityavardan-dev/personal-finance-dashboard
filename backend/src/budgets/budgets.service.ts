/** Persists the authenticated user's budget through Supabase RLS and one atomic RPC. */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CurrencyCode } from './currency-code';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

export interface CategoryBudgetLimit { category: string; limit: number }
export interface BudgetResponse {
  monthlyLimit: number | null;
  categoryLimits: CategoryBudgetLimit[];
  currency: CurrencyCode;
  createdAt: string | null;
  updatedAt: string | null;
}

interface BudgetRow {
  monthly_limit_minor: number | null;
  currency: CurrencyCode;
  created_at: string;
  updated_at: string;
  budget_category_limits: Array<{ category: string; limit_minor: number }>;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Returns the user's budget and category limits, or the canonical empty budget. */
  async getMine(userId: string, accessToken: string): Promise<BudgetResponse> {
    const rows = await this.supabase.data<BudgetRow[]>(
      accessToken,
      `budgets?user_id=eq.${encodeURIComponent(userId)}&select=monthly_limit_minor,currency,created_at,updated_at,budget_category_limits(category,limit_minor)`,
    );
    return rows[0]
      ? this.toResponse(rows[0])
      : {
          monthlyLimit: null,
          categoryLimits: [],
          currency: CurrencyCode.INR,
          createdAt: null,
          updatedAt: null,
        };
  }

  /** Replaces the budget and category limits in one PostgreSQL transaction. */
  async upsert(
    _userId: string,
    accessToken: string,
    dto: UpsertBudgetDto,
  ): Promise<BudgetResponse> {
    const row = await this.supabase.data<{
      monthly_limit_minor: number | null;
      currency: CurrencyCode;
      created_at: string;
      updated_at: string;
      category_limits: Array<{ category: string; limit_minor: number }>;
    }>(accessToken, 'rpc/upsert_my_budget', {
      method: 'POST',
      body: JSON.stringify({
        p_monthly_limit_minor:
          dto.monthlyLimit === null ? null : toMinor(dto.monthlyLimit),
        p_currency: dto.currency,
        p_category_limits: dto.categoryLimits.map((item) => ({
          category: item.category.trim(),
          limit_minor: toMinor(item.limit),
        })),
      }),
    });
    return {
      monthlyLimit:
        row.monthly_limit_minor === null ? null : fromMinor(row.monthly_limit_minor),
      categoryLimits: row.category_limits.map((item) => ({
        category: item.category,
        limit: fromMinor(item.limit_minor),
      })),
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toResponse(row: BudgetRow): BudgetResponse {
    return {
      monthlyLimit:
        row.monthly_limit_minor === null ? null : fromMinor(row.monthly_limit_minor),
      categoryLimits: row.budget_category_limits.map((item) => ({
        category: item.category,
        limit: fromMinor(item.limit_minor),
      })),
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

const toMinor = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
const fromMinor = (amount: number) => amount / 100;
