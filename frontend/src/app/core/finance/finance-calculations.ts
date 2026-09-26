import { CategoryMetric, DashboardMetrics, DeterministicInsight, FinanceBudget, FinanceTransaction, MonthComparison, TrendPoint, WeekMetric } from './finance-models';

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function validExpenses(transactions: FinanceTransaction[]) {
  return transactions.filter((transaction) => transaction.type === 'expense' && Number.isFinite(transaction.amount) && transaction.amount > 0 && parseDate(transaction.date));
}

function inMonth(transaction: FinanceTransaction, year: number, month: number): boolean {
  const date = parseDate(transaction.date);
  return Boolean(date && date.getFullYear() === year && date.getMonth() === month);
}

function sum(transactions: FinanceTransaction[]): number {
  return transactions.reduce((total, transaction) => total + transaction.amount, 0);
}

function comparison(current: number, previous: number): MonthComparison {
  if (previous === 0) return { current, previous, absoluteDelta: current, percentageDelta: current === 0 ? 0 : null, direction: current === 0 ? 'unchanged' : 'new-spend' };
  const delta = current - previous;
  return { current, previous, absoluteDelta: delta, percentageDelta: Math.round((delta / previous) * 100), direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged' };
}

function sixMonthTrend(expenses: FinanceTransaction[], reference: Date): TrendPoint[] {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(reference.getFullYear(), reference.getMonth() - (5 - index), 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1, label: date.toLocaleDateString('en-IN', { month: 'short' }), amount: sum(expenses.filter((transaction) => inMonth(transaction, date.getFullYear(), date.getMonth()))) };
  });
}

function categoryMetrics(expenses: FinanceTransaction[], total: number, budget: FinanceBudget): CategoryMetric[] {
  const amounts = new Map<string, number>();
  expenses.forEach((transaction) => amounts.set(transaction.category, (amounts.get(transaction.category) ?? 0) + transaction.amount));
  return [...amounts.entries()].map(([category, amount]) => {
    const limit = budget.categoryLimits.find((entry) => entry.category === category)?.limit ?? null;
    return { category, amount, percentage: total ? (amount / total) * 100 : 0, limit, limitUsedPercentage: limit ? (amount / limit) * 100 : null };
  }).sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthWeeks(expenses: FinanceTransaction[], reference: Date): WeekMetric[] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstMonday = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const weeks: WeekMetric[] = [];

  for (let start = firstMonday; start <= last; start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)) {
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const key = dateKey(date);
      const inCurrentMonth = date.getFullYear() === year && date.getMonth() === month;
      return { date: key, label: date.toLocaleDateString('en-IN', { weekday: 'short' }), amount: inCurrentMonth ? sum(expenses.filter((transaction) => transaction.date === key)) : 0 };
    });
    weeks.push({ startDate: dateKey(start), endDate: dateKey(end), label: `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, days });
  }
  return weeks;
}

function insights(expenses: FinanceTransaction[], currentSpend: number, budget: FinanceBudget, categories: CategoryMetric[], projected: number): DeterministicInsight[] {
  if (!expenses.length) return [{ code: 'NO_DATA', severity: 'info', title: 'Start tracking your spending', message: 'Add your first expense to unlock financial insights.' }];
  const results: DeterministicInsight[] = [];
  const budgetPercent = budget.monthlyLimit ? (currentSpend / budget.monthlyLimit) * 100 : null;
  if (budgetPercent !== null && budgetPercent > 100) results.push({ code: 'BUDGET_EXCEEDED', severity: 'critical', title: 'Monthly budget exceeded', message: `Spending is ${Math.round(budgetPercent - 100)}% over your monthly limit.`, value: budgetPercent });
  categories.filter((category) => category.limitUsedPercentage !== null && category.limitUsedPercentage > 100).forEach((category) => results.push({ code: 'CATEGORY_EXCEEDED', severity: 'critical', title: `${category.category} limit exceeded`, message: `${category.category} spending is ${Math.round((category.limitUsedPercentage ?? 100) - 100)}% over its limit.`, category: category.category, value: category.limitUsedPercentage ?? undefined }));
  if (budgetPercent !== null && budgetPercent >= 80 && budgetPercent <= 100) results.push({ code: 'BUDGET_WARNING', severity: 'warning', title: 'Monthly budget warning', message: `You have used ${Math.round(budgetPercent)}% of your monthly budget.`, value: budgetPercent });
  categories.filter((category) => category.limitUsedPercentage !== null && category.limitUsedPercentage >= 80 && category.limitUsedPercentage <= 100).forEach((category) => results.push({ code: 'CATEGORY_WARNING', severity: 'warning', title: `${category.category} is near its limit`, message: `You have used ${Math.round(category.limitUsedPercentage ?? 0)}% of the ${category.category} limit.`, category: category.category, value: category.limitUsedPercentage ?? undefined }));
  if (budget.monthlyLimit && (budgetPercent ?? 0) < 80 && projected > budget.monthlyLimit) results.push({ code: 'SPENDING_PACE', severity: 'warning', title: 'Spending pace may exceed budget', message: 'At the current daily average, projected spending is above your monthly limit.', value: projected });
  if (expenses.length >= 5) {
    const mean = currentSpend / expenses.length;
    const unusual = [...expenses].filter((transaction) => transaction.amount > mean * 2).sort((a, b) => b.amount - a.amount)[0];
    if (unusual) results.push({ code: 'UNUSUAL_TRANSACTION', severity: 'info', title: 'Unusually large transaction', message: `${unusual.merchant} is more than twice your average transaction.`, value: unusual.amount, transactionId: unusual.id });
  }
  if (!budget.monthlyLimit) results.push({ code: 'NO_BUDGET', severity: 'info', title: 'Set a monthly budget', message: 'Add a budget to track remaining spending and pace.' });
  else if (!results.some((item) => ['BUDGET_EXCEEDED', 'CATEGORY_EXCEEDED', 'BUDGET_WARNING', 'CATEGORY_WARNING', 'SPENDING_PACE'].includes(item.code))) results.push({ code: 'WITHIN_BUDGET', severity: 'positive', title: 'Budget is on track', message: 'Current spending remains within your configured limits.' });
  return results;
}

export function calculateDashboardMetrics(transactions: FinanceTransaction[], budget: FinanceBudget, referenceDate = new Date()): DashboardMetrics {
  const expenses = validExpenses(transactions);
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const currentExpenses = expenses.filter((transaction) => inMonth(transaction, year, month));
  const previousDate = new Date(year, month - 1, 1);
  const previousExpenses = expenses.filter((transaction) => inMonth(transaction, previousDate.getFullYear(), previousDate.getMonth()));
  const currentMonthSpend = sum(currentExpenses);
  const previousMonthSpend = sum(previousExpenses);
  const daysElapsed = referenceDate.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const averageDailySpend = currentMonthSpend / daysElapsed;
  const projectedMonthSpend = averageDailySpend * daysInMonth;
  const categories = categoryMetrics(currentExpenses, currentMonthSpend, budget);
  const weeks = monthWeeks(expenses, referenceDate);
  const referenceKey = dateKey(referenceDate);
  const currentWeek = weeks.find((week) => referenceKey >= week.startDate && referenceKey <= week.endDate)?.days ?? [];
  const budgetRemaining = budget.monthlyLimit === null ? null : budget.monthlyLimit - currentMonthSpend;
  const budgetUsedPercentage = budget.monthlyLimit === null ? null : (currentMonthSpend / budget.monthlyLimit) * 100;
  return { asOfDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`, currentMonthSpend, previousMonthSpend, monthComparison: comparison(currentMonthSpend, previousMonthSpend), budgetLimit: budget.monthlyLimit, budgetRemaining, budgetUsedPercentage, daysElapsed, daysInMonth, daysRemaining: daysInMonth - daysElapsed + 1, averageDailySpend, projectedMonthSpend, sixMonthTrend: sixMonthTrend(expenses, referenceDate), currentWeek, monthWeeks: weeks, categories, highestCategory: categories[0] ?? null, insights: insights(currentExpenses, currentMonthSpend, budget, categories, projectedMonthSpend) };
}
