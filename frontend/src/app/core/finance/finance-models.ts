import { CurrencyCode } from '../budget/budget.models';
import { TransactionType } from '../../features/expenses/expense.service';

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  merchant: string;
}

export interface FinanceBudget {
  monthlyLimit: number | null;
  categoryLimits: Array<{ category: string; limit: number }>;
  currency: CurrencyCode;
}

export type DeltaDirection = 'up' | 'down' | 'unchanged' | 'new-spend';
export interface MonthComparison { current: number; previous: number; absoluteDelta: number; percentageDelta: number | null; direction: DeltaDirection; }
export interface TrendPoint { year: number; month: number; label: string; amount: number; }
export interface CategoryMetric { category: string; amount: number; percentage: number; limit: number | null; limitUsedPercentage: number | null; }
export interface DailyMetric { date: string; label: string; amount: number; }
export interface WeekMetric { startDate: string; endDate: string; label: string; days: DailyMetric[]; }
export type InsightSeverity = 'positive' | 'info' | 'warning' | 'critical';
export type InsightCode = 'NO_DATA' | 'NO_BUDGET' | 'WITHIN_BUDGET' | 'SPENDING_PACE' | 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'CATEGORY_WARNING' | 'CATEGORY_EXCEEDED' | 'UNUSUAL_TRANSACTION';
export interface DeterministicInsight { code: InsightCode; severity: InsightSeverity; title: string; message: string; value?: number; category?: string; transactionId?: string; }

export interface DashboardMetrics {
  asOfDate: string;
  currentMonthSpend: number;
  previousMonthSpend: number;
  monthComparison: MonthComparison;
  budgetLimit: number | null;
  budgetRemaining: number | null;
  budgetUsedPercentage: number | null;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  averageDailySpend: number;
  projectedMonthSpend: number;
  sixMonthTrend: TrendPoint[];
  currentWeek: DailyMetric[];
  monthWeeks: WeekMetric[];
  categories: CategoryMetric[];
  highestCategory: CategoryMetric | null;
  insights: DeterministicInsight[];
}
