# `@adityavardan/provider-cloudflare`

A reusable Cloudflare Workers AI transport for requesting structured JSON from
a model. It contains no application-specific prompts, validation rules,
database code, or shared credentials.

## When to use it

Use this package when a server-side TypeScript application needs to call a
Cloudflare-hosted model and receive a predictable JSON proposal.

The request flow is:

1. Your application supplies its own Cloudflare account ID and API token.
2. Your application sends system instructions, user text, and a JSON schema.
3. The package calls Cloudflare Workers AI with a timeout.
4. It reads the assistant response and parses the JSON.
5. It returns `SUCCESS`, `UNAVAILABLE`, or `INVALID_RESPONSE`.
6. Your application validates the returned values before using them.

## Installation

```bash
npm install @adityavardan/semantic-core @adityavardan/provider-cloudflare
```

Requires Node.js 18 or newer and a runtime with `fetch`.

## Cloudflare requirements

You need:

- A Cloudflare account ID.
- A Workers AI API token belonging to your application or account.
- Workers AI access for that account.

Keep credentials on the server. Never place the API token in browser code or
commit it to source control.

## Configuration

```ts
import { CloudflareStructuredModelProvider } from
  "@adityavardan/provider-cloudflare";

const cloudflare = new CloudflareStructuredModelProvider({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  apiToken: process.env.CLOUDFLARE_AI_API_TOKEN ?? "",
  // Optional. Defaults to @cf/google/gemma-4-26b-a4b-it.
  defaultModel: process.env.CLOUDFLARE_AI_MODEL,
  // Optional. Defaults to 20 seconds.
  defaultTimeoutMs: 20_000,
});
```

The package does not read environment variables itself. NestJS, Fastify,
Express, a CLI, a worker, or a test can obtain configuration however it wants
and pass it to the constructor.

## How another application uses this provider

The provider is only the model connection. A consuming application still
creates the domain-specific pieces:

1. Define the input the model should understand.
2. Define the JSON proposal the model should return.
3. Write a prompt with the application's instructions and examples.
4. Pass a JSON schema to `generateStructured`.
5. Validate the parsed result with application rules.
6. Decide whether to show it, ask for clarification, or execute it.

For example, a support application might request `topic` and `priority`, while
an expense application might request `segments`, `amount`, and `date`. The
provider does not know or enforce either application's business meaning.

Use `@adityavardan/semantic-core` when you want the common provider execution,
fallback, and accepted/rejected/unavailable result envelope around this
transport.

## Structured-output example

```ts
type SupportProposal = {
  department: "BILLING" | "TECHNICAL";
  priority: "LOW" | "HIGH";
};

const result = await cloudflare.generateStructured<SupportProposal>({
  messages: [
    {
      role: "system",
      content:
        "Classify the request. Return only data matching the supplied schema.",
    },
    { role: "user", content: "My payment was deducted twice." },
  ],
  responseSchema: {
    type: "object",
    additionalProperties: false,
    required: ["department", "priority"],
    properties: {
      department: {
        type: "string",
        enum: ["BILLING", "TECHNICAL"],
      },
      priority: {
        type: "string",
        enum: ["LOW", "HIGH"],
      },
    },
  },
  temperature: 0.3,
  maxCompletionTokens: 200,
});

if (result.status === "SUCCESS") {
  // Validate the values against your application rules before acting.
  console.log(result.value);
} else {
  console.log(result.status, result.reason);
}
```

## Result behavior

| Result | Example cause | Suggested behavior |
| --- | --- | --- |
| `SUCCESS` | Cloudflare returned parseable JSON. | Run domain validation before using it. |
| `UNAVAILABLE` | Missing configuration, timeout, rate limit, or temporary server failure. | Try an approved fallback or retry later. |
| `INVALID_RESPONSE` | Authorization/request rejection, missing assistant content, or non-JSON output. | Do not trust the response; inspect configuration or prompt/schema. |

`SUCCESS` means the response is JSON. It does not prove that its values are
correct for your business. Pair this transport with a domain validator, such
as `@adityavardan/semantic-core`.

## Optional telemetry

Pass a second callback to `generateStructured` to observe the model, HTTP
status, outcome, and provider envelope. Do not log sensitive prompts or raw
responses without an explicit data-retention policy.

```ts
const result = await cloudflare.generateStructured(request, async (event) => {
  console.log(event.model, event.outcome, event.httpStatus);
});
```

## What this package does not contain

- A Cloudflare account or shared API token.
- Application prompts, categories, or validation rules.
- Provider fallback orchestration.
- Database access, authentication, controllers, or user interfaces.
- Automatic persistence or external side effects.

## API stability

This package is currently in the `0.x` release line. Public contracts may
evolve between minor releases; pin the version when adopting it in production.

## License & Attribution

This package is licensed under the Apache License, Version 2.0. Copyright 2026
Adityavardan. Forks, modified versions, and derivative redistributions must
retain the included `LICENSE` and `NOTICE` attribution files crediting
Adityavardan as the original creator.

Users supply their own Cloudflare account ID and API token. Any optional
managed hosted service is a separate offering and is not required to use this
open-source package.
