# @revealui/claim-gates

Fleet claim honesty engines for multi-root claim-drift (GAP-462).

## Overview

Extracts the claim-drift detector so every RevFleet product repo can run the
same honesty gates without a full-copy of the scanner. Phase 1 keeps revealui
`pnpm validate:claims` hard-fail with pre-extract parity. Phase 2 adds
per-profile scan roots, soft missing-path handling, and `--warn` / `--baseline`
for gradual fleet enablement.

## Installation

```bash
pnpm add @revealui/claim-gates
```

## Quick Start

```typescript
import { runClaimGates } from '@revealui/claim-gates';

const result = runClaimGates({
  root: '/path/to/checkout',
  profile: 'product-runtime',
});
process.exit(result.exitCode);
```

CLI (after build):

```bash
# revealui monorepo (default profile product-runtime)
claim-gates --root /path/to/revealui

# agency / marketing-site (hard-fail when clean)
claim-gates --root /path/to/agency --profile marketing-site

# sibling product README / docs (hard-fail; fleet-attribution off)
claim-gates --root /path/to/revdev --profile product-readme

pnpm validate:claims   # revealui monorepo thin wrapper + capability slice
```

## Profiles (Phase 2+)

| Profile | Use | Metrics / license | Fleet attribution | Missing scan dirs |
|---------|-----|-------------------|-------------------|-------------------|
| `product-runtime` | Full revealui monorepo | On | On (docs / marketing) | Hard-fail if missing |
| `marketing-site` | Agency | Off | Off (intentional Studio/Rev* copy) | Soft skip |
| `product-readme` | Sibling product docs | Off | Off (peer products name each other) | Soft skip |

Auto-detect from root shape:

- `apps/` + `packages/` + `apps/marketing/app/content/claims-evidence.ts` → product-runtime
- `app/` without `packages/` → marketing-site
- else → product-readme

Flags: `--fix`, `--warn` / `--baseline` (report failures, exit 0), `--root`, `--profile`.

## Development

```bash
pnpm --filter @revealui/claim-gates typecheck
pnpm --filter @revealui/claim-gates test
pnpm --filter @revealui/claim-gates build
```

## License

MIT
