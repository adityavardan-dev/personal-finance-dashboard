# AI Assistance and Model Strategy

## 1. Product direction

XPENSE will use AI in two ways:

1. **Development assistance** - coding, test generation, repository explanation, accessibility review, and UI ideation.
2. **Product assistance** - optional natural-language interpretation and explanations inside XPENSE.

AI is an assistant, not the accounting engine. Deterministic TypeScript calculations, schema validation, identity resolution, and explicit confirmation remain authoritative.

## 2. Recommended free-first model strategy

| Use case | First choice | Alternative | Boundary |
|---|---|---|---|
| Repository implementation | GitHub Copilot Free or a local coding model | Qwen3-Coder through Ollama | Human reviews diffs and tests every change |
| UI suggestions and accessibility critique | Gemini 2.5 Flash through AI Studio | Local multimodal model when available | Use anonymized data and screenshots |
| Complex transaction-language extraction | Gemini free tier during prototype | Qwen3-Coder/local model behind an adapter | Return typed facts only; never arithmetic |
| Privacy-sensitive deployment | Local Qwen model through Ollama | Self-hosted compatible model | No raw financial text leaves the controlled environment |

Free hosted limits and model availability can change. The application must not hard-code a vendor model name into domain logic or make production availability depend on a free quota.

## 3. Provider-neutral application boundary

The backend should expose an internal interface rather than importing a vendor SDK from finance services:

```ts
interface SemanticIntentExtractor {
  extract(request: SemanticExtractionRequest): Promise<SemanticIntentResult>;
}

interface InsightExplainer {
  explain(request: InsightExplanationRequest): Promise<GroundedExplanation>;
}
```

Adapters may target a hosted provider, a local Ollama endpoint, or a deterministic fallback. Configuration selects the adapter at runtime. The frontend must not call a model provider directly and must never receive provider secrets.

## 4. Runtime safety rules

- Route simple personal and equal-split inputs through deterministic parsing first.
- Call AI only for complex language or an explicitly requested explanation.
- Send the minimum necessary text and schema; do not send JWTs, account balances, full transaction history, or complete contact lists.
- Treat every model response as untrusted external input.
- Validate strict JSON schemas and reject unknown properties.
- Require evidence text for extracted amounts, names, dates, and categories.
- Recompute all money, allocations, comparisons, and balances in application code.
- Never accept database IDs or persistence commands from a model.
- Never automatically save a transaction or change a budget based on model output.
- Provide a manual/deterministic fallback if the model is unavailable, refused, slow, or invalid.
- Do not log raw financial prompts or model responses in production.

## 5. UI behavior for AI features

AI-powered screens must make the boundary visible:

- Label suggestions as `AI suggestion` or `AI explanation`.
- Show the underlying transaction or metric facts used for the suggestion.
- Keep every extracted field editable before confirmation.
- Provide `Use`, `Edit`, `Retry`, and `Use manual entry` actions.
- Show loading, unavailable, invalid-response, and stale-draft states.
- Never present generated financial advice as a recommendation without a separate product and compliance decision.
- Preserve keyboard access, focus management, readable error text, and responsive behavior at all documented breakpoints.

## 6. Development workflow

When using AI to implement a Markdown specification:

1. Give the model the relevant specification and existing file paths.
2. Ask it to describe the design approach and list files before editing.
3. Require small, reviewable changes with tests.
4. Ask for explicit assumptions and unresolved decisions.
5. Run formatting, unit tests, integration tests, and Playwright coverage.
6. Inspect the UI at 320px, 375px, 425px, 768px, 1024px, and 1440px.
7. Review the diff for fabricated APIs, duplicated business logic, privacy leaks, and accessibility regressions.

## 7. Rollout sequence

### Phase 1 - Development assistance

Use free coding and UI tools to implement the deterministic contracts, tests, and responsive screens. No runtime model dependency.

### Phase 2 - Provider adapter and evaluation

Add provider-neutral interfaces, strict schemas, a versioned evaluation corpus, timeout handling, and deterministic fallback.

### Phase 3 - Optional semantic intake

Enable AI only for complex transaction or peer-split language behind a feature flag. Keep personal fast-path parsing local.

### Phase 4 - Grounded explanations

Allow AI to explain validated dashboard metrics. The model receives structured metrics, not unrestricted account data, and the UI clearly distinguishes facts from generated wording.

### Phase 5 - Privacy and cost review

Before production use, document provider retention, regional processing, rate limits, quota behavior, user consent, disable controls, and the local-model alternative.
