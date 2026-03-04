# Package Conventions

This document describes the conventions for organizing packages in the RevealUI monorepo.

**Current Package Count**: 18 packages (as of 2026-03-03)

## Current Packages

The monorepo currently contains 18 packages (13 OSS + 5 Pro):

### OSS Packages (MIT)

| Package | Purpose | Structure |
|---------|---------|-----------|
| `@revealui/core` | CMS framework | `core/` + `client/` + `types/` + `generated/` |
| `@revealui/contracts` | Zod schemas & types | Domain-organized |
| `@revealui/db` | Database (Drizzle ORM, 41 tables) | `core/` + `client/` |
| `@revealui/auth` | Authentication | Server + React hooks |
| `@revealui/presentation` | UI components (43+ components) | `client/` |
| `@revealui/router` | File-based router with SSR | Server + client |
| `@revealui/config` | Type-safe env config (Zod) | Single module |
| `@revealui/utils` | Logger, DB helpers, validation | Utility module |
| `@revealui/cli` | `create-revealui` scaffolding | CLI tool |
| `@revealui/setup` | Environment setup utilities | Scripts |
| `@revealui/sync` | ElectricSQL real-time sync | Client-side |
| `@revealui/dev` | Shared configs (Biome, TS, Tailwind) | Tooling-only |
| `@revealui/test` | E2E specs, fixtures, mocks | Test-only |

### Pro Packages (Commercial)

| Package | Purpose | Structure |
|---------|---------|-----------|
| `@revealui/ai` | AI agents, CRDT memory, LLM providers | `memory/` + `client/` |
| `@revealui/mcp` | MCP servers (Stripe, Supabase, Neon, etc.) | Server configs |
| `@revealui/editors` | Editor daemon (Zed, VS Code, Neovim) | Adapters |
| `@revealui/services` | Stripe + Supabase integrations | `core/` + `client/` |
| `@revealui/harnesses` | AI harness adapters, daemon, coordination | Multi-module |

---

## Directory Structure Convention

All packages that provide both server-side and client-side functionality should follow the `core/` + `client/` convention:

```
packages/package-name/src/
├── core/          # Server-side code (Node.js, Edge Functions, API routes)
├── client/        # Client-side code (React components, browser hooks, UI)
└── index.ts       # Main entry point (re-exports from core and client)
```

## Package Merge History (2025-01-27)

Two packages were merged into `@revealui/core` early in development:

- **`@revealui/types`** → Merged into `@revealui/core/types`
- **`@revealui/generated`** → Merged into `@revealui/core/generated`

All types and generated code are available through `@revealui/core` exports.

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
  
- **@revealui/services** - Shared service integrations (library only)
  - `core/` - Server-side API routes, Stripe, Supabase server client
  - `client/` - Browser client creation functions
  - Note: This is a library package, not a runnable app.

### 2. Client-Only Packages

These packages are primarily client-side but follow similar organization:

- **@revealui/presentation** - UI component library
  - All code is client-side (React components)
  - Exports via `./client` for consistency

### 3. Schema/Type Packages

These packages provide only type definitions and validation schemas:

- **@revealui/contracts** - Zod schemas and TypeScript types
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
import { createServerClient } from '@revealui/services/server'
```

### Client-side (React Components, Browser)
```typescript
import { useRevealUI } from '@revealui/core/client'
import { useMemory } from '@revealui/ai/client'
import { createBrowserClient } from '@revealui/services/client'
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

> **Migration Note**: The former `@revealui/types` and `@revealui/generated` packages were merged into `@revealui/core`. Update imports to use `@revealui/core/types` and `@revealui/core/generated`.

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
   pnpm --filter @revealui/services test imports
   ```

3. **Full monorepo verification:**
   ```bash
   pnpm typecheck:all  # Type checking
   pnpm build          # Full build
   pnpm test           # Test suite
   ```
