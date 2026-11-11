# Peer Split Engine — Architecture Discussion Draft

## Metadata

| Field | Value |
|---|---|
| Status | Discussion draft — no feature implementation authorized yet |
| Working branch | `feature/peer-split-engine-design` |
| Base branch | `develop` |
| Builds on | Milestone 10 deterministic context parser and conversational intake |
| Primary objective | Preserve personal expense accuracy while adding multi-party balances and deterministic asymmetric splits |

## 1. Why this document exists

Milestone 10 is a personal transaction intake engine. It is intentionally optimized to answer:

> How much belongs in the signed-in user's personal expense history?

That contract is correct for personal finance, but it is not sufficient for a Splitwise-like peer ledger. A peer expense must also answer:

- Who participated?
- Who paid money at the time of purchase?
- How much should each participant ultimately bear?
- Who owes whom after comparing payment contributions with owed shares?
- How should partial settlements change the outstanding balances?

This proposal keeps Milestone 10 unchanged as the fast personal-expense path and introduces a separate peer-split architecture around it.

## 2. Architectural decision

Use a **hybrid three-lane router**.

| Lane | Example | Extraction | Math | External AI cost |
|---|---|---|---|---|
| Personal fast path | `Spent 300 on snacks today` | Existing Milestone 10 parser | Existing personal calculation | None |
| Deterministic peer path | `I paid 1200 for lunch with Harsha and Jaswanth, split equally` | Local rules and identity resolution | Peer ledger solver | None |
| Semantic peer path | `Paid 1800 for bowling, Jaswanth only had one beer so he pays 400 and split the rest` | Structured semantic extraction | Peer ledger solver | Only when routed here |

The semantic model is never the source of truth for arithmetic or persistence. Its only responsibility is to translate flexible language into typed participants, payment facts, allocation constraints, and explicit ambiguities.

### Why not call an LLM for every message?

- It would make the already-working personal path slower and more expensive.
- It would add a network and provider dependency to simple transactions.
- It would make deterministic behavior harder to test.
- It would expose more financial text than necessary.
- It would still require a deterministic solver and validation boundary.

### Why not extend regex indefinitely?

Regex remains useful for classification and simple equal splits, but it becomes fragile when one sentence combines named people, multiple payers, exceptions, ratios, fixed shares, and residual allocation.

## 3. Proposed end-to-end flow

```text
RAW USER TEXT
      |
      v
STAGE 1 — LOCAL ROUTER AND FAST EXTRACTION
      |
      +-- personal transaction ----------------------> MILESTONE 10
      |
      +-- explicit simple peer split ----------------> LOCAL PEER INTENT
      |
      +-- asymmetric/complex peer language ----------> STAGE 2
                                                           |
                                                           v
                                            SEMANTIC INTENT EXTRACTION
                                            (typed JSON, no trusted math)
                                                           |
                                                           v
                                            SCHEMA + SAFETY VALIDATION
                                                           |
                                                           v
                                            PARTICIPANT IDENTITY RESOLUTION
                                                           |
                                                           v
STAGE 3 — DETERMINISTIC CONSTRAINT AND LEDGER SOLVER
      |
      +-- incomplete, contradictory, or unbalanced ------> STAGE 4
      |                                                    CLARIFICATION
      |                                                         |
      |<--------------------------------------------------------+
      |
      v
REVIEWABLE PEER EXPENSE DRAFT
      |
      v
EXPLICIT USER CONFIRMATION
      |
      v
ATOMIC PERSISTENCE
  1. Personal expense projection
  2. Peer expense and participant allocations
  3. Receivable/payable obligations
```

No analysis route is allowed to persist records. Confirmation remains a separate authenticated operation.

## 4. Stage 1 — Local routing and fast paths

The local router runs before any optional AI call. It should return one of:

```ts
type IntakeLane =
  | 'PERSONAL_FAST_PATH'
  | 'PEER_DETERMINISTIC_PATH'
  | 'PEER_SEMANTIC_PATH'
  | 'NEEDS_ROUTING_CLARIFICATION';
```

### Personal fast-path signals

- No named peer or group is present.
- No debt, contribution, reimbursement, or settlement language is present.
- Existing Milestone 10 extraction is sufficient.

### Deterministic peer-path signals

- Participants are explicitly named or selected.
- The payer is explicit or safely implied as the signed-in user.
- The allocation is explicitly equal or uses one already-supported factor.
- There are no exceptions, ratios, percentages, multiple contributors, or item-level constraints.

### Semantic peer-path signals

Route to semantic extraction when the text contains one or more of:

- Three or more participant mentions with natural-language exceptions.
- `only`, `except`, `rest`, `remaining`, `contributed`, `covered`, `owes`, or `paid for` in split context.
- Fixed participant amounts.
- Percentages, ratios, shares, quantities, or itemized consumption.
- More than one payer or contributor.
- A mismatch between the stated total and stated contributions or allocations.
- Participant references such as `the rest of us`, `everyone except Rahul`, or pronouns whose target must be resolved.

### Important routing rule

Once the peer-ledger feature is enabled, an explicitly named peer must not be discarded merely because an equal personal share can be calculated. For example, `me and Harsha spent 500` may be solved locally, but it must use the peer contract so the relationship with Harsha is preserved.

## 5. Stage 2 — Semantic intent extraction

### Responsibility

Convert raw language into structured facts and constraints. Do not:

- Calculate final shares.
- Create receivable/payable balances.
- Resolve participant database IDs.
- Invent missing people, totals, currencies, dates, or payer information.
- Persist anything.

### Proposed intermediate contract

```ts
type EvidenceKind = 'EXPLICIT' | 'IMPLIED_BY_APP_COMMAND' | 'MISSING';

interface ParticipantMention {
  mentionId: string;
  displayText: string;
  role: 'SELF' | 'PEER';
  evidence: EvidenceKind;
}

interface PaymentContributionIntent {
  participantMentionId: string;
  amountMinor: number | null;
  evidenceText: string;
}

type AllocationRuleIntent =
  | {
      kind: 'FIXED_AMOUNT';
      participantMentionId: string;
      amountMinor: number;
      evidenceText: string;
    }
  | {
      kind: 'PERCENTAGE';
      participantMentionId: string;
      basisPoints: number;
      evidenceText: string;
    }
  | {
      kind: 'WEIGHT';
      participantMentionId: string;
      weight: number;
      evidenceText: string;
    }
  | {
      kind: 'EQUAL_REMAINDER';
      participantMentionIds: string[];
      evidenceText: string;
    };

interface SemanticPeerExpenseIntent {
  schemaVersion: 1;
  totalAmountMinor: number | null;
  currency: 'INR' | 'USD' | 'EUR' | null;
  description: string | null;
  merchant: string | null;
  category: string | null;
  date: string | null;
  participants: ParticipantMention[];
  contributions: PaymentContributionIntent[];
  allocationRules: AllocationRuleIntent[];
  ambiguities: Array<{
    code: string;
    question: string;
    relatedMentionIds: string[];
  }>;
}
```

All monetary values use integer minor units. For INR, USD, and EUR, `100` minor units represent one major currency unit. Floating-point money is not accepted at the solver boundary.

### Structured extraction method

Recommended first implementation:

1. Define a versioned JSON Schema for `SemanticPeerExpenseIntent`.
2. Ask the model to return only schema-valid JSON.
3. Treat the model response as untrusted input.
4. Validate it with the same strictness as an external HTTP request.
5. Reject unknown properties and invalid enum values.
6. Verify that every extracted amount and name has evidence in the raw text.
7. Convert validation failures into a manual peer-split form rather than retrying indefinitely.

### Provider strategy options

| Method | Advantages | Limitations | Recommended use |
|---|---|---|---|
| Hosted structured-output model | Best natural-language coverage and fastest initial delivery | Per-call cost, network dependency, privacy review | Initial semantic lane behind a feature flag |
| Self-hosted small model | Greater data control and predictable marginal cost | Operational complexity and weaker extraction on edge cases | Later, after an evaluation corpus exists |
| Deterministic-only manual builder | No model cost or disclosure | More user effort for complex language | Mandatory fallback in every release |

The application should depend on an internal `SemanticIntentExtractor` interface, not a specific vendor SDK.

```ts
interface SemanticIntentExtractor {
  extract(request: SemanticExtractionRequest): Promise<SemanticPeerExpenseIntent>;
}
```

## 6. Participant identity resolution

The semantic extractor returns textual mentions, never trusted database IDs.

The authenticated backend resolves each mention using:

1. `SELF` to the authenticated user.
2. Exact normalized contact match.
3. Unique alias match.
4. Unique registered-user match, if peer discovery is supported.
5. Clarification when zero or several candidates remain.

The system must not silently create duplicate contacts for `Harsha`, `harsha`, and `Harsha K`.

### Proposed identity state

```ts
interface ResolvedParticipant {
  participantId: string;
  kind: 'SELF' | 'REGISTERED_USER' | 'LOCAL_CONTACT';
  displayName: string;
  sourceMentionId: string;
}
```

Open product decision: whether peer balances can be maintained for local contacts who do not have XPENSE accounts. The recommended answer is yes, because requiring registration would block basic expense tracking.

## 7. Stage 3 — Deterministic asymmetric solver

The solver receives validated integer constraints and resolved participants. It performs no language interpretation.

### Core accounting model

For each participant `i`:

```text
netBalance[i] = amountPaid[i] - amountOwed[i]
```

- Positive balance: the participant should receive money.
- Negative balance: the participant owes money.
- Zero: fully balanced.

Required invariants:

```text
sum(amountPaid) = expenseTotal
sum(amountOwed) = expenseTotal
sum(netBalance) = 0
```

If any invariant cannot be established, the draft must not become ready.

### Allocation order

Recommended deterministic order:

1. Reserve explicit fixed amounts.
2. Apply explicit percentages to their declared base.
3. Allocate explicitly weighted shares.
4. Divide the remaining amount among `EQUAL_REMAINDER` participants.
5. Assign leftover minor units using the documented remainder policy.

Mixed rules are allowed only when their base is explicit. If the text does not make the base clear, request clarification.

### Remainder policy

Never use binary floating-point division for money.

For equal or weighted division:

1. Calculate each exact rational share.
2. Assign the floor value in minor units.
3. Rank participants by largest fractional remainder.
4. Resolve equal fractional remainders using a stable policy:
   - payer first, then
   - participant order stored on the expense.
5. Distribute one minor unit at a time until the total balances exactly.

Example for `₹1000 / 3`:

```text
₹333.34
₹333.33
₹333.33
--------
₹1000.00
```

The chosen remainder recipient is stored so recalculation remains reproducible.

### Settlement-edge generation

After balances are calculated:

1. Sort creditors and debtors using stable participant order.
2. Match each debtor with creditors until the debtor reaches zero.
3. Emit obligations such as `Jaswanth owes Self ₹400`.
4. Verify that emitted obligations exactly cancel all balances.

This produces a valid settlement graph. Minimizing the number of transfers can be added later, but correctness and reproducibility take priority over global optimization.

## 8. Worked example

Input:

```text
Paid 1800 for bowling, split between me, Jaswanth, and Harsha,
but Jaswanth only had one beer so he pays 400
```

### Semantic extraction

The semantic stage should extract:

- Total: `180000` minor units.
- Payer contribution: `SELF = 180000`, because an app command beginning with `Paid` implies the signed-in user.
- Participants: `SELF`, `Jaswanth`, `Harsha`.
- Fixed allocation: `Jaswanth = 40000`.
- Equal remainder: `SELF` and `Harsha`.
- Missing date and potentially ambiguous category.

It must not calculate `700` or any balances.

### Solver output

```text
Owed shares
Self       ₹700
Jaswanth   ₹400
Harsha     ₹700

Paid
Self      ₹1800

Net balances
Self      +₹1100
Jaswanth   -₹400
Harsha     -₹700

Obligations
Jaswanth owes Self ₹400
Harsha owes Self ₹700
```

### Personal finance projection

The signed-in user's dashboard expense is `₹700`, not `₹1800`. The `₹1100` receivable belongs to the peer ledger and must not be counted as additional spending or income.

## 9. Fixed contribution ambiguity example

Input:

```text
I paid ₹3000, Rahul contributed ₹500 cash, split the rest
```

This sentence is unsafe to solve without clarification because `₹3000` may mean either:

- The entire bill was ₹3000 and Rahul reimbursed ₹500, or
- The user paid ₹3000 and Rahul additionally paid ₹500 toward a ₹3500 bill.

The system should ask:

1. `Was the total bill ₹3000 or ₹3500?`
2. `Who should share the remaining amount?`

It must not silently choose an interpretation.

## 10. Stage 4 — Clarification and review

Reuse the mature Milestone 10 interaction pattern, extended with peer fields.

### Proposed peer status

```ts
type PeerDraftStatus =
  | 'NEEDS_CLARIFICATION'
  | 'READY_FOR_REVIEW'
  | 'UNSUPPORTED';

type PeerMissingField =
  | 'totalAmount'
  | 'currency'
  | 'date'
  | 'category'
  | 'participants'
  | 'participantIdentity'
  | 'payer'
  | 'contributionTotal'
  | 'allocationRule'
  | 'allocationTotal';
```

### Clarification priority

Ask the smallest question that unlocks the next deterministic step:

1. Total and currency.
2. Participant identities.
3. Payer and payment contributions.
4. Owed-share rules.
5. Date and category.

Do not ask the model to answer its own ambiguity. The user resolves it through structured choices or a targeted reply.

### Draft UI proposal

Reuse the conversational workspace and render a peer draft with four expandable sections:

1. **Expense** — total, currency, date, merchant, category.
2. **Participants** — resolved people and identity warnings.
3. **Paid and split** — contributions, fixed shares, weights, percentages, remainder rules.
4. **Balance preview** — personal expense plus who owes whom.

Every manual edit runs the deterministic solver again. It must not require another AI call unless the user submits new free-form semantic instructions.

## 11. Data contract and persistence model

### Recommended aggregate

```ts
interface PeerExpenseDraft {
  id: string;
  version: number;
  status: PeerDraftStatus;
  totalAmountMinor: number | null;
  currency: 'INR' | 'USD' | 'EUR' | null;
  date: string | null;
  merchant: string | null;
  category: string | null;
  participants: ResolvedParticipant[];
  contributions: Array<{
    participantId: string;
    amountMinor: number;
  }>;
  allocations: Array<{
    participantId: string;
    amountOwedMinor: number;
    sourceRule: string;
  }>;
  obligations: Array<{
    fromParticipantId: string;
    toParticipantId: string;
    amountMinor: number;
  }>;
  personalExpenseAmountMinor: number | null;
  missingFields: PeerMissingField[];
  clarificationPrompt?: string;
}
```

### Storage recommendation

A peer ledger should not be added to the current flat expense JSON as several loosely related records. Confirmation must atomically create or update the entire aggregate.

A relational persistence model is recommended:

- `peer_expenses`
- `peer_expense_participants`
- `peer_expense_contributions`
- `peer_expense_allocations`
- `peer_obligations`
- `peer_settlements`
- `contacts` or `peer_identities`
- Existing personal `expenses`, linked by `peer_expense_id`

The exact database technology is a separate decision, but it must support transactions, unique constraints, foreign keys, and idempotent confirmation.

### Dashboard projection rule

- Personal spending metrics use the signed-in user's owed allocation.
- Peer receivables and payables are shown separately.
- Repayment of a receivable is a settlement, not income.
- Payment of a payable is a settlement, not a second expense.
- One currency is allowed per peer expense in the first release.

## 12. Proposed API boundaries

### `POST /peer-intake/analyze`

Authenticated and non-destructive.

```ts
interface AnalyzePeerExpenseRequest {
  text: string;
  timeZone: string;
  referenceTimestamp: string;
  conversationId: string;
}
```

Returns the selected lane, semantic facts when applicable, resolved identities, solver preview, missing fields, and clarification prompt.

### `POST /peer-expenses`

Authenticated explicit confirmation.

Requirements:

- Accept a client idempotency key.
- Require the latest draft version.
- Re-run schema validation and the deterministic solver on the server.
- Persist the peer aggregate and personal expense projection in one database transaction.
- Reject stale or unbalanced drafts.

### Settlement endpoints

Settlement recording should be separate from expense creation:

```text
POST /peer-expenses/:id/settlements
GET  /peer-balances
GET  /peers/:peerId/balance
```

Partial settlements must be supported, and the original expense allocation must remain auditable.

## 13. AI safety, privacy, and cost controls

### Trust boundary

- Treat model output as untrusted external input.
- Use strict schemas and server-side validation.
- Never accept database IDs, authenticated user IDs, or persistence commands from model output.
- Never trust model-calculated totals or balances.
- Never allow raw user text to override extraction instructions.
- Never persist automatically after a successful model response.

### Privacy

- Send only the current transaction text, locale, supported currency list, and schema.
- Do not send transaction history, account balances, JWTs, email addresses, or the complete contact list.
- Resolve names to contacts after extraction on the XPENSE backend.
- Do not log raw prompts or model responses in production.
- Document provider retention behavior before enabling the feature.
- Provide a deterministic/manual fallback when semantic processing is unavailable or declined.

### Cost and latency

- Use local routing to keep personal and simple peer inputs at zero external cost.
- Set strict input and output token limits.
- Use one extraction call per new complex message, not per field edit.
- Do not use autonomous agent loops.
- Apply a timeout and a small bounded retry policy only for transport failures.
- Track route rate, latency, schema failures, clarification rate, and cost without storing raw financial text.

## 14. Failure behavior

| Failure | Required behavior |
|---|---|
| Semantic provider unavailable | Keep the text and open the manual peer builder |
| Invalid model JSON | Reject it, record a non-sensitive metric, and use manual fallback |
| Participant identity ambiguous | Ask the user to select or create the intended contact |
| Contributions do not equal total | Ask which payer amount or total is incorrect |
| Allocations exceed total | Block solving and identify the conflicting rule |
| Allocations are below total without a remainder rule | Ask who shares the remainder |
| Solver invariant fails | Treat as an internal error; do not persist |
| Confirmation is repeated | Return the prior result through idempotency handling |
| Persistence partially fails | Roll back the entire aggregate and personal projection |

## 15. Testing strategy

### Deterministic solver tests

- Equal two-person and multi-person splits.
- Fixed amounts plus equal remainder.
- Percentage splits.
- Weighted ratios.
- Multiple payer contributions.
- One-minor-unit and very large remainder cases.
- Stable tie-breaking.
- Partial settlements.
- Rejection of negative, zero, excessive, contradictory, and cross-currency constraints.

### Property-based invariants

For generated valid inputs:

```text
sum(contributions) = total
sum(allocations) = total
sum(net balances) = 0
sum(settlement edges) clears all debtor and creditor balances
all monetary values are integers in minor units
```

### Semantic extraction evaluation

Maintain a versioned corpus containing:

- Natural Indian English phrasing.
- Misspellings and missing punctuation.
- Fixed shares, ratios, percentages, and exceptions.
- Multiple payers.
- Pronouns and ambiguous names.
- Prompt-injection-style text.
- Contradictory and deliberately unsatisfiable inputs.

Score schema validity, fact extraction, ambiguity detection, and unsupported-case recognition. Do not score the model on arithmetic because arithmetic is not its responsibility.

### End-to-end tests

- No write before confirmation.
- Correct personal dashboard projection.
- Correct peer receivable/payable preview.
- Manual edits recalculate without a model call.
- Provider failure falls back safely.
- Duplicate confirmation is idempotent.
- Atomic rollback leaves no partial personal or peer records.
- Mobile and desktop peer-review flows remain usable and accessible.

## 16. Recommended delivery sequence

### Phase A — Contract and deterministic solver

- Finalize participant, contribution, allocation, obligation, and settlement contracts.
- Implement integer-minor-unit arithmetic.
- Add invariant and property-based tests.
- Do not add AI yet.

### Phase B — Persistence foundation

- Select a transactional relational persistence layer.
- Add peer expense, participant, allocation, obligation, and settlement storage.
- Link the user's owed share to the personal expense projection.
- Add idempotent atomic confirmation.

### Phase C — Deterministic peer fast path and manual builder

- Add local peer-intent routing.
- Support named equal splits without AI.
- Add participant selection and balance preview UI.
- Ensure every complex case can fall back to manual structured editing.

### Phase D — Semantic extraction behind a feature flag

- Implement the provider-neutral extractor interface.
- Add structured schema validation and evidence checks.
- Build the evaluation corpus and minimum quality threshold.
- Roll out only to complex peer inputs.

### Phase E — Settlement lifecycle

- Record full and partial settlements.
- Add per-peer balances and audit history.
- Define edit behavior for expenses that already have settlements.

This order prevents the model contract from driving the accounting model. The ledger and solver are established first; semantic extraction only supplies typed inputs to them.

## 17. Decisions required before implementation

1. Can a peer be a local contact without an XPENSE account?
2. Will the first release support multiple payers, or only one payer with later reimbursements?
3. Which relational persistence technology should replace or sit beside the current JSON expense store?
4. Is a hosted semantic model acceptable for financial text, subject to explicit privacy controls?
5. Should users be able to disable semantic processing and always use the manual peer builder?
6. Should the payer receive equal-split rounding remainders, or should the first participant always receive them?
7. Are percentages and weights both required in the first release?
8. Can an expense be edited after a partial settlement, or must edits create an adjustment event?
9. Should peer balances remain per currency with no conversion? The recommended first-release answer is yes.
10. Should the existing conversational intake route host both personal and peer drafts, or should peer review have a separate route after detection?

## 18. Proposed first-release boundaries

Recommended first release:

- Personal fast path remains unchanged.
- Local contacts and registered peers are supported.
- One currency per expense; no conversion.
- One or multiple payers.
- Equal, fixed-amount, percentage, and weighted splits.
- Deterministic remainder distribution.
- Full and partial settlements.
- Optional hosted semantic extraction only for complex language.
- Manual structured peer builder always available.
- Explicit confirmation and atomic persistence required.

Out of scope for the first release:

- Automatic bank transfers or payment collection.
- Cross-currency debt conversion.
- Interest, lending, tax, or investment accounting.
- Autonomous agents that negotiate or modify balances.
- Model-generated contacts or silent identity matching.
- Automatic persistence based on model confidence.

## 19. Definition of architecture-ready

Implementation should not begin until:

- The decisions in Section 17 are resolved.
- The intermediate semantic contract is approved.
- The peer expense and settlement data model is approved.
- The solver remainder policy is approved.
- Personal dashboard projection rules are approved.
- Provider privacy and retention constraints are documented.
- Manual fallback behavior is accepted.
- A representative extraction evaluation corpus exists.
