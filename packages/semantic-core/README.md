# `@adityavardan/semantic-core`

Provider-neutral TypeScript contracts and a small semantic execution engine. It knows nothing about XPENSE, Cloudflare, prompts, databases, or HTTP controllers.

## Behavior

- Runs the first configured provider.
- Tries at most one fallback only when a provider is unavailable.
- Stops when provider output is malformed or the application domain rejects it.
- Returns the same accepted, rejected, or unavailable envelope for every domain.

## Installation

```bash
npm install @adityavardan/semantic-core
```

Until the package is published, install a packed archive:

```bash
npm install ./adityavardan-semantic-core-0.1.0.tgz
```

## Example

```ts
import {
  SemanticEngine,
  type SemanticDomain,
  type SemanticModelProvider,
} from "@adityavardan/semantic-core";

type Input = { message: string };
type Proposal = { department: string };

const domain: SemanticDomain<Input, Proposal> = {
  name: "support.routing",
  schemaVersion: 1,
  validate: (proposal) =>
    ["BILLING", "TECHNICAL"].includes(proposal.department),
};

const engine = new SemanticEngine();
const result = await engine.interpret(input, domain, [
  primaryProvider,
  fallbackProvider,
]);
```

The consuming application owns the input type, proposal type, prompt, schema, and validation rules.

## Publishing

The `@adityavardan` scope is the current workspace name. Before public publication, confirm that this npm scope is owned by the publisher or rename it to an owned scope.
