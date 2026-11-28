# Agent instructions for XPENSE

These instructions apply throughout this repository. Follow the user's current request when it gives more specific direction. Read the relevant architecture or milestone document before changing a feature's contract.

## PENNY runtime guidance

<!-- PENNY_RUNTIME_START -->
You are PENNY, XPENSE's friendly expense and peer-split assistant. Your job in a model call is to interpret the current user message into the requested structured JSON. Keep the user's meaning and avoid inventing amounts, dates, people, payers, or debts. A greeting alone is not an expense. If a detail is ambiguous, leave it unresolved so the app can ask a short, specific follow-up. Use the current personal or split draft summaries supplied with the request to resolve follow-ups across turns. Do not assume you remember earlier messages that were not supplied. Never claim that a transaction has been saved, and never calculate authoritative shares or balances; the application validates facts and performs the money calculations. Follow the task-specific schema and instructions in the same request.
<!-- PENNY_RUNTIME_END -->

## Project map

- `frontend/`: Angular standalone components, Signals, Vitest, and Playwright.
- `backend/`: NestJS controllers and services, Jest tests, and the peer split ledger solver.
- `docs/architecture/peer-split-engine-design.md`: peer split boundaries and accounting rules.
- `docs/architecture/ai-assistance-and-model-strategy.md`: model use, validation, and privacy rules.
- `docs/milestones/10-context-parser-intake-spec.md`: conversational personal expense intake.

The backend reads the marked PENNY runtime section above and includes it in every Cloudflare interpretation request. Keep that section short and free of secrets or development-only instructions. The backend build copies this file into `backend/dist/docs/`; if guidance is missing at runtime, hosted interpretation is unavailable and local/manual handling remains available.

## Conversational expense and split behavior

- Use one `conversationId` for a conversation and a new `requestId` for each user turn. Pass both through frontend API calls, backend responses, and relevant logs.
- Keep personal expenses and peer splits as distinct flows. A split preview must not silently become a personal expense or be saved to expense history.
- Keep explicit, simple inputs on the local parsing path. For varied or unresolved language, use the backend's Cloudflare interpreter when configured. Do not keep adding regex patterns for individual phrases or examples.
- Send model requests from the backend. Keep provider credentials out of the frontend and responses.
- Treat model output as a proposal. Validate amounts, names, participants, payers, allocation meaning, and target split numbers against the user's message and pending drafts. Ask for clarification when the evidence is insufficient or contradictory.
- Derive money, shares, balances, and obligations with deterministic integer minor-unit code in the peer split solver. The model must not perform authoritative arithmetic or persistence.
- Keep split drafts editable and reviewable. Preserve partial details across turns. Require the necessary names, payer, and allocation details before creating a preview. Never automatically persist a financial transaction from model output.
- A greeting alone is not a transaction. Reply with the appropriate personal expense or split prompt.

## Editing and verification

- Make focused changes in the existing module boundaries. Add brief comments above non-obvious files and functions to explain their purpose and decisions.
- Cover meaningful parsing, validation, follow-up, and ledger behavior with focused tests. Run the relevant backend Jest tests and frontend Angular/Vitest tests or TypeScript checks before reporting completion.
- When changing a running backend, rebuild it and verify the process serving port 3000 is the updated one. Check the owning PID before stopping a process.
- Preserve user data under `backend/data/`. Do not include data JSON files, `.env`, secrets, or generated build output in commits or pushes unless the user explicitly requests those files.
- Do not overwrite unrelated working tree changes. Review the diff before committing or pushing, and report tests and any unverified live model behavior accurately.
