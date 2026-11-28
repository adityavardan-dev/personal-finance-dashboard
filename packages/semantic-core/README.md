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

## Using it in different applications

The package does not contain one universal set of fields such as
`allowedCategories` or `allowedPriorities`. Each application defines the
fields and rules that make sense for its own domain.

| Application | Input | Proposal | Typical validation |
| --- | --- | --- | --- |
| Expense | A natural-language expense message | Amounts, dates, categories, participants | Amounts came from the message; no participant or transaction was invented |
| Customer support | A customer message | Topic, priority, sentiment, suggested action | Topic and priority are allowed; required case fields exist |
| HR assistant | An employee request | Request type, urgency, department | No unsupported decision or sensitive action was invented |

The engine is the same in all three cases. The application changes the input
type, proposal type, provider adapter, prompt, and domain validator.

## What every consuming AI application should provide

Even a small application should provide:

1. An input type describing what the model receives.
2. A proposal type describing the output the application expects.
3. A provider adapter that calls the chosen model.
4. A prompt and structured-output schema.
5. At least a basic validator that checks required fields and types.
6. A safe response for rejection or provider failure.

If the application has no business rules yet, begin with structural validation
instead of accepting everything:

```ts
const basicDomain: SemanticDomain<{ message: string }, { answer: string }> = {
  name: "basic-answer",
  schemaVersion: 1,
  validate: (proposal) =>
    typeof proposal.answer === "string" && proposal.answer.trim().length > 0,
};
```

An application may use `validate: () => true`, but that means the engine only
checks the provider result status. It does not protect against invented,
omitted, or unsafe business data, so this should be reserved for experiments
that have no side effects.

## What the host application does after the result

`semantic-core` never saves data or performs an external action. The host
application decides what to do:

- `ACCEPTED`: show or use the typed proposal.
- `REJECTED`: discard it, ask the user to clarify, or use a deterministic fallback.
- `UNAVAILABLE`: retry according to application policy or use another path.

For money, account changes, notifications, or other side effects, require a
separate deterministic validation and user-confirmation step before execution.

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
