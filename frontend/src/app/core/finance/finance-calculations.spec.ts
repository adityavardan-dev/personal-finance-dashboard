import { calculateDashboardMetrics } from './finance-calculations';
import { FinanceBudget, FinanceTransaction } from './finance-models';

const budget: FinanceBudget = { monthlyLimit: 1000, categoryLimits: [{ category: 'Food', limit: 500 }], currency: 'INR' };
const expense = (id: string, amount: number, date: string, category = 'Food'): FinanceTransaction => ({ id, type: 'expense', amount, category, date, merchant: id });

describe('calculateDashboardMetrics', () => {
  it('uses current-month expenses and excludes income and adjacent months', () => {
    const metrics = calculateDashboardMetrics([
      expense('current', 300, '2026-09-15'),
      expense('previous', 100, '2026-08-31'),
      { ...expense('income', 900, '2026-09-10'), type: 'income' },
    ], budget, new Date(2026, 8, 20));
    expect(metrics.currentMonthSpend).toBe(300);
    expect(metrics.previousMonthSpend).toBe(100);
  });

  it('handles zero previous month without Infinity', () => {
    const metrics = calculateDashboardMetrics([expense('new', 200, '2026-09-01')], budget, new Date(2026, 8, 2));
    expect(metrics.monthComparison).toMatchObject({ percentageDelta: null, direction: 'new-spend' });
  });

  it('returns six chronological zero-filled months across year boundaries', () => {
    const metrics = calculateDashboardMetrics([expense('dec', 50, '2025-12-10')], budget, new Date(2026, 1, 10));
    expect(metrics.sixMonthTrend).toHaveLength(6);
    expect(metrics.sixMonthTrend.map((point) => point.label)).toEqual(['Sept', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']);
    expect(metrics.sixMonthTrend.find((point) => point.label === 'Dec')?.amount).toBe(50);
  });

  it('calculates category shares, limits, average and projection', () => {
    const metrics = calculateDashboardMetrics([expense('a', 400, '2026-09-10'), expense('b', 100, '2026-09-11', 'Travel')], budget, new Date(2026, 8, 20));
    expect(metrics.highestCategory).toMatchObject({ category: 'Food', amount: 400, percentage: 80, limitUsedPercentage: 80 });
    expect(metrics.averageDailySpend).toBe(25);
    expect(metrics.projectedMonthSpend).toBe(750);
  });

  it('zero-fills Monday-to-Sunday current week', () => {
    const metrics = calculateDashboardMetrics([expense('fri', 100, '2026-09-25')], budget, new Date(2026, 8, 26));
    expect(metrics.currentWeek).toHaveLength(7);
    expect(metrics.currentWeek[0].label).toBe('Mon');
    expect(metrics.currentWeek[4].amount).toBe(100);
  });

  it('groups every week intersecting the month for pagination', () => {
    const metrics = calculateDashboardMetrics([
      expense('early', 100, '2026-09-01'),
      expense('late', 200, '2026-09-26'),
    ], budget, new Date(2026, 8, 26));
    expect(metrics.monthWeeks.length).toBeGreaterThanOrEqual(4);
    expect(metrics.monthWeeks.flatMap((week) => week.days).find((day) => day.date === '2026-09-01')?.amount).toBe(100);
    expect(metrics.monthWeeks.flatMap((week) => week.days).find((day) => day.date === '2026-09-26')?.amount).toBe(200);
    expect(metrics.monthWeeks.every((week) => week.days.length === 7)).toBe(true);
  });

  it('prioritizes budget/category warnings and detects unusual transactions deterministically', () => {
    const transactions = [expense('large', 500, '2026-09-01'), ...Array.from({ length: 5 }, (_, index) => expense(`small-${index}`, 70, `2026-09-0${index + 2}`))];
    const metrics = calculateDashboardMetrics(transactions, budget, new Date(2026, 8, 10));
    expect(metrics.insights.map((item) => item.code)).toEqual(expect.arrayContaining(['BUDGET_WARNING', 'CATEGORY_EXCEEDED', 'UNUSUAL_TRANSACTION']));
    expect(metrics.insights[0].code).toBe('CATEGORY_EXCEEDED');
  });

  it('prioritizes a monthly budget exceeded insight', () => {
    const metrics = calculateDashboardMetrics([expense('large', 1200, '2026-09-10', 'Other')], budget, new Date(2026, 8, 20));
    expect(metrics.insights[0].code).toBe('BUDGET_EXCEEDED');
  });

  it('warns when projected pace exceeds budget before 80 percent is used', () => {
    const metrics = calculateDashboardMetrics([expense('pace', 700, '2026-09-05', 'Other')], budget, new Date(2026, 8, 10));
    expect(metrics.insights.some((item) => item.code === 'SPENDING_PACE')).toBe(true);
  });

  it('distinguishes no-budget and within-budget states', () => {
    const noBudget = calculateDashboardMetrics([expense('a', 100, '2026-09-10')], { ...budget, monthlyLimit: null, categoryLimits: [] }, new Date(2026, 8, 20));
    const withinBudget = calculateDashboardMetrics([expense('b', 100, '2026-09-10', 'Other')], { ...budget, categoryLimits: [] }, new Date(2026, 8, 20));
    expect(noBudget.insights.some((item) => item.code === 'NO_BUDGET')).toBe(true);
    expect(withinBudget.insights.some((item) => item.code === 'WITHIN_BUDGET')).toBe(true);
  });

  it('reports up, down, and unchanged month comparison directions', () => {
    const up = calculateDashboardMetrics([expense('previous', 100, '2026-08-10'), expense('current', 200, '2026-09-10')], budget, new Date(2026, 8, 20));
    const down = calculateDashboardMetrics([expense('previous', 200, '2026-08-10'), expense('current', 100, '2026-09-10')], budget, new Date(2026, 8, 20));
    const unchanged = calculateDashboardMetrics([expense('previous', 100, '2026-08-10'), expense('current', 100, '2026-09-10')], budget, new Date(2026, 8, 20));
    expect(up.monthComparison.direction).toBe('up');
    expect(down.monthComparison.direction).toBe('down');
    expect(unchanged.monthComparison.direction).toBe('unchanged');
  });

  it('returns useful empty state and does not mutate inputs', () => {
    const transactions: FinanceTransaction[] = [];
    const copy = [...transactions];
    const metrics = calculateDashboardMetrics(transactions, { ...budget, monthlyLimit: null }, new Date(2026, 8, 1));
    expect(metrics.insights[0].code).toBe('NO_DATA');
    expect(transactions).toEqual(copy);
  });
});
