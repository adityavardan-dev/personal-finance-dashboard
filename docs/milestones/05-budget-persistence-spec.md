# Milestone 5 — Persisted Budget Foundation

## Metadata

| Field | Value |
|---|---|
| Status | Implemented and verified |
| Target branch | `feature/v1-budget-persistence` |
| Base branch | Latest `develop` after Milestone 4 is merged |
| Depends on | Milestone 3 authenticated identity; Milestone 4 transaction semantics |
| Required before | Milestone 6 Dynamic Dashboard & Deterministic Insights |
| Product version | V1 — Track |

## 1. Objective

Eliminate the hardcoded ₹30,000 demonstration budget and provide authenticated, per-user budget persistence using the existing local JSON development architecture. A user can set or clear an overall monthly limit, configure optional per-category limits, and select the currency used to display V1 values.

## 2. Scope

### In scope

- Add `backend/data/budgets.json` local persistence.
- Add an authenticated `BudgetsModule`.
- Add `GET /budgets/me` and `PUT /budgets/me`.
- Persist one budget record per authenticated `userId`.
- Support an overall monthly limit and optional category limits.
- Support V1 currency codes INR, USD, and EUR.
- Add budget setup/edit UI using the existing design system.
- Add a Signal-based frontend budget store shared by Dashboard and Insights.
- Add no-budget and over-budget presentation states.
- Preserve user isolation and missing/malformed store handling.

### Out of scope

- Database, ORM, cloud persistence, or migration framework.
- Docker or deployment architecture.
- bcrypt, Argon2, password hashing, or authentication redesign.
- Foreign-exchange conversion or historical exchange rates.
- Recurring budgets, rollover, shared/family budgets, bank balances, income forecasting, or automated recommendations.
- LLMs, AI-generated budgets, or V2/V3 functionality.
- External UI component libraries.

## 3. Authoritative data contracts

### 3.1 Supported currencies

```ts
export enum CurrencyCode {
  INR = 'INR',
  USD = 'USD',
  EUR = 'EUR',
}
```

Display symbols are presentation metadata, not persisted amounts:

```ts
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
};
```

V1 never converts an amount when currency changes. All existing numeric values are interpreted in the selected currency, and the UI must explain this before a user changes currency.

### 3.2 Category budget limit

```ts
export interface CategoryBudgetLimit {
  category: string;
  limit: number;
}
```

Rules:

- `category` is a trimmed non-empty category label.
- Category names are unique within one budget record using case-sensitive labels from the established category list.
- `limit` is greater than zero.
- A missing category means no limit for that category.

### 3.3 Persisted budget record

```ts
export interface Budget {
  userId: number;
  monthlyLimit: number | null;
  categoryLimits: CategoryBudgetLimit[];
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}
```

`monthlyLimit: null` is the authoritative no-budget state. Numeric zero is invalid and must not be used as an empty-state sentinel.

### 3.4 JSON schema

`backend/data/budgets.json` is a JSON array with at most one record per user:

```json
[
  {
    "userId": 12,
    "monthlyLimit": 30000,
    "categoryLimits": [
      { "category": "Food & Dining", "limit": 8000 },
      { "category": "Shopping", "limit": 5000 }
    ],
    "currency": "INR",
    "createdAt": "2026-09-25T18:00:00.000Z",
    "updatedAt": "2026-09-25T18:00:00.000Z"
  }
]
```

Runtime JSON files are untracked local development data. `BudgetsService` must create the directory/file on first successful write.

## 4. Backend architecture

### 4.1 Module structure

```text
backend/src/budgets/
├── budgets.controller.ts
├── budgets.controller.spec.ts
├── budgets.module.ts
├── budgets.service.ts
├── budgets.service.spec.ts
└── dto/
    ├── category-budget-limit.dto.ts
    └── upsert-budget.dto.ts
```

`BudgetsController` is protected at controller level by `JwtAuthGuard`. It obtains `userId` only from `req.user.userId`.

### 4.2 Category limit DTO

```ts
export class CategoryBudgetLimitDto {
  @IsString()
  @MinLength(1)
  category!: string;

  @IsNumber()
  @IsPositive()
  limit!: number;
}
```

### 4.3 Upsert DTO

```ts
export class UpsertBudgetDto {
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @IsPositive()
  monthlyLimit!: number | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryBudgetLimitDto)
  categoryLimits!: CategoryBudgetLimitDto[];

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;
}
```

The service additionally rejects duplicate category names with `BadRequestException`.

## 5. Backend API contract

### `GET /budgets/me`

Returns the authenticated user's budget:

```ts
export interface BudgetResponse {
  monthlyLimit: number | null;
  categoryLimits: CategoryBudgetLimit[];
  currency: CurrencyCode;
  createdAt: string | null;
  updatedAt: string | null;
}
```

If no record exists, return `200 OK` with the canonical default rather than `404`:

```json
{
  "monthlyLimit": null,
  "categoryLimits": [],
  "currency": "INR",
  "createdAt": null,
  "updatedAt": null
}
```

The response never exposes another user's `userId`.

### `PUT /budgets/me`

- Creates the authenticated user's record when absent.
- Replaces the mutable budget configuration when present.
- Preserves `createdAt` on update.
- Sets `updatedAt` on every successful write.
- Returns the normalized `BudgetResponse`.
- `monthlyLimit: null` clears the monthly budget but preserves selected currency; category limits must be empty when monthly limit is null.

### Error behavior

- Invalid numeric values, unsupported currency, malformed category limit, duplicate category, or category limits with a null monthly limit: `400 Bad Request`.
- Authentication failure: `401 Unauthorized`.
- Missing/malformed store reads as no budgets for local-development resilience.
- A user can never address another user's budget through route parameters or request fields.

## 6. Frontend architecture

### 6.1 API service

```ts
export interface BudgetConfig {
  monthlyLimit: number | null;
  categoryLimits: CategoryBudgetLimit[];
  currency: CurrencyCode;
  createdAt: string | null;
  updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class BudgetService {
  getMine(): Observable<BudgetConfig>;
  saveMine(payload: UpsertBudgetPayload): Observable<BudgetConfig>;
}
```

Requests rely on the existing auth interceptor. No token is passed explicitly by components.

### 6.2 Signal-based store

Create a root-provided store under `frontend/src/app/core/budget/`:

```ts
export type BudgetLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class BudgetStore {
  readonly budget: Signal<BudgetConfig | null>;
  readonly status: Signal<BudgetLoadStatus>;
  readonly hasBudget: Signal<boolean>;
  readonly monthlyLimit: Signal<number | null>;
  readonly currency: Signal<CurrencyCode>;

  load(): void;
  save(payload: UpsertBudgetPayload): Observable<BudgetConfig>;
}
```

Store rules:

- One HTTP load may be shared by Dashboard and Insights during a session.
- Components read state; they do not duplicate budget HTTP calls or calculations.
- A failed load must not silently substitute ₹30,000.
- Logout/session clearing must not retain the previous user's budget in memory.

### 6.3 Setup and edit UI

Use a focused modal or protected page section within the established shell. The implementation choice must preserve:

- Labeled monthly limit input.
- Currency select with INR, USD, and EUR.
- Optional category-limit rows.
- Add/remove category limit controls with 44px targets.
- Save loading state, field validation, API error state, and success announcement.
- Keyboard focus management if a modal is used: focus enters the modal, remains contained, and returns to the opener.

No external modal/form library may be added.

### 6.4 Dashboard and Insights integration

Milestone 5 replaces fixed budget inputs only; spending trend and insight calculations remain Milestone 6 scope.

Hero and Insights must consume `BudgetStore`:

- `monthlyLimit === null`: show `Set your monthly budget to begin.` and a setup CTA.
- Limit present and remaining positive: emerald progress treatment.
- Limit present and spending at or above 80%: amber warning treatment.
- Spending greater than limit: red over-budget treatment and explicit amount over limit.
- Progress visual uses `min((spent / monthlyLimit) * 100, 100)` while text retains the true percentage.
- Milestone 5 persists category limits and verifies that they survive edits, reloads, and login sessions. Calculating current-month category spending, category warning thresholds, and category overruns belongs to the shared aggregation/rule layer in Milestone 6.

No component may contain a fallback fixed budget constant.

## 6.5 Implemented architecture and verification evidence

This section records the implementation that satisfies the contracts above. The contracts in Sections 3–6 remain authoritative; this inventory must be updated if implementation paths or behavior change.

### Backend implementation

| Contract | Implementation |
|---|---|
| Module registration | `backend/src/budgets/budgets.module.ts`, imported by `backend/src/app.module.ts` |
| Authenticated API | `backend/src/budgets/budgets.controller.ts` exposes `GET /budgets/me` and `PUT /budgets/me` under `JwtAuthGuard` |
| JSON persistence and ownership | `backend/src/budgets/budgets.service.ts` |
| Currency contract | `backend/src/budgets/currency-code.ts` |
| DTO validation | `backend/src/budgets/dto/upsert-budget.dto.ts` and `category-budget-limit.dto.ts` |
| Service tests | `backend/src/budgets/budgets.service.spec.ts` |
| Controller/ownership tests | `backend/src/budgets/budgets.controller.spec.ts` |
| DTO tests | `backend/src/budgets/dto/upsert-budget.dto.spec.ts` |

Verified backend behavior includes canonical empty response, first-write file creation, service-instance restart persistence, per-user isolation, preserved `createdAt`, refreshed `updatedAt`, malformed-store recovery, positive numeric validation, supported currencies, trimmed non-empty category names, duplicate-category rejection, and rejection of category limits when the monthly budget is cleared.

### Frontend implementation

| Contract | Implementation |
|---|---|
| Shared interfaces and currency symbols | `frontend/src/app/core/budget/budget.models.ts` |
| Authenticated HTTP client | `frontend/src/app/core/budget/budget.service.ts` |
| Shared Signal store | `frontend/src/app/core/budget/budget.store.ts` |
| Setup/edit UI | `frontend/src/app/features/budgets/budget-editor/` |
| Dashboard composition | `frontend/src/app/features/dashboard/dashboard.ts` and `dashboard.html` |
| Hero no-budget/progress/warning/over-budget UI | `frontend/src/app/features/dashboard/components/hero-card/` |
| Insights budget consumption | `frontend/src/app/features/insights/insights.ts` and `insights.html` |
| Logout state clearing | `frontend/src/app/features/profile/profile.ts` |
| SSR/session-compatible authenticated routes | `frontend/src/app/app.routes.server.ts` |

The `Set budget` control emits an in-page setup event and never navigates. Authenticated routes use client rendering so refresh/direct navigation can read the browser `sessionStorage` token. Dashboard spacing treats the budget editor as a block-level card. Hero and Insights provide explicit amber alerts at 80–100% usage and red exceeded-budget alerts above 100%, with text and ARIA semantics in addition to color.

### Verification evidence — 2026-09-26

- Backend Jest: 11 suites, 80 tests passed, including whitespace-only category rejection and service-instance restart persistence.
- Frontend Vitest: 18 files, 93 tests passed, including Hero warning, exceeded, and non-navigation setup behavior.
- Backend NestJS build: passed.
- Frontend production/SSR build: passed; authenticated routes are client-rendered and 4 public routes are prerendered.
- Playwright: 7 journeys passed, including budget setup, edit, category persistence, 85% warning, over-budget state, same-user relogin persistence, and second-user isolation.
- Browser-preview regression: existing Gmail-style account login followed by `Set budget` remains on `/dashboard`, retains the token, and exposes the budget form.
- Runtime `budgets.json` remains ignored local data; `expenses.json` runtime changes are not part of the feature diff.

### Explicit Milestone 6 boundary

Milestone 5 persists category limits and verifies their validation and persistence. It does not calculate category spending usage. Current-month category aggregation, category warning thresholds, category overruns, dynamic spending trends, and deterministic insight rules remain governed by `06-dynamic-dashboard-insights-spec.md`.

## 7. Acceptance criteria

- [x] `budgets.json` is created on first successful save and survives service/process restarts.
- [x] Each authenticated user has at most one independent budget record.
- [x] GET returns canonical empty state when no record exists.
- [x] PUT validates positive limits and supported currency.
- [x] Cross-user reads or writes are impossible through the API contract.
- [x] Hero and Insights no longer hardcode ₹30,000.
- [x] Budget setup/edit state is accessible and responsive.
- [x] No-budget, warning, and over-budget states are intentional and visible.
- [x] Budget state is cleared or reloaded when the authenticated user changes.
- [x] Existing auth and transaction journeys do not regress.
- [x] No database, ORM, Docker, AI, password architecture, or external UI library is introduced.

## 8. Verification plan

### 8.1 Backend Jest scenarios

- Missing store returns default response.
- Malformed store returns default response.
- Create first budget record.
- Update existing record while preserving `createdAt`.
- Persist/reload across new service instance.
- Reject zero/negative/NaN limits.
- Reject duplicate categories.
- Reject category limits when monthly limit is null.
- User A and user B receive independent values.
- Controller derives user ID from JWT request only.
- Guard is applied at controller level.

### 8.2 Frontend Vitest scenarios

- BudgetService request methods and payloads.
- Store loading, loaded, error, and user-reset states.
- Empty budget CTA.
- Save form validation and API errors.
- Currency symbol mapping.
- Category limit add/remove and duplicate prevention.
- Normal, warning, and over-budget Hero rendering.
- No fixed ₹30,000 fallback remains.

### 8.3 Playwright journeys

1. Signup/login as user A and verify the no-budget empty state.
2. Set a monthly limit, currency, and category limit.
3. Navigate away and back; verify persisted budget and currency values.
4. Edit the monthly limit and verify the category limit remains unchanged.
5. Create spending at 85% of the monthly limit and verify amber warning treatment.
6. Edit the limit below current spending and verify red over-budget treatment and uncapped percentage text.
7. Logout/login as user A; verify monthly/category limits and currency persist.
8. Signup/login as user B and verify user A's budget is absent.
9. Category spending threshold/overrun calculations are verified in Milestone 6, while Milestone 5 verifies category-limit persistence only.

### 8.4 Required commands

```bash
cd backend && npm test
cd backend && npm run build
cd frontend && npm test -- --watch=false
cd frontend && npm run build
cd frontend && npx playwright test
```

## 9. Definition of done

Milestone 5 is complete only when authenticated local persistence, empty/warning/over-budget UI states, isolation tests, unit suites, builds, and Playwright journeys pass; all fixed budget constants are removed; and the feature branch is ready for PR review against `develop`.
