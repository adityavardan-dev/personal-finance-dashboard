export type CurrencyCode = 'INR' | 'USD' | 'EUR';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
};

export interface CategoryBudgetLimit {
  category: string;
  limit: number;
}

export interface BudgetConfig {
  monthlyLimit: number | null;
  categoryLimits: CategoryBudgetLimit[];
  currency: CurrencyCode;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpsertBudgetPayload {
  monthlyLimit: number | null;
  categoryLimits: CategoryBudgetLimit[];
  currency: CurrencyCode;
}
