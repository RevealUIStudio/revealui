# @revealui/claim-gates

Fleet claim honesty engines for multi-root claim-drift (GAP-462).

## Overview

Extracts the claim-drift detector so every RevFleet product repo can run the
same honesty gates without a full-copy of the scanner. Phase 1 keeps revealui
`pnpm validate:claims` hard-fail with pre-extract parity. Later phases add
agency / revdev profiles and knowledge-graph claim ingest.

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
claim-gates --root /path/to/checkout
pnpm validate:claims   # revealui monorepo thin wrapper
```

## Profiles (Phase 1)

| Profile | Use |
|---------|-----|
| `product-runtime` | Full revealui behavior (default when root looks like the monorepo) |
| `marketing-site` | Agency / marketing surfaces (Phase 2) |
| `product-readme` | Sibling product README gates (Phase 2) |

## Development

```bash
pnpm --filter @revealui/claim-gates typecheck
pnpm --filter @revealui/claim-gates test
pnpm --filter @revealui/claim-gates build
```

## License

MIT
