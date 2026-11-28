# `@adityavardan/semantic-core`

A small, provider-neutral TypeScript engine for accepting only validated AI
output. It can be used by expense, customer-support, HR, commerce, or other
applications because it contains no application-specific rules.

## When to use it

Use this package when your application needs the same safe flow for one or
more AI providers:

1. Your application creates a typed input.
2. The engine selects the first configured provider.
3. The provider returns structured data, reports that it is unavailable, or
   reports an invalid response.
4. Your domain validator checks that the structured data is safe for your
   application.
5. The engine returns one consistent `ACCEPTED`, `REJECTED`, or `UNAVAILABLE`
   result.

The model proposes meaning. Your application remains responsible for deciding
whether that proposal is valid and whether any external action should happen.

## Installation

```bash
npm install @adityavardan/semantic-core
```

Requires Node.js 18 or newer.

## Minimal example

```ts
import {
  SemanticEngine,
  type SemanticDomain,
  type SemanticModelProvider,
} from "@adityavardan/semantic-core";

type SupportInput = { message: string };
type SupportProposal = {
  department: "BILLING" | "TECHNICAL";
  priority: "LOW" | "HIGH";
};

const provider: SemanticModelProvider<SupportInput, SupportProposal> = {
  name: "example-provider",
  isConfigured: () => true,
  async extract(input) {
    // Replace this example with a real provider call.
    return {
      status: "SUCCESS",
      value: {
        department: input.message.includes("charged")
          ? "BILLING"
          : "TECHNICAL",
        priority: "HIGH",
      },
    };
  },
};

const supportDomain: SemanticDomain<SupportInput, SupportProposal> = {
  name: "support-routing",
  schemaVersion: 1,
  validate(proposal) {
    return (
      ["BILLING", "TECHNICAL"].includes(proposal.department) &&
      ["LOW", "HIGH"].includes(proposal.priority)
    );
  },
};

const engine = new SemanticEngine();
const result = await engine.interpret(
  { message: "I was charged twice" },
  supportDomain,
  [provider],
);

if (result.status === "ACCEPTED") {
  console.log(result.value.department); // BILLING
} else {
  console.log(result.status, result.attempts);
}
```

## Result behavior

| Result | Meaning | Suggested application behavior |
| --- | --- | --- |
| `ACCEPTED` | A provider returned structured data and the domain accepted it. | Use the typed proposal in the next application step. |
| `REJECTED` | The response was malformed or failed domain validation. | Do not apply it; ask for clarification or use deterministic logic. |
| `UNAVAILABLE` | No configured provider produced a response. | Use a local fallback or show a temporary failure. |

Every result includes `attempts`, which records the provider name and outcome
for debugging and observability.

## Fallback policy

- The engine considers at most the first two configured providers.
- It tries the second provider only when the first is `UNAVAILABLE`.
- It does not send malformed or domain-rejected output to another model.
  Invalid output is rejected immediately so a second model cannot silently
  reinterpret an unsafe response.

## What the consuming application supplies

- Input and proposal TypeScript types.
- Provider adapters and credentials.
- Prompts and structured-output schemas.
- Domain validation rules.
- Logging, persistence, user confirmation, and external actions.

## What this package does not contain

- Cloudflare, OpenAI, Gemini, or other provider-specific HTTP code.
- Prompts, databases, authentication, controllers, or user interfaces.
- Expense, support, HR, or other domain rules.
- Automatic side effects such as saving data or sending messages.

## Related packages

- `@adityavardan/provider-cloudflare` provides a Cloudflare Workers AI
  structured-output transport.
- `@adityavardan/xpense-semantics` provides XPENSE-specific semantic contracts
  and routing built on this core.

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
