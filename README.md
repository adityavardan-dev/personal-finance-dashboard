# XPENSE — Personal Finance Dashboard

XPENSE is a full-stack personal finance dashboard built with Angular, NestJS, TypeScript, Tailwind CSS, and GitHub Actions. Version 1 uses local JSON files for development persistence; it does not currently use PostgreSQL, an ORM, or Docker.

## Development architecture

- **Frontend:** Angular 21 standalone components, Signals, Tailwind CSS, Vitest, and Playwright
- **Backend:** NestJS 11, JWT authentication, class-validator, and Jest
- **Persistence:** Local JSON stores under `backend/data/`
  - `users.json` — persisted signup identities
  - `expenses.json` — authenticated user transactions
  - `budgets.json` — authenticated per-user budgets introduced by the Milestone 5 specification
- **Session:** JWT access token stored in browser `sessionStorage`

Local JSON persistence and plaintext development passwords are intentionally scoped for the V1 local-development implementation and must not be represented as production-grade authentication or storage.

## Authoritative documentation

- [Business requirements](docs/00-business-requirements.md)
- [Design system](docs/01-design-system.md)
- [UI build guide](docs/02-ui-build-guide.md)

### Remaining V1 milestone specifications

- [Milestone 4 — Transaction & History Completeness](docs/milestones/04-transaction-history-spec.md)
- [Milestone 5 — Persisted Budget Foundation](docs/milestones/05-budget-persistence-spec.md)
- [Milestone 6 — Dynamic Dashboard & Deterministic Insights](docs/milestones/06-dynamic-dashboard-insights-spec.md)
- [Milestone 7 — Persisted Profile & Preferences](docs/milestones/07-profile-preferences-spec.md)
- [Milestone 8 — UX, Responsive & Accessibility Hardening](docs/milestones/08-ux-accessibility-hardening-spec.md)
- [Milestone 9 — V1 Release Readiness](docs/milestones/09-release-readiness-spec.md)

V2 AI assistance and V3 automated transaction ingestion remain roadmap scope and are not part of the V1 implementation specifications.
