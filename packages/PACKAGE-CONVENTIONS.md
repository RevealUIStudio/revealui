# Package Conventions

This document describes the conventions for organizing packages in the RevealUI monorepo.

**Current Package Count**: 11 packages (as of 2025-01-27)

> **Note**: The `@revealui/types` and `@revealui/generated` packages were merged into `@revealui/core` on 2025-01-27. See the [Package Merge Migration Guide](../../docs/migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md) for details.

## Current Packages

The monorepo currently contains 11 packages:

| Package | Purpose | Structure |
|---------|---------|-----------|
| `@revealui/core` | CMS framework | `core/` + `client/` + `types/` + `generated/` |
| `@revealui/db` | Database (Drizzle ORM) | `core/` + `client/` |
| `@revealui/ai` | AI system | `memory/` + `client/` |
| `@revealui/contracts` | Zod schemas & types | Domain-organized |
| `@revealui/presentation` | UI components | `client/` |
| `services` | External services | `core/` + `client/` |
| `auth` | Authentication | Server + React hooks |
| `sync` | ElectricSQL client | Client-side |
| `config` | Environment config | Single module |
| `dev` | Dev tooling | Tooling-only |
| `test` | Test utilities | Test-only |

---

## Directory Structure Convention

All packages that provide both server-side and client-side functionality should follow the `core/` + `client/` convention:

```
packages/package-name/src/
├── core/          # Server-side code (Node.js, Edge Functions, API routes)
├── client/        # Client-side code (React components, browser hooks, UI)
└── index.ts       # Main entry point (re-exports from core and client)
```

## Package Merge (2025-01-27)

On 2025-01-27, two packages were merged into `@revealui/core` to simplify the framework structure:

- **`@revealui/types`** → Merged into `@revealui/core/types`
- **`@revealui/generated`** → Merged into `@revealui/core/generated`

This reduced the package count from 13 to 11 packages. All types and generated code are now available through `@revealui/core` exports.

**Migration**: If you're using the old packages, see the [Package Merge Migration Guide](../../docs/migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md) for import path updates.

---

## Package Categories

### 1. Full-Stack Packages (core/ + client/)

These packages provide both server-side and client-side functionality:

- **@revealui/core** - CMS framework with server API and admin UI
  - `core/` - Server-side CMS logic, API routes, database adapters
  - `client/` - Admin UI components, React hooks, browser client
  - `core/types/` - Unified type exports (merged from `@revealui/types`)
  - `core/generated/` - Auto-generated code (merged from `@revealui/generated`)
  
- **@revealui/db** - Database package with Drizzle ORM
  - `core/` - Database schemas and server-side client
  - `client/` - Browser-safe database utilities (if needed)
  
- **@revealui/ai** - AI system (memory, LLM, orchestration, tools)
  - `memory/` - CRDT implementations, memory management, vector search
  - `client/` - React hooks for AI operations
  
- **services** - Shared service integrations (library only)
  - `core/` - Server-side API routes, Stripe, Supabase server client
  - `client/` - Browser client creation functions
  - Note: This is a library package, not a runnable app. Demo files have been removed.

### 2. Client-Only Packages

These packages are primarily client-side but follow similar organization:

- **@revealui/presentation** - UI component library
  - All code is client-side (React components)
  - Exports via `./client` for consistency

### 3. Schema/Type Packages

These packages provide only type definitions and validation schemas:

- **@revealui/schema** - Zod schemas and TypeScript types
  - No `core/` or `client/` - schema-only package
  - Exports organized by domain (core, blocks, agents, cms)

### 4. Tooling Packages

These packages are development/build tools:

- **dev** - Development tooling (Vite configs, ESLint, Tailwind)
  - No `core/` or `client/` - tooling-only package
  
- **test** - Testing utilities
  - No `core/` or `client/` - test utilities package

## Package.json Exports

All packages should use the `exports` field in `package.json` to expose their API:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./core": "./src/core/index.ts",
    "./client": "./src/client/index.ts"
  }
}
```

### Special Exports: @revealui/core

The `@revealui/core` package includes additional exports for types and generated code:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./core": "./src/core/index.ts",
    "./client": "./src/client/index.ts",
    "./types": "./src/core/types/index.ts",
    "./types/core": "./src/core/types/core.ts",
    "./types/schema": "./src/core/types/schema.ts",
    "./types/cms": "./src/core/types/cms.ts",
    "./generated": "./src/core/generated/index.ts",
    "./generated/types": "./src/core/generated/types/index.ts",
    "./generated/components": "./src/core/generated/components/index.ts",
    "./generated/hooks": "./src/core/generated/hooks/index.ts"
  }
}
```


## Import Patterns

### Server-side (Node.js, Edge Functions, API Routes)
```typescript
import { getClient } from '@revealui/db/schema'
import { createRevealUI } from '@revealui/core'
import { createServerClient } from 'services/server'
```

### Client-side (React Components, Browser)
```typescript
import { useRevealUI } from '@revealui/core/client'
import { useMemory } from '@revealui/ai/client'
import { createBrowserClient } from 'services/client'
```

### Full Package (when both server and client needed)
```typescript
import { getClient, users } from '@revealui/db'
import { createRevealUI, useRevealUI } from '@revealui/core'
```

### Types and Generated Code

Types and generated code are now part of `@revealui/core`:

```typescript
// Unified type exports
import type { Config, CollectionConfig, Field } from '@revealui/core/types'

// Specific type categories
import type { Config } from '@revealui/core/types/cms'
import type { User, Site } from '@revealui/core/types/schema'
import type { RevealConfig } from '@revealui/core/types/core'

// Generated types (CMS, Supabase, Neon)
import type { Database } from '@revealui/core/generated/types/supabase'
import type { Database as NeonDatabase } from '@revealui/core/generated/types/neon'

// Generated components, hooks, functions
import { GeneratedComponent } from '@revealui/core/generated/components'
import { useGeneratedHook } from '@revealui/core/generated/hooks'
```

> **Migration Note**: If you're migrating from `@revealui/types` or `@revealui/generated`, see the [Package Merge Migration Guide](../../docs/migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md) for detailed migration instructions.

## Benefits of This Convention

1. **Clear Separation** - Easy to identify server vs client code
2. **Tree-shaking** - Bundlers can exclude unused code
3. **Type Safety** - Shared types between server and client
4. **Version Sync** - Server and client stay in sync
5. **Better DX** - Clear import paths show intent
6. **Verifiable** - Automated tests ensure exports work correctly

## Verification

To verify package exports are working correctly:

1. **Run verification script:**
   ```bash
   pnpm tsx scripts/verify-package-exports.ts
   ```

2. **Run import tests:**
   ```bash
   pnpm --filter @revealui/db test imports
   pnpm --filter @revealui/ai test imports
   pnpm --filter services test imports
   ```

3. **Full monorepo verification:**
   ```bash
   pnpm typecheck:all  # Type checking
   pnpm build          # Full build
   pnpm test           # Test suite
   ```
