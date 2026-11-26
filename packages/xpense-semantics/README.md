# `@adityavardan/xpense-semantics`

XPENSE-specific semantic contracts, transaction-segmentation validation, and the application-facing semantic facade.

This package does not contain HTTP controllers, persistence, Supabase access, API credentials, or a mandatory AI provider. The consuming expense application supplies adapters for transaction segmentation, peer splits, and personal-draft follow-ups.

## Installation

```bash
npm install @adityavardan/semantic-core @adityavardan/xpense-semantics
```

Install `@adityavardan/provider-cloudflare` as well when Cloudflare is the selected model transport.

## Example

```ts
import { SemanticEngine } from "@adityavardan/semantic-core";
import { XpenseSemanticSdk } from "@adityavardan/xpense-semantics";

const sdk = new XpenseSemanticSdk(
  new SemanticEngine(),
  transactionSegmentationProvider,
  peerSplitInterpreter,
  personalFollowUpInterpreter,
);

const segments = await sdk.segment("coffee 180, metro 70 and lunch 350 today");
```

## Adapter responsibilities

- Model adapters create prompts and request structured proposals.
- XPENSE domain validators reject invented or unsupported facts.
- The host application decides whether and when anything is persisted.
- Credentials remain in the host application, never in this package.

## Publishing

Version `0.1.0` indicates that the public API is still evolving. Confirm ownership of the `@adityavardan` npm scope or rename it before public publication.
