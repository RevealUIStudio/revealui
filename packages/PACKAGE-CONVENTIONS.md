# Package Conventions

This document describes the conventions for organizing packages in the RevealUI monorepo.

## Directory Structure Convention

All packages that provide both server-side and client-side functionality should follow the `core/` + `client/` convention:

```
packages/package-name/src/
├── core/          # Server-side code (Node.js, Edge Functions, API routes)
├── client/        # Client-side code (React components, browser hooks, UI)
└── index.ts       # Main entry point (re-exports from core and client)
```

## Package Categories

### 1. Full-Stack Packages (core/ + client/)

These packages provide both server-side and client-side functionality:

- **@revealui/core** - CMS framework with server API and admin UI
  - `core/` - Server-side CMS logic, API routes, database adapters
  - `client/` - Admin UI components, React hooks, browser client
  
- **@revealui/db** - Database package with Drizzle ORM
  - `core/` - Database schemas and server-side client
  - `client/` - Browser-safe database utilities (if needed)
  
- **@revealui/memory** - CRDT-based memory system
  - `core/` - CRDT implementations, memory management, vector search
  - `client/` - React hooks for memory operations
  
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


## Import Patterns

### Server-side (Node.js, Edge Functions, API Routes)
```typescript
import { getClient } from '@revealui/db/core'
import { createRevealUI } from '@revealui/core/core'
import { createServerClient } from 'services/core'
```

### Client-side (React Components, Browser)
```typescript
import { useRevealUI } from '@revealui/core/client'
import { useMemory } from '@revealui/memory/client'
import { createBrowserClient } from 'services/client'
```

### Full Package (when both server and client needed)
```typescript
import { getClient, users } from '@revealui/db'
import { createRevealUI, useRevealUI } from '@revealui/core'
```

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
   pnpm --filter @revealui/memory test imports
   pnpm --filter services test imports
   ```

3. **Full monorepo verification:**
   ```bash
   pnpm typecheck:all  # Type checking
   pnpm build          # Full build
   pnpm test           # Test suite
   ```
