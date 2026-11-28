# `@adityavardan/xpense-semantics`

XPENSE-specific TypeScript contracts, transaction-segmentation validation, and
one application-facing semantic SDK. It standardizes how an expense
application asks AI to interpret personal expenses and peer-split messages.

## When to use it

Use this package when building an expense application that needs one typed
entry point for semantic operations such as:

- Separating several transactions written in one message.
- Extracting proposed peer splits.
- Interpreting follow-up changes to pending peer splits.
- Interpreting edits or deletions against unsaved personal drafts.

This is an integration layer, not a complete expense application or trained
Penny agent.

## Runtime flow

1. The user sends an expense message.
2. The host application chooses the semantic operation.
3. The host calls `sdk.interpret({ kind, ...context })`.
4. The SDK routes the request to the configured adapter.
5. The adapter asks a model for structured proposals.
6. XPENSE/application code validates amounts, people, dates, and actions.
7. The application shows reviewable drafts or asks for clarification.
8. Nothing is saved until the host application's confirmation flow permits it.

## Installation

```bash
npm install @adityavardan/semantic-core @adityavardan/xpense-semantics
```

When using Cloudflare Workers AI, also install:

```bash
npm install @adityavardan/provider-cloudflare
```

Requires Node.js 18 or newer.

## Create the SDK

The consuming application supplies its adapters. This keeps prompts,
credentials, provider selection, and persistence outside the package.

```ts
import { SemanticEngine } from "@adityavardan/semantic-core";
import { XpenseSemanticSdk } from "@adityavardan/xpense-semantics";

const sdk = new XpenseSemanticSdk(
  new SemanticEngine(),
  transactionSegmentationProvider,
  peerSplitInterpreter,       // optional
  personalFollowUpInterpreter // optional
);
```

## One entry point

Every operation uses `interpret(request)`. The `kind` field tells the SDK which
adapter and context to use, and TypeScript checks the required fields.

### Separate several transactions

```ts
const segments = await sdk.interpret({
  kind: "TRANSACTION_SEGMENTATION",
  text: "coffee 180, metro 70 and lunch 350 today",
  trace: { conversationId: "conversation-1", requestId: "request-1" },
});
```

Possible result:

```json
["coffee 180", "metro 70", "lunch 350 today"]
```

### Propose a peer split

```ts
const proposals = await sdk.interpret({
  kind: "PEER_SPLIT",
  text: "I paid 900 for dinner with Asha and Ravi; split it equally",
});
```

### Update pending peer splits

```ts
const updates = await sdk.interpret({
  kind: "PEER_FOLLOW_UP",
  text: "Asha paid split 2",
  pending: [
    {
      ordinal: 2,
      amountMinor: 90000,
      peopleCount: 3,
      names: ["You", "Asha", "Ravi"],
    },
  ],
});
```

### Edit or remove personal drafts

```ts
const updates = await sdk.interpret({
  kind: "PERSONAL_FOLLOW_UP",
  text: "Delete expenses above 400",
  referenceTimestamp: new Date().toISOString(),
  drafts: [
    {
      ordinal: 1,
      amount: 180,
      category: "Food & Dining",
      merchant: "",
      date: "2026-11-28",
      note: "coffee 180",
      splitResolution: "personal",
      splitFactor: null,
    },
    {
      ordinal: 2,
      amount: 500,
      category: "Entertainment",
      merchant: "",
      date: "2026-11-28",
      note: "movie 500",
      splitResolution: "personal",
      splitFactor: null,
    },
  ],
});
```

## Supported operation kinds

| `kind` | Extra context | Result |
| --- | --- | --- |
| `TRANSACTION_SEGMENTATION` | User text | Exact text segments or `null` |
| `PEER_SPLIT` | User text | Proposed split records or `null` |
| `PEER_FOLLOW_UP` | `pending` split snapshot | Proposed split updates or `null` |
| `PERSONAL_FOLLOW_UP` | Drafts, reference time, optional timezone/mode | Proposed draft updates or `null` |

`null` means the model was unavailable, unconfigured, or its response was not
accepted. The host application should use deterministic behavior or ask the
user for clarification; it must not treat `null` as permission to save.

## Adapter responsibilities

- Create prompts and structured-output schemas.
- Call the selected model transport.
- Return proposals matching the exported TypeScript contracts.

## Host-application responsibilities

- Decide whether a local parser is sufficient before calling AI.
- Validate all domain facts and reject invented information.
- Resolve the logged-in user and participant identities.
- Calculate money using deterministic ledger code.
- Show drafts, ask for clarification, and obtain confirmation.
- Persist confirmed records and send notifications.
- Secure credentials and control logging/data retention.

## What this package does not contain

- HTTP controllers, Supabase access, authentication, or user interfaces.
- API credentials or a mandatory model provider.
- The full XPENSE local parser, ledger solver, or persistence services.
- Automatic database writes, notifications, or settlements.

The older named methods remain available as compatibility wrappers while
consumers migrate to the unified `interpret(request)` contract.

## API stability

This package is currently in the `0.x` release line. Public contracts may
evolve between minor releases; pin the version when adopting it in production.

## License & Attribution

This package is licensed under the Apache License, Version 2.0. Copyright 2026
Adityavardan. Forks, modified versions, and derivative redistributions must
retain the included `LICENSE` and `NOTICE` attribution files crediting
Adityavardan as the original creator.

Applications using `@adityavardan/provider-cloudflare` supply their own
Cloudflare account ID and API token. Any optional managed hosted service is a
separate offering and is not required to use this open-source package.
