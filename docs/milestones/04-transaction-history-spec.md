# Milestone 4 — Transaction & History Completeness

## Metadata

| Field | Value |
|---|---|
| Status | Authoritative implementation specification |
| Target branch | `feature/v1-transaction-history` |
| Base branch | Latest `develop` after Milestone 3 |
| Depends on | Priority 1 UI, Milestone 2 Expense CRUD, Milestone 3 Signup Persistence |
| Required before | Milestone 6 Dynamic Dashboard & Deterministic Insights |
| Product version | V1 — Track |

## 1. Objective

Make transaction history truthful before analytics are calculated. Every persisted record must explicitly identify whether it is an `expense` or `income`, while existing records without a type remain valid and behave as expenses. Users must be able to inspect a transaction without entering edit mode and filter history by type, category, and date.

The existing `/expenses` route and `ExpenseService` naming remain in place for V1 to avoid an unrelated API rename. The endpoint will hold both supported transaction types as a backward-compatible extension of the current model.

## 2. Scope

### In scope

- Add explicit transaction type: `expense` or `income`.
- Default legacy JSON records without `type` to `expense` when read.
- Validate and persist `type` through create and update operations.
- Preserve authenticated user ownership for every CRUD operation.
- Add type selection to create/edit UI.
- Add a read-only transaction detail route.
- Add explicit type, category, and inclusive date-range filtering to `/history`.
- Add truthful expense, income, and net totals.
- Add a first-transaction empty state and CTA.
- Retain the established visual design and accessibility conventions.

### Out of scope

- Renaming `/expenses` to `/transactions`.
- Database, ORM, or schema migration framework.
- Docker or deployment work.
- bcrypt, Argon2, password hashing, or authentication redesign.
- Recurring transactions, transfers, refunds, CSV import/export, pagination, bank synchronization, or automated ingestion.
- AI, LLM calculations, or V2/V3 functionality.
- External UI component libraries.

## 3. Authoritative data contracts

### 3.1 Shared transaction type

```ts
export enum TransactionType {
  Expense = 'expense',
  Income = 'income',
}
```

### 3.2 Persisted expense record

```ts
export interface Expense {
  id: string;
  userId: number;
  type: TransactionType;
  amount: number;
  category: string;
  merchant: string;
  date: string;
  note?: string;
  createdAt: string;
}
```

Contract rules:

- `id` remains a UUID.
- `userId` always comes from the validated JWT, never from a request body.
- `amount` is greater than zero for both expenses and income.
- `date` is an ISO calendar date accepted by `@IsDateString()`.
- `category` and `merchant` are non-empty strings.
- `note` is optional.
- `createdAt`, `id`, and `userId` cannot be changed by PATCH.
- `type` defaults to `expense` only when reading a legacy record where the field is absent. New requests must send it explicitly.

### 3.3 JSON schema

`backend/data/expenses.json` remains a JSON array:

```json
[
  {
    "id": "2876f830-1c4e-4d14-9e2e-79c24e739bb0",
    "userId": 12,
    "type": "expense",
    "amount": 1250,
    "category": "Food & Dining",
    "merchant": "Example Merchant",
    "date": "2026-09-25",
    "note": "Dinner",
    "createdAt": "2026-09-25T18:00:00.000Z"
  },
  {
    "id": "ac1df764-e905-4117-8e3e-39c2a30c235e",
    "userId": 12,
    "type": "income",
    "amount": 50000,
    "category": "Salary",
    "merchant": "Employer",
    "date": "2026-09-01",
    "createdAt": "2026-09-01T09:00:00.000Z"
  }
]
```

Runtime JSON is local development data. It must not be treated as production storage.

### 3.4 Backward-compatible normalization

All service reads must normalize parsed records before filtering or returning them:

```ts
function normalizeExpense(record: Omit<Expense, 'type'> & { type?: TransactionType }): Expense {
  return {
    ...record,
    type: record.type ?? TransactionType.Expense,
  };
}
```

The service must not rewrite the entire file merely because a legacy record was read. The next successful create/update/delete may persist the normalized collection.

## 4. Backend API contract

All routes remain protected by `JwtAuthGuard`.

| Method | Route | Behavior |
|---|---|---|
| `POST` | `/expenses` | Create an expense or income owned by authenticated user |
| `GET` | `/expenses` | Return only authenticated user's normalized records |
| `GET` | `/expenses/:id` | Return one owned normalized record or 404 |
| `PATCH` | `/expenses/:id` | Partially update an owned record, including type |
| `DELETE` | `/expenses/:id` | Remove one owned record or return 404 |

No endpoint may accept `userId` from the client.

### 4.1 Create DTO

```ts
export class CreateExpenseDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsString()
  @MinLength(1)
  merchant!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
```

### 4.2 Update DTO

```ts
export class UpdateExpenseDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  merchant?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
```

### 4.3 Error behavior

- Invalid or absent create `type`: `400 Bad Request`.
- Invalid update `type`: `400 Bad Request`.
- Missing record: `404 Not Found`.
- Record owned by another user: `404 Not Found`; do not reveal its existence.
- Malformed/missing store: preserve current local-development behavior of treating it as an empty collection.

## 5. Frontend architecture

### 5.1 Frontend interface

```ts
export type TransactionType = 'expense' | 'income';

export interface Expense {
  id: string;
  userId: number;
  type: TransactionType;
  amount: number;
  category: string;
  merchant: string;
  date: string;
  note?: string;
  createdAt: string;
}
```

`CreateExpensePayload` requires `type`; `UpdateExpensePayload` makes it optional.

### 5.2 Create and edit form

- Provide an accessible `expense`/`income` segmented control or select.
- Default a new record to `expense`.
- Existing records load their persisted type; legacy records display as expense.
- Expense categories retain the established V1 list.
- Income supports at least `Salary`, `Freelance`, `Refund`, and `Other`.
- Changing type must not silently preserve an incompatible category; select the first valid category for the chosen type.
- Button labels may remain `Save transaction`/`Update transaction`; avoid redesigning the page.

### 5.3 Read-only detail route

Add protected route:

```text
/history/:id
```

The detail component must:

- Call `ExpenseService.getById(id)`.
- Display type, amount, category, merchant/source, transaction date, note, and creation timestamp.
- Provide Edit and Back to history actions.
- Never expose a delete action without the existing confirmation behavior.
- Render loading, not-found, and generic error states.
- Use semantic definition-list or clearly labeled content.

### 5.4 History filtering contract

History uses client-side Signals over the authenticated user's returned collection:

```ts
export interface HistoryFilters {
  type: 'all' | TransactionType;
  category: string | null;
  from: string | null;
  to: string | null;
}
```

Filter rules:

- Type, category, and date filters combine with logical AND.
- `from` and `to` are inclusive ISO calendar dates.
- `null` means no constraint.
- Invalid date ranges must produce a visible validation message rather than silently returning no records.
- Totals shown above history are calculated from the complete loaded collection, not the filtered subset, unless explicitly labeled “Filtered total.”
- Net activity is `totalIncome - totalExpenses`.

### 5.5 Empty state

When the authenticated user has no records, show:

- Heading: `Start tracking your first transaction.`
- Supporting text: `Your monthly journey starts here.`
- Primary CTA linking to `/expenses/new`.

When filters return no matches, show a separate `No transactions match these filters` state with a clear-filters action.

## 6. Acceptance criteria

- [ ] Every newly persisted record includes valid `type`.
- [ ] Legacy records without `type` are returned as expenses without crashing.
- [ ] Expense and income totals are derived from actual record types.
- [ ] History never labels every API record as debit unconditionally.
- [ ] Type, category, and inclusive date filtering work together.
- [ ] A read-only detail route is protected and ownership-safe.
- [ ] Create, edit, detail, and delete retain authenticated isolation.
- [ ] Existing expense CRUD behavior remains compatible.
- [ ] Empty account and no-filter-match states follow the design system.
- [ ] No database, ORM, AI, or external UI library is introduced.

## 7. Verification plan

### 7.1 Backend Jest scenarios

- Create and persist expense type.
- Create and persist income type.
- Reject missing/invalid type.
- Normalize legacy record without type to expense.
- List returns only requesting user's normalized records.
- GET/PATCH/DELETE deny cross-user access.
- PATCH changes type and preserves immutable fields.
- Existing malformed/missing-store behavior remains covered.

### 7.2 Frontend Vitest scenarios

- Form defaults to expense.
- Type switch updates valid category options.
- Create and update payloads include type.
- History totals separate expense and income.
- Type/category/date filters combine correctly.
- Invalid date range shows an error.
- Legacy record displays as expense.
- Detail renders all fields and error states.
- Empty and no-match states render correct CTAs.

### 7.3 Playwright journeys

1. Signup and login.
2. Create an expense and an income.
3. Verify truthful totals and color treatments.
4. Filter by expense, income, category, and date.
5. Open read-only detail, then edit and return.
6. Login as a second user and verify the first user's records are absent.
7. Verify direct navigation to another user's ID returns a safe not-found state.

### 7.4 Required commands

```bash
cd backend && npm test
cd backend && npm run build
cd frontend && npm test -- --watch=false
cd frontend && npm run build
cd frontend && npx playwright test
```

## 8. Definition of done

Milestone 4 is complete only when all acceptance criteria are implemented, all required commands pass, existing signup and expense E2E journeys remain intact, the diff is limited to transaction/history scope, and the feature branch is ready for PR review against `develop`.
