# XPENSE SDK workspace

This directory contains independently buildable npm packages extracted from the XPENSE backend.

| Package                             | Responsibility                                      | Credentials                            |
| ----------------------------------- | --------------------------------------------------- | -------------------------------------- |
| `@adityavardan/semantic-core`       | Provider-neutral execution and validation contracts | None                                   |
| `@adityavardan/provider-cloudflare` | Cloudflare Workers AI structured-output transport   | Supplied by each consuming application |
| `@adityavardan/xpense-semantics`    | XPENSE-specific semantic facade and contracts       | None                                   |

## Build all packages

From the repository root:

```bash
npm install
npm run build:sdk
```

## Inspect publishable archives

```bash
npm pack --dry-run --workspace=@adityavardan/semantic-core
npm pack --dry-run --workspace=@adityavardan/provider-cloudflare
npm pack --dry-run --workspace=@adityavardan/xpense-semantics
```

Run `npm pack --workspace=<name>` without `--dry-run` to create a `.tgz` that can be installed on another laptop before registry publication.

## Public npm publication

1. Sign in with `npm login`.
2. Confirm the authenticated user or organization owns the package scope.
3. Rename the `@adityavardan` scope if necessary.
4. Review `npm pack --dry-run` output for unwanted files or secrets.
5. Publish `semantic-core` first, then `provider-cloudflare`, then `xpense-semantics`.

```bash
npm publish --workspace=@adityavardan/semantic-core --access public
npm publish --workspace=@adityavardan/provider-cloudflare --access public
npm publish --workspace=@adityavardan/xpense-semantics --access public
```

Packages intentionally contain no `.env` files or Cloudflare credentials. Consumers configure the Cloudflare provider at runtime.
