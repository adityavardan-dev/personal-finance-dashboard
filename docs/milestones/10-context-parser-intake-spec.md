# Milestone 10 — Zero-Prompt Context Parser Intake

## Metadata

| Field | Value |
|---|---|
| Status | Deterministic foundation complete - hybrid semantic lane planned |
| Target branch | `feature/v3-context-parser-db` |
| Base branch | `develop` |
| Depends on | Existing JWT authentication and transaction contracts |
| Product version | V3 foundation — deterministic intake only |

## 1. Objective

Convert raw transaction text, natural-language sentences, and common UPI notification text into a typed transaction draft. The default path is deterministic, low-latency TypeScript code. An optional provider-neutral semantic lane may handle complex language, but its output is untrusted, must pass strict validation, and can never persist automatically. A user must review and confirm a draft before any expense or income record is created.

Example input:

```text
Had lunch with flatmates at Meghana ₹1200 split by 3
```

The parser computes a personal amount of `400`, preserves `originalAmount: 1200` and `splitFactor: 3`, recognizes `Food & Dining` and `Meghana`, and requires the user to provide the missing date.

## 2. Scope

### In scope

- Deterministic amount, split, category, merchant, and date extraction.
- Optional AI semantic extraction for unsupported or complex phrasing, behind a feature flag.
- Provider-neutral `SemanticIntentExtractor` interface so hosted and local models can be exchanged.
- AI-generated explanations and clarification suggestions must be grounded in the typed draft.
- Every currency supported by the application: INR (`₹`, `Rs`, `Rs.`, `INR`, `rupee(s)`), USD (`$`, `US$`, `USD`, `dollar(s)`), and EUR (`€`, `EUR`, `euro(s)`).
- Comma-separated amounts and up to two decimal places.
- Split forms `/ 3`, `split by 3`, `split between 3`, `among 3`, and `half`.
- Explicit ISO dates, `today`, `yesterday`, exact relative minutes/hours/days/weeks/months/years, month-first dates such as `Nov 8`, and day-first dates such as `8-Nov-2026`.
- Mandatory clarification when date, amount, or category is absent or ambiguous.
- Authenticated parse endpoint returning a non-persisted draft.
- Ambiguous shared-expense detection and explicit split clarification.
- Responsive Angular intake, clarification, editable draft, and confirmation UI.
- Currency and category reconciliation with the existing application contracts.
- Explicit user confirmation through the existing transaction API.
- Backend HTTP integration tests and frontend unit/Playwright coverage.
- Conversational follow-up rules, multi-transaction clause parsing, and editable accordion drafts.
- Shortened continuation clauses, missing punctuation between repeated verbs, and a curated high-confidence typo dictionary.
- Thirty-minute user-scoped browser-session recovery without Redis or server-side chat state.
- Individual, selected, and all-ready confirmation through an authenticated batch API.

### Out of scope

- Automatic persistence from an LLM response.
- Trusting model arithmetic, database IDs, participant identities, or financial advice.
- Reading device notifications or SMS messages.
- Automatically creating, updating, or deleting transactions.
- Probabilistic merchant classification, currency conversion, or financial advice.
- Automatic acceptance of ambiguous dates, splits, currencies, or categories.

## 3. Parser contract

```ts
export type ParserStatus = 'READY' | 'NEEDS_CLARIFICATION';

export interface ParseResultDto {
  status: ParserStatus;
  draft: {
    amount: number | null;
    currency: 'INR' | 'USD' | 'EUR' | null;
    originalAmount?: number;
    splitFactor?: number;
    category: string | null;
    merchant: string | null;
    date: string | null; // YYYY-MM-DD
    notes: string;
  };
  missingFields: Array<'date' | 'amount' | 'category' | 'split'>;
  clarificationPrompt?: string;
}
```

`originalAmount` is the total amount detected before division. It is the contract field that preserves the raw `totalAmount` concept. `amount` is rounded to two decimal places after deterministic division. `currency` preserves a supported currency explicitly detected in the text. The original text is preserved in `notes`.

If the text contains a bare amount without a currency marker, `currency` is `null`; the confirmation UI may then apply the authenticated user's selected application currency. Multiple conflicting currency/amount candidates require amount clarification. The parser never converts between currencies.

Merchant is optional because a valid transaction may not name one. Date, amount, and category are confirmation requirements. `split` is required only when wording indicates a shared expense but does not state whether the parsed amount is personal or total.

## 4. State machine

```text
RAW_TEXT
   |
   v
PARSE_DETERMINISTICALLY
   |
   +-- date + amount + one category ----------------> READY
   |
   +-- any required value missing/ambiguous --------> NEEDS_CLARIFICATION
                                                         |
                                                         v
                                                USER SUPPLIES VALUE
                                                         |
                                                         v
                                                  RE-EVALUATE DRAFT
                                                         |
                                                         v
                                                       READY
                                                         |
                                                         v
                                              USER CONFIRMS EXPLICITLY
                                                         |
                                                         v
                                          EXISTING TRANSACTION API (later UI)
```

The parser endpoint never transitions directly from `READY` to persistence.

For multi-transaction input, the batch parser first splits repeated transaction clauses and runs this same state machine for every clause. A precise trailing date may be shared across all clauses. Amounts and categories are never combined into one transaction. A continuation such as `and 500 on movies` inherits the previous explicit transaction verb, while repeated verbs can define boundaries even when commas are omitted.

### Mandatory date behavior

- An explicit supported date is normalized to local-calendar `YYYY-MM-DD`.
- `today` and `yesterday` count as explicit user-provided relative dates.
- Exact sub-day expressions such as `half hour ago`, `45 minutes ago`, `15 mins back`, and `2 hours ago` resolve from the browser-supplied reference timestamp in the user's IANA timezone. The resulting local calendar date is used, including when subtraction crosses midnight.
- Numeric relative dates such as `3 days ago`, `2 weeks back`, `4 months ago`, and `1 year back` are exact and resolve against the current local calendar date.
- Day/week arithmetic subtracts calendar days. Month/year arithmetic preserves the local day where possible and clamps to the target month's final valid day (for example, one year before 29 February becomes 28 February in a non-leap year).
- A month/day without a year uses the current local calendar year.
- An impossible date is rejected rather than rolled into another month.
- Multiple distinct supported dates are ambiguous and require date clarification.
- Vague expressions such as `few days ago`, `recently`, `last week`, or `around Nov 8` are not converted into assumed dates.
- If no precise supported date is present, `date` is `null`, status is `NEEDS_CLARIFICATION`, `missingFields` includes `date`, and the response asks: `What exact date should I use for this transaction?`
- The parser must never silently use today's date when no date expression exists.

## 5. Deterministic extraction rules

### 5.1 Amount

Preferred patterns are currency-tagged values using any application-supported currency, in prefix or ISO-code suffix form:

```text
₹1200
₹1,200.50
Rs 1200
Rs. 1,200
INR 1200
1200 INR
$1200
USD 1,200.50
1200 USD
€1200
EUR 1,200.50
1200 EUR
10000 rupees
50 dollars
20 euros
```

If no currency marker exists, contextual forms such as `paid 1200`, `spent 1200`, `amount 1200`, `debited by 1200`, and `received 1200` are supported. A single remaining bare numeric value may be used after supported date and split expressions are removed. Multiple distinct candidate amounts are ambiguous and require amount clarification.

For example, `I spent 3000 on movies today` produces amount `3000`, category `Entertainment`, the explicit relative date, and `currency: null` so the confirmation UI can apply the user's selected application currency.

### 5.2 Split arithmetic

```text
₹1200 / 3
₹1200 split by 3
₹1200 split between 3
₹1200 among 3
₹1200 half
me and Harsha spent 50 dollars
```

Valid numeric factors are integers from 2 through 100. Personal amount is:

```text
roundToTwoDecimals(originalAmount / splitFactor)
```

Invalid factors do not alter the original amount. A split never changes the raw text in `notes`.

An explicitly named pair using `me and <name>` or `<name> and I` deterministically implies two participants and a factor of two. Generic plural language such as `we spent` does not reveal a participant count and requires split clarification.

### 5.3 Category dictionary

The V3 parser emits this taxonomy:

| Category | Representative tokens |
|---|---|
| Food & Dining | breakfast, lunch, dinner, coffee, restaurant, bar, pub, groceries, Swiggy, Zomato |
| Transportation | Uber, Ola, taxi, metro, bus, train, flight, fuel, petrol, parking |
| Shopping | shopping, Amazon, Flipkart, Myntra, clothing, shoes, mall |
| Entertainment | movie, cinema, Netflix, Spotify, concert, gaming, BookMyShow |
| Bills & Utilities | bill, electricity, water bill, internet, broadband, recharge, rent |
| Health & Personal Care | doctor, hospital, medicine, pharmacy, dentist, gym, salon |
| Income | salary, paycheck, freelance, refund, bonus, credited, received payment |
| Other | other, misc, miscellaneous |

Tokens are case-insensitive and matched on boundaries. Exactly one matching category is required for `READY`. No match or matches in multiple categories set `category: null` and require clarification. The parser does not silently default to `Other`.

The existing transaction API uses the older labels `Transport` and `Utilities`. The confirmation UI maps `Transportation` to `Transport`, `Bills & Utilities` to `Utilities`, and `Health & Personal Care` to `Other` before persistence. Income maps to transaction type `income` and uses an existing income category. The UI displays this resolution before confirmation. No automatic persistence bypasses this boundary.

### 5.4 Merchant

Merchant/source extraction recognizes bounded phrases following `at`, `to`, `from`, or `merchant`, stopping before an amount, date, split phrase, or payment-source phrase. Merchant may remain `null` without blocking readiness.

### 5.5 Shared-expense ambiguity

Explicit syntax such as `split by 3`, `/ 3`, or `half` is calculated immediately. An explicitly named pair such as `me and Jaswanth spent 5000` is deterministically divided by two and remains editable before confirmation. Generic wording such as `we spent 5000` signals a shared expense without a participant count; the parser keeps `amount: 5000`, adds `split` to `missingFields`, and asks whether the amount is already personal or is a total to divide.

## 6. API contract

### `POST /parser/parse`

Authentication: required JWT bearer token through the existing `JwtAuthGuard`.

Request:

```json
{
  "text": "Had lunch with flatmates at Meghana ₹1200 split by 3",
  "timeZone": "Asia/Kolkata",
  "referenceTimestamp": "2026-11-09T18:45:00.000Z"
}
```

Constraints: `text` is a non-empty string up to 4,000 characters. `timeZone` is an optional valid IANA timezone and `referenceTimestamp` is an optional ISO timestamp. The Angular client sends both so relative hours/minutes use the user's timestamp and location. Invalid timezones are rejected. For backward compatibility, the server uses its current timestamp when `referenceTimestamp` is omitted. Unknown request properties are rejected by the global validation pipe.

Response:

```json
{
  "status": "NEEDS_CLARIFICATION",
  "draft": {
    "amount": 400,
    "currency": "INR",
    "originalAmount": 1200,
    "splitFactor": 3,
    "category": "Food & Dining",
    "merchant": "Meghana",
    "date": null,
    "notes": "Had lunch with flatmates at Meghana ₹1200 split by 3"
  },
  "missingFields": ["date"],
  "clarificationPrompt": "What exact date should I use for this transaction?"
}
```

The endpoint has no dependency on `ExpensesService` and performs no writes.

### `POST /parser/parse-batch`

The request contract is the same as `/parser/parse`. The endpoint splits supported repeated clauses such as:

```text
spent 350 on food, spent 500 on petrol and spent 50 on sweets today
```

It returns one `ParseResultDto` per clause:

```ts
interface ParseBatchResultDto {
  status: 'READY' | 'NEEDS_CLARIFICATION';
  drafts: ParseResultDto[];
  clarificationPrompt?: string;
}
```

The final precise date applies to all drafts when individual clauses do not contain conflicting dates. The endpoint remains non-destructive.

The splitter recognizes explicit starts (`spent`, `paid`, `received`, `earned`, `debited`, `credited`) and amount-led continuations after a comma, semicolon, or `and`. Amount-led continuation requires a bounded preposition such as `on`, `for`, `at`, `to`, or `from`; this prevents arbitrary numbers from becoming transactions. Commas inside amounts such as `1,200` are never clause separators. If several amounts remain without safe boundaries, the response asks the user to add `and`, commas, or a repeated transaction verb.

Before extraction, a curated dictionary normalizes only high-confidence parser tokens such as `spnet → spent`, `petorl → petrol`, `moveis → movies`, `yestday → yesterday`, and `todya → today`. The original clause remains unchanged in `notes`. Unknown words are not autocorrected.

### `POST /expenses/batch`

The authenticated request accepts between 1 and 50 fully validated `CreateExpenseDto` objects. The service reads the expense collection once, creates every record for the JWT user, and performs one file write. Validation occurs before the controller calls the service, preventing a partially validated batch.

## 7. Human-in-the-loop UI contract

1. Submit raw text to the parser.
2. Render all extracted values as editable draft fields.
3. If status is `NEEDS_CLARIFICATION`, focus the first missing field and show `clarificationPrompt` as a visible status message.
4. Never prefill a missing date with today.
5. If category is ambiguous, show the complete category list rather than choosing a top match.
6. Re-evaluate or locally complete the typed draft after the user answers.
7. Enable final confirmation only when required fields are present.
8. Persist through the existing authenticated transaction API only after explicit confirmation.
9. When a detected currency differs from the user's selected application currency, disclose the mismatch and require the user to resolve it; do not convert silently.

### 7.1 Frontend architecture

- Route: protected `/expenses/intake`.
- API layer: typed parser models and `ParserService` under `frontend/src/app/core/parser/`.
- Feature: standalone `ContextIntakeComponent` under `frontend/src/app/features/expenses/context-intake/`.
- Entry point: the manual transaction page links to the text-intake route; the intake page links back to manual entry.
- The raw-text form and editable draft use persistent labels, visible pending/error/success states, and at least 44×44 CSS-pixel controls.
- Parser results remain component/store state only until confirmation.

### 7.2 Confirmation rules

- `READY` means parsing found required fields; it does not mean saved.
- Users may edit every persisted field before confirmation.
- Missing date/category/amount/split controls are highlighted without silently defaulting values.
- If split wording is ambiguous, users choose either `This is already my amount` or supply a factor of at least two. Choosing a factor preserves the total as `originalAmount` and recalculates the personal amount to two decimals.
- If detected currency is `null`, the selected profile/budget currency applies.
- If detected currency differs from the selected application currency, the user must explicitly choose to interpret the number in the application currency; no conversion occurs.
- Merchant/source is required by the existing transaction API, so a missing merchant is collected in the editable draft even though it does not block parser readiness.
- A single-card confirmation uses the same batch boundary with one item. Successful saves refresh metrics, remove confirmed cards from the active workspace, and add a compact saved summary with an explicit link to history in the conversation.
- The conversational workspace may save one card or use `Save selected` / `Save all ready`; batch confirmation calls the batch endpoint once and leaves incomplete cards unsaved.

### 7.3 Conversational workspace

- `/expenses/intake` remains the protected route and replaces the earlier single-form intake view.
- Large screens use a prompt stream beside a multi-form canvas. Tablet and mobile layouts stack the conversation, cards, composer, and actions without horizontal scrolling.
- Each assistant result renders as a native accessible accordion. The collapsed summary shows merchant/category, amount, date, and readiness. Expanding it reveals the complete editable transaction form.
- Manual form edits and chat updates write to the same in-memory draft objects; there are never separate chat and form copies.
- The existing `/expenses/new` manual page remains available as a secondary route.
- Labels use `Detected`, `Needs …`, `Ready`, and `Saved`; the product must not claim AI generation or expose invented confidence scores.

### 7.4 Deterministic follow-up rules

The system is a state machine, not a general chatbot. The browser holds the active drafts and sends a follow-up message to the existing single parser for field extraction. Explicit command patterns choose the target and allowed mutation.

Supported forms include:

```text
yesterday
use today for all
change transaction 2 to 600
change petrol to 600
split it by 3
already my personal amount
```

Target selection uses `for all`, a one-based transaction number, or bounded words already present in the draft note/category/merchant. When several drafts remain possible, the application does not guess and asks the user to name a transaction. An unrecognized instruction leaves every draft unchanged and provides examples of supported commands.

### 7.5 Session recovery

- Unsaved messages and drafts are cached in browser `sessionStorage`; Redis and server-side chat sessions are not used.
- The browser generates a conversation ID with `crypto.randomUUID()`.
- Keys contain the authenticated JWT subject and conversation ID, preventing one signed-in user session from restoring another user's draft.
- Every valid message or manual edit refreshes a 30-minute inactivity expiry.
- Expired/corrupt caches, logout session removal, and `New conversation` prevent stale recovery. After completion, confirmed drafts are removed from the workspace; the compact saved summary may remain in the user-scoped conversation cache until the 30-minute inactivity expiry so navigation does not reopen saved forms or lose the conversational receipt.
- Confirmed transactions remain in the normal expense store; the temporary conversation is not a financial system of record and is not shared across browsers or devices.

### 7.6 Responsive and accessible behavior

- Supported viewport targets follow the design system: 320×568 small mobile, 375/425 mobile widths, 768×1024 tablet, 1024×768 desktop, and 1440×900 large desktop.
- Controls retain at least 44×44 CSS-pixel pointer targets, persistent labels, visible focus, keyboard-operable native accordions, status announcements, and non-color status text.
- The composer and batch actions remain reachable without hiding form fields behind fixed overlays.
- Tablet layouts remain a single stacked flow through 768 px; the conversation/workspace split begins at the 1024 px desktop breakpoint.
- The visual hierarchy follows the design system's 90% neutral-color rule: emerald is reserved for focus, readiness, send, and save actions; assistant responses use plain text rather than decorative chat bubbles.
- Amounts use tabular numerals and lead each collapsed transaction summary. Readiness uses a status dot plus explicit text, never color alone.
- Draft accordions use the shared `rounded-3xl`, neutral border, surface, and `shadow-sm` card language; nested decorative panels and repeated badges are avoided.

## 8. Security and privacy

- Raw financial text is accepted only on an authenticated route.
- The parser logs no input, JWT, amount, merchant, or result.
- Parsing performs no external network calls. Unsaved parser input/output may exist only in the authenticated tab's expiring `sessionStorage` conversation cache.
- The timezone and reference timestamp are used only to resolve relative dates and are not persisted by the parser.
- Existing request size, CORS, validation, and JWT behavior remain authoritative.

## 9. Acceptance criteria

- [x] Parsing uses deterministic TypeScript only and makes no external calls.
- [x] INR, USD, and EUR symbols, codes, and currency words; comma amounts; split forms; and half are supported.
- [x] Split arithmetic stores the computed personal amount and preserves original metadata.
- [x] Supported explicit and relative dates normalize to `YYYY-MM-DD`.
- [x] Exact numeric day/week/month/year expressions using `ago` or `back` resolve without clarification.
- [x] Exact minute/hour expressions resolve against the user's IANA timezone and handle local-midnight boundaries.
- [x] Missing dates are never silently defaulted and always trigger clarification.
- [x] Missing or ambiguous amount/category values trigger clarification.
- [x] Category mappings use the V3 taxonomy defined by this specification.
- [x] Raw input is preserved as notes and merchant extraction is optional.
- [x] The endpoint is authenticated and does not persist a transaction.
- [x] Unit tests cover arithmetic, dates, ambiguity, categories, merchant extraction, and the non-destructive boundary.
- [x] Merchant extraction handles INR, USD, and EUR markers without including currency text.
- [x] Shared-expense wording requires explicit personal-versus-split clarification.
- [x] Explicitly named two-person spending resolves to a factor of two; unknown-count wording still requires clarification.
- [x] HTTP integration tests cover unauthenticated rejection and authenticated parse states.
- [x] The protected intake route parses raw text and renders an editable draft.
- [x] Vague/missing dates, categories, amounts, and splits are resolved by visible controls.
- [x] Currency mismatch and legacy category mapping are disclosed before confirmation.
- [x] No transaction is persisted before the explicit confirmation action.
- [x] Confirmation persists exactly one transaction and refreshes downstream metrics.
- [x] Frontend unit tests and Playwright cover parse, clarify, confirm, and failure behavior.
- [x] Repeated clauses create independent drafts without combining their amounts.
- [x] A precise trailing date can be applied safely to all batch drafts.
- [x] Deterministic follow-ups can target all drafts, a numbered draft, or an identifiable draft.
- [x] Manual accordion edits and conversational edits share one source of truth.
- [x] Unsaved conversation recovery is user-scoped and expires after 30 minutes of inactivity.
- [x] Individual, selected, and all-ready saves are available without returning to manual entry.
- [x] Batch persistence validates up to 50 transactions and writes the collection once.
- [x] The chat/accordion workspace supports mobile, tablet, and large-screen layouts.
- [x] Amount-led shorthand clauses inherit the previous explicit transaction verb.
- [x] Repeated transaction verbs create boundaries when punctuation is missing.
- [x] Common high-confidence spelling mistakes normalize for extraction while original notes remain unchanged.
- [x] Comma-formatted amounts are protected from clause splitting.
- [x] Boundary-less multi-amount text requests clarification instead of inventing transactions.

## 10. Verification plan

```bash
cd backend
npm test -- --runInBand
npm run build

cd ../frontend
npm test -- --watch=false
npm run build
npx playwright test
```

Manual API verification must cover a valid JWT, an unauthenticated rejection, a ready result, and date/category/amount/split clarification results. Manual UI verification must cover keyboard operation, mobile and desktop layouts, currency mismatch, API failure, and explicit confirmation.

## 11. Implementation progress

| Step | Deliverable | Status |
|---:|---|---|
| 1 | Expand Milestone 10 into the authoritative full-stack contract | Complete |
| 2 | Harden backend merchant, currency, and shared-split behavior | Complete |
| 3 | Add backend HTTP integration and validation coverage | Complete |
| 4 | Implement Angular intake, clarification, editing, and confirmation | Complete |
| 5 | Add frontend unit and Playwright journeys | Complete |
| 6 | Add deterministic multi-clause parsing and shared-date propagation | Complete |
| 7 | Add stateless follow-up commands and 30-minute session recovery | Complete |
| 8 | Replace intake with responsive chat and editable accordion workspace | Complete |
| 9 | Add individual/selected/all-ready batch persistence | Complete |
| 10 | Run full verification and synchronize completion evidence | Complete |

### Verification evidence — 2026-11-10

- Backend Jest: 15 suites, 161 tests passed.
- Backend HTTP E2E: 2 suites, 10 tests passed, including user-timezone sub-day parsing, invalid-timezone rejection, multi-draft parsing, and shortened-clause inheritance.
- Backend production build passed.
- Parser, batch-expense production files, and parser-E2E ESLint passed.
- Frontend Vitest: 26 files, 125 tests passed.
- Frontend production/SSR build passed; the existing initial-bundle budget warning remains (`531.88 kB` against `500 kB`).
- Full Playwright Chromium suite: all 11 journeys passed.
- Milestone 10 browser coverage includes deterministic follow-up, three-draft batch save, non-persistence before confirmation, and horizontal-overflow checks at 320×568, 768×1024, 1024×768, and 1440×900.
- `git diff --check` passed apart from Git's informational LF-to-CRLF notices.

### Gap-closure verification — 2026-11-12

- Incomplete parser results now render the backend `clarificationPrompt`, visually mark missing controls, and move keyboard focus to the first missing field after the draft renders.
- Untargeted follow-ups no longer update several possible drafts. Multiple drafts require `for all`, a one-based transaction number, or a unique bounded merchant/category/note target.
- Session-recovery language now reflects the implemented product behavior: confirmed cards leave the workspace while the compact conversational receipt remains user-scoped until the 30-minute inactivity expiry.
- Currency-mismatch and parser/batch-save failure Playwright journeys were added; all 4 Milestone 10 Chromium journeys passed.
- Frontend Vitest: 26 files, 131 tests passed, including clarification focus, ambiguous-target rejection, and batch-save failure recovery.
- Backend Jest: 15 suites, 164 tests passed. Backend and frontend production builds passed; the existing frontend initial-bundle warning remains (`546.61 kB` against `500 kB`).

## 12. Definition of done

Milestone 10 is complete only when the documented parser contract, authenticated backend, HTTP verification, protected Angular intake flow, all clarification paths, explicit confirmation boundary, currency/category reconciliation, unit tests, builds, and Playwright journey pass. Missing or vague dates must always require human clarification, ambiguous shared expenses must never be silently divided, and no parser path may persist a transaction before explicit confirmation.
