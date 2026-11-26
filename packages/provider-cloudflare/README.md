# `@adityavardan/provider-cloudflare`

Reusable Cloudflare Workers AI transport for structured JSON output. It contains no XPENSE prompts, schemas, validation, database code, or credentials.

## Why consumers still need credentials

This package supplies the tested integration code, not a shared Cloudflare account. Every application supplies its own account ID and API token, so usage, billing, permissions, and data remain under that application's control.

```ts
import { CloudflareStructuredModelProvider } from "@adityavardan/provider-cloudflare";

const provider = new CloudflareStructuredModelProvider({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  apiToken: process.env.CLOUDFLARE_AI_API_TOKEN ?? "",
  defaultModel: process.env.CLOUDFLARE_AI_MODEL,
});
```

The package never reads `process.env` itself. A Fastify app, Nest app, CLI, test, or serverless function can obtain secrets in its preferred way and pass them to the constructor.

## Installation

```bash
npm install @adityavardan/semantic-core @adityavardan/provider-cloudflare
```

Until publication, install the archives produced by `npm pack`.

## Structured request

```ts
const result = await provider.generateStructured({
  messages: [
    { role: "system", content: "Classify the support request." },
    { role: "user", content: "My payment was deducted twice." },
  ],
  responseSchema: {
    type: "object",
    additionalProperties: false,
    required: ["department"],
    properties: { department: { type: "string" } },
  },
  temperature: 0.3,
  maxCompletionTokens: 200,
});
```

## Publishing

Confirm ownership of the `@adityavardan` npm scope or rename the package before public publication. Never publish `.env` files or real credentials.
