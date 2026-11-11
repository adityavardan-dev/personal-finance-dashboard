# XPENSE — Personal Finance Dashboard

XPENSE is a full-stack personal finance dashboard built with Angular, NestJS, TypeScript, Tailwind CSS, and GitHub Actions. The product is evolving toward a hybrid finance assistant: deterministic finance logic remains the source of truth, while optional AI capabilities help interpret natural language, suggest UI improvements, and explain already-calculated insights.

## Development architecture

- **Frontend:** Angular 21 standalone components, Signals, Tailwind CSS, Vitest, and Playwright
- **Backend:** NestJS 11, JWT authentication, class-validator, and Jest
- **Persistence:** Local JSON stores under `backend/data/`
  - `users.json` — persisted signup identities
  - `expenses.json` — authenticated user transactions
  - `budgets.json` — authenticated per-user budgets introduced by the Milestone 5 specification
- **Session:** JWT access token stored in browser `sessionStorage`
- **AI boundary:** provider-neutral semantic extraction and explanation services; AI output is untrusted input and never performs arithmetic or persistence

Local JSON persistence and plaintext development passwords are intentionally scoped for the V1 local-development implementation and must not be represented as production-grade authentication or storage.

## Authoritative documentation

- [Business requirements](docs/milestones/00-business-requirements.md)
- [Design system](docs/milestones/01-design-system.md)
- [UI build guide](docs/milestones/02-ui-build-guide.md)

### Remaining V1 milestone specifications

- [Milestone 4 — Transaction & History Completeness](docs/milestones/04-transaction-history-spec.md)
- [Milestone 5 — Persisted Budget Foundation](docs/milestones/05-budget-persistence-spec.md)
- [Milestone 6 — Dynamic Dashboard & Deterministic Insights](docs/milestones/06-dynamic-dashboard-insights-spec.md)
- [Milestone 7 — Persisted Profile & Preferences](docs/milestones/07-profile-preferences-spec.md)
- [Milestone 8 — UX, Responsive & Accessibility Hardening](docs/milestones/08-ux-accessibility-hardening-spec.md)
- [Milestone 9 — V1 Release Readiness](docs/milestones/09-release-readiness-spec.md)

### V3 foundation specifications

- [Milestone 10 — Zero-Prompt Context Parser Intake](docs/milestones/10-context-parser-intake-spec.md)
- [AI assistance and model strategy](docs/architecture/ai-assistance-and-model-strategy.md)

Milestone 10 provides the deterministic foundation for conversational intake. The next direction adds an optional semantic AI lane for complex language, while retaining local parsing, manual editing, explicit confirmation, and deterministic server-side validation. AI-assisted development is also part of the engineering workflow, but no model is allowed to bypass the accounting and persistence boundaries.
