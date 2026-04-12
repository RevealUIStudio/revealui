# Package Conventions

Conventions for organizing packages in the RevealUI monorepo.

See [CLAUDE.md](../CLAUDE.md) for the full package map and [docs/REFERENCE.md](../docs/REFERENCE.md) for API reference.

## Directory Structure

Packages with both server-side and client-side code follow `core/` + `client/`:

```
packages/<name>/src/
├── core/          # Server-side (Node.js, Edge, API routes)
├── client/        # Client-side (React components, hooks, browser)
└── index.ts       # Main entry (re-exports from core and client)
```

**Exceptions:**
- Schema-only packages (`contracts`)  -  organized by domain, no core/client split
- Tooling packages (`dev`, `test`)  -  no core/client split
- Client-only packages (`presentation`)  -  all client code, exports via `./client`

## Package.json Exports

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./core": "./src/core/index.ts",
    "./client": "./src/client/index.ts"
  }
}
```

## Import Patterns

```typescript
// Server-side
import { createRevealUI } from '@revealui/core'
import { db } from '@revealui/db'

// Client-side
import { useRevealUI } from '@revealui/core/client'
import { Button } from '@revealui/presentation/client'

// Types
import type { Config } from '@revealui/core/types'

// Schemas
import { userSchema } from '@revealui/contracts'
```

## Creating a New Package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, `tsup.config.ts`
2. Name: `@revealui/<name>`
3. Add `workspace:*` references from consuming packages
4. Include: `build`, `dev`, `lint`, `test`, `typecheck` scripts
5. Build output: `dist/` via tsup
6. Source in `src/`, tests in `src/__tests__/` or `__tests__/`
7. Entry point: `src/index.ts` → `dist/index.js`
8. Include `files: ["dist", "README.md"]` for publishing
9. OSS: `publishConfig.access: "public"`, MIT license
10. Pro: `"private": true`

## README Template

Each package README should follow this structure:

```markdown
# @revealui/<name>

Brief one-sentence description.

## Overview

What the package does and how it fits into RevealUI.

## Installation

\`\`\`bash
pnpm add @revealui/<name>
\`\`\`

## Quick Start

\`\`\`typescript
import { mainFunction } from '@revealui/<name>'
const result = await mainFunction({ option: 'value' })
\`\`\`

## API Reference

Document exported functions, classes, and types.

## Development

\`\`\`bash
pnpm --filter @revealui/<name> typecheck
pnpm --filter @revealui/<name> test
pnpm --filter @revealui/<name> build
\`\`\`

## License

MIT (OSS) or Commercial (Pro)
```

## Verification

```bash
pnpm typecheck:all  # Type checking across all packages
pnpm build          # Full build
pnpm test           # Test suite
```
