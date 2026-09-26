# Milestone 6 — Dynamic Dashboard & Deterministic Insights

## Metadata

| Field | Value |
|---|---|
| Status | Implemented and verified |
| Target branch | `feature/v1-dynamic-insights` |
| Base branch | Latest `develop` after Milestone 5 is merged |
| Depends on | Milestone 4 explicit transaction type; Milestone 5 persisted budget |
| Required before | Milestone 8 UX/Accessibility Hardening and Milestone 9 Release Readiness |
| Product version | V1 — Track |

## 1. Objective

Replace every static spending value, chart series, category total, comparison, and insight banner on `/dashboard` and `/insights` with deterministic values calculated from the authenticated user's transactions and budget. Dashboard and Insights must share one calculation layer so identical financial concepts cannot drift between pages.

All calculations are local application logic. V1 has zero LLM, AI provider, conversational assistant, or generated financial advice dependency.

## 2. Scope

### In scope

- Current-month expense aggregation.
- Previous-month comparison with explicit zero-division behavior.
- Six-month expense trend grouped by calendar month.
- Current-month category totals, shares, and highest category.
- Current-month average daily spending.
- Current-week daily spending and Monday–Sunday pagination across every week intersecting the current month.
- Budget used, remaining, and projected pace.
- Deterministic budget, category, pace, and unusual-transaction alerts.
- Shared pure calculation utilities under `frontend/src/app/core/finance/`.
- Shared Signal-based metrics facade/store consumed by Dashboard and Insights.
- Dynamic accessible chart labels.
- Empty, insufficient-data, and API-error states.
- Removal of hardcoded demonstration values and AI-promissory banner text.

### Out of scope

- LLMs, AI SDKs, model calls, prompt engineering, or conversational UI.
- Forecasting beyond the exact deterministic pace formula in this specification.
- Financial advice, debt inference, credit scoring, or investment guidance.
- Backend analytics endpoints, data warehouse, database, ORM, or pagination.
- Docker/deployment changes.
- bcrypt, Argon2, password hashing, or authentication redesign.
- External charting or UI libraries.

## 3. Authoritative input contracts

This milestone adds no backend DTO and no persisted JSON schema. It consumes the normalized Milestone 4 transaction records and Milestone 5 budget records without changing those persistence contracts.

The calculation layer accepts normalized Milestone 4 transactions and Milestone 5 budget configuration.

```ts
export type TransactionType = 'expense' | 'income';

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
  categoryLimits: Array<{
    category: string;
    limit: number;
  }>;
  currency: 'INR' | 'USD' | 'EUR';
}
```

Input rules:

- Only records with `type === 'expense'` contribute to spending metrics.
- Income is never subtracted from spending to make a budget appear healthier.
- Transaction `date` is parsed as a local calendar date from `YYYY-MM-DD`; do not parse it as UTC and shift the date.
- Invalid dates or non-finite/non-positive amounts are excluded defensively from calculations, even though DTO validation should prevent them.
- Functions never mutate input arrays.

## 4. Shared frontend architecture

### 4.1 Required structure

```text
frontend/src/app/core/finance/
├── finance-calculations.ts
├── finance-calculations.spec.ts
├── finance-metrics.store.ts
├── finance-metrics.store.spec.ts
└── finance-models.ts
```

Dashboard and Insights components may format values for display, but must not duplicate aggregation formulas.

### 4.2 Metrics contract

```ts
export type DeltaDirection = 'up' | 'down' | 'unchanged' | 'new-spend';

export interface MonthComparison {
  current: number;
  previous: number;
  absoluteDelta: number;
  percentageDelta: number | null;
  direction: DeltaDirection;
}

export interface TrendPoint {
  year: number;
  month: number;
  label: string;
  amount: number;
}

export interface CategoryMetric {
  category: string;
  amount: number;
  percentage: number;
  limit: number | null;
  limitUsedPercentage: number | null;
}

export interface DailyMetric {
  date: string;
  label: string;
  amount: number;
}

export interface WeekMetric {
  startDate: string;
  endDate: string;
  label: string;
  days: DailyMetric[];
}

export type InsightSeverity = 'positive' | 'info' | 'warning' | 'critical';

export type InsightCode =
  | 'NO_DATA'
  | 'NO_BUDGET'
  | 'WITHIN_BUDGET'
  | 'SPENDING_PACE'
  | 'BUDGET_WARNING'
  | 'BUDGET_EXCEEDED'
  | 'CATEGORY_WARNING'
  | 'CATEGORY_EXCEEDED'
  | 'UNUSUAL_TRANSACTION';

export interface DeterministicInsight {
  code: InsightCode;
  severity: InsightSeverity;
  title: string;
  message: string;
  value?: number;
  category?: string;
  transactionId?: string;
}

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
```

### 4.3 Store contract

```ts
export type MetricsStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class FinanceMetricsStore {
  readonly status: Signal<MetricsStatus>;
  readonly metrics: Signal<DashboardMetrics | null>;
  readonly errorMessage: Signal<string | null>;

  load(referenceDate?: Date): void;
  refresh(referenceDate?: Date): void;
  clear(): void;
}
```

The store composes `ExpenseService.list()` and `BudgetStore`. It owns loading/error coordination and exposes one metrics object to both Dashboard and Insights. Logging out must clear user-specific in-memory data.

## 5. Calculation specifications

All calculations accept an explicit `referenceDate` for deterministic testing. Runtime calls use the user's current local date.

### 5.1 Current-month spend

```ts
currentMonthSpend = sum(
  transaction.amount
  where transaction.type === 'expense'
  and transaction.date is within referenceDate's local calendar month
)
```

Boundaries are inclusive from the first through last calendar day of the month.

### 5.2 Previous-month spend and comparative delta

Previous month uses the complete preceding local calendar month, including year rollover from January to December.

```ts
absoluteDelta = currentMonthSpend - previousMonthSpend
```

Percentage rules:

- Previous > 0: `((current - previous) / previous) * 100`, rounded to nearest integer for display.
- Previous = 0 and current = 0: percentage `0`, direction `unchanged`.
- Previous = 0 and current > 0: percentage `null`, direction `new-spend`; display `Spending started this month`, never `Infinity%`.
- Current < previous: direction `down`.
- Current > previous: direction `up`.
- Equal positive values: direction `unchanged`.

### 5.3 Six-month trend

- Return exactly six points in chronological order, ending with the reference month.
- Include months with no expenses as amount `0`.
- Handle year boundaries.
- Include expenses only.
- Labels use localized short month names in presentation; aggregation uses numeric year/month keys.

### 5.4 Category breakdown

For current-month expenses:

```ts
categoryAmount = sum(expense.amount for category)
percentage = currentMonthSpend > 0
  ? (categoryAmount / currentMonthSpend) * 100
  : 0
```

- Sort descending by amount, then ascending by category for stable ties.
- Round display percentages to the nearest integer; preserve unrounded amounts.
- `highestCategory` is the first sorted category or `null` when no expenses exist.
- Attach matching category limit and limit percentage from `FinanceBudget`.

### 5.5 Average daily spend

```ts
daysElapsed = referenceDate.getDate()
averageDailySpend = currentMonthSpend / daysElapsed
```

- Round only at display time.
- Never divide by a fixed day count.
- On the first day, divisor is `1`.

### 5.6 Weekly daily spending and month pagination

- Every week runs Monday through Sunday and contains exactly seven chronological points.
- `currentWeek` identifies the week containing the reference date.
- `monthWeeks` returns every Monday–Sunday week that intersects the reference month, in chronological order.
- Days outside the reference month remain visible at month edges but have amount `0`; only spending within the selected month contributes.
- Zero-fill days without expenses.
- Include only expense transactions.
- Handle week boundaries crossing month or year.
- Insights provides Previous/Next controls, current position, selected date range, and selected-week total.
- Chart containers use a definite height so percentage-height bars remain visible.

### 5.7 Budget metrics and projection

When `monthlyLimit === null`:

- `budgetRemaining`, `budgetUsedPercentage` are `null`.
- Projection remains calculable but cannot generate budget threshold alerts.

When budget exists:

```ts
budgetRemaining = monthlyLimit - currentMonthSpend
budgetUsedPercentage = (currentMonthSpend / monthlyLimit) * 100
projectedMonthSpend = averageDailySpend * daysInMonth
```

Progress bars cap visual width at 100%, but text and alert logic use the true percentage.

## 6. Deterministic insight rules

Rules are evaluated with this strict priority:

1. `BUDGET_EXCEEDED`
2. `CATEGORY_EXCEEDED`
3. `BUDGET_WARNING`
4. `CATEGORY_WARNING`
5. `SPENDING_PACE`
6. `UNUSUAL_TRANSACTION`
7. `NO_BUDGET`
8. `WITHIN_BUDGET`
9. `NO_DATA`

The UI may show the highest-priority banner plus a list of additional distinct insights. Identical codes/categories must not be duplicated.

### Exact rules

- `NO_DATA`: current month has no expense transactions.
- `NO_BUDGET`: spending exists and monthly budget is null.
- `BUDGET_EXCEEDED`: current spend > monthly limit.
- `BUDGET_WARNING`: current spend is between 80% and 100% of monthly limit, inclusive at 80 and 100.
- `SPENDING_PACE`: budget exists, current spend < 80% of limit, and projected month spend > monthly limit.
- `CATEGORY_EXCEEDED`: category spend > configured category limit.
- `CATEGORY_WARNING`: category spend is between 80% and 100% of its configured limit.
- `UNUSUAL_TRANSACTION`: at least five current-month expenses exist and one transaction amount is greater than twice the mean current-month expense amount. Report the largest qualifying transaction only.
- `WITHIN_BUDGET`: budget exists, spending exists, no higher-priority budget/category/pace rule applies.

Messages must state observed facts and formulas in user language. They must not imply debt, future certainty, or professional financial advice.

## 7. UI integration contract

### Dashboard

- Hero: current-month spend and persisted budget metrics.
- Insight banner: highest-priority deterministic insight directly below Hero.
- Trend: dynamic six-month points.
- Recent activity: remains live transaction data; expense/income styling comes from Milestone 4.
- API failure: visible retry state, not silent empty data.

### Insights

- Summary cards: current spend, budget remaining, average daily.
- Month comparison: dynamic and zero-safe.
- Weekly chart: dynamic seven-day points with Previous/Next pagination across the current month.
- Category breakdown: dynamic sorted values and accessible percentages.
- New account: useful empty state with add-transaction and set-budget CTAs.

### Accessibility

- Every chart has a concise overall `aria-label`.
- Every focusable bar announces weekday, calendar date, and formatted amount.
- Hover and keyboard focus reveal a `role="tooltip"` containing the weekday/date and `Spent <currency><amount>`; the bar references it through `aria-describedby`.
- Progress bars expose actual percentages through `aria-valuenow`; values over 100 use `aria-valuetext` while `aria-valuemax` remains 100.
- Color is never the only warning indicator.
- Reduced-motion implementation is finalized in Milestone 8.

## 7.1 Implemented architecture and verification evidence

The contracts above remain authoritative. The following inventory records the verified implementation as of 2026-09-26.

### Shared calculation layer

| Contract | Implementation |
|---|---|
| Finance input/output models | `frontend/src/app/core/finance/finance-models.ts` |
| Pure deterministic calculations | `frontend/src/app/core/finance/finance-calculations.ts` |
| Calculation edge-case tests | `frontend/src/app/core/finance/finance-calculations.spec.ts` |
| Shared Signal metrics facade | `frontend/src/app/core/finance/finance-metrics.store.ts` |
| Store load/error/clear tests | `frontend/src/app/core/finance/finance-metrics.store.spec.ts` |

The calculation suite directly verifies current/previous month boundaries, income exclusion, zero previous month, up/down/unchanged comparisons, six-month year rollover and zero filling, category shares and limits, elapsed-day averages, projections, Monday–Sunday weekly data, month-week pagination, edge zero filling, budget exceeded, budget warning, spending pace, category exceeded/warning, unusual transaction detection, no-budget, within-budget, empty state, and input immutability.

### UI integration

| Surface | Implementation |
|---|---|
| Dashboard shared metrics consumption | `frontend/src/app/features/dashboard/dashboard.ts` and `dashboard.html` |
| Dynamic six-month trend | `frontend/src/app/features/dashboard/components/spending-trend/` |
| Deterministic Intelligence banner | `frontend/src/app/features/dashboard/components/insight-banner/` |
| Dynamic Insights summary/week/categories | `frontend/src/app/features/insights/insights.ts` and `insights.html` |
| Mutation-driven refresh | `frontend/src/app/features/expenses/new-expense/new-expense.ts` and `frontend/src/app/features/history/history.ts` |
| Logout state clearing | `frontend/src/app/features/profile/profile.ts` |

No hardcoded demonstration spend, previous-month, weekly, trend, category, or insight values remain. No AI/LLM provider, generated recommendation, backend analytics endpoint, chart library, database, or ORM was introduced.

### Verification evidence

- Backend Jest: 11 suites, 80 tests passed.
- Backend NestJS build: passed.
- Frontend Vitest: Insights coverage includes month-week grouping, week navigation, and weekday/date/spend tooltip content; the final full-suite count is recorded by the latest verification run.
- Frontend production/SSR build: passed; 4 public routes prerendered.
- Playwright: 8 journeys passed; the dynamic journey verifies previous-month/current-month values, income exclusion, six-month trend, category breakdown, deterministic insight, visible yesterday/today daily bars, week navigation, and new-account empty state.
- Static-value scan: no prior demonstration constants or AI-promissory banner copy remain under `frontend/src/app`.
- Runtime `expenses.json` changes generated by tests were removed from the feature diff.
- Non-blocking build warning: initial frontend bundle is 517.41 kB, 17.41 kB above the configured 500 kB warning threshold.

## 8. Acceptance criteria

- [x] No hardcoded monthly spend, prior spend, trend, weekly, category, or insight values remain.
- [x] No fixed ₹30,000 fallback remains.
- [x] Current-month totals exclude prior months and income.
- [x] Previous-month comparison never displays NaN or Infinity.
- [x] Trend returns six chronological zero-filled months.
- [x] Category shares and top category come from actual records.
- [x] Average daily spend uses actual elapsed days.
- [x] Alert rules match this specification exactly.
- [x] Dashboard and Insights consume one shared metrics layer.
- [x] Empty, no-budget, insufficient-data, and API-error states are explicit.
- [x] No LLM, AI service, external chart library, database, ORM, Docker, or auth redesign is introduced.

## 9. Verification plan

### 9.1 Vitest calculation scenarios

- Current-month inclusion and adjacent-month exclusion.
- January/December rollover.
- Income exclusion.
- Zero and nonzero previous month combinations.
- Six-month zero filling and ordering.
- Category sorting, ties, and zero totals.
- First-day and later-day averages.
- Monday/Sunday week boundaries.
- No budget, 79%, 80%, 100%, and over-100% thresholds.
- Projected pace warning.
- Category warning/exceeded rules.
- Anomaly minimum sample and two-times-mean boundary.
- No input mutation.

### 9.2 Vitest component/store scenarios

- One shared load for Dashboard/Insights.
- Loading, error, empty, and retry states.
- Dynamic Hero/trend/banner bindings.
- Dynamic category and weekly chart labels.
- Store clear on logout/user change.

### 9.3 Playwright journeys

1. Create dated expense and income records.
2. Set a budget and category limit.
3. Verify current-month Hero total excludes income/prior month.
4. Verify trend and category values update from records.
5. Verify zero-previous-month language.
6. Trigger warning and over-budget states.
7. Verify yesterday/today expenses render visible daily bars in the selected current week.
8. Page to a previous week and back using accessible Previous/Next controls.
9. Verify a new account sees deterministic empty states.

### 9.4 Required commands

```bash
cd backend && npm test
cd backend && npm run build
cd frontend && npm test -- --watch=false
cd frontend && npm run build
cd frontend && npx playwright test
```

## 10. Definition of done

Milestone 6 is complete only when all static financial demonstrations are replaced by shared deterministic calculations, every formula and edge case is covered, all existing journeys remain green, and no V2/V3 capability or out-of-scope dependency enters the diff.
