# @revealui/db

## 0.4.0

### Minor Changes

- 77a9a68: Expose two previously internal-but-documented modules as public subpath imports:

  - `@revealui/core/cache/query-cache` — `cacheQuery`, `cacheList`, `cacheItem`, `invalidateCache`, `invalidateCachePattern`, `invalidateResource`, `cacheSWR`
  - `@revealui/db/pool` — `getPool`, `pool`, `checkDatabaseHealth`, `getPoolStats`, `startPoolMonitoring`, `warmupPool`

  Both modules have existed in source with full unit test coverage (`packages/core/src/cache/query-cache.ts`, `packages/db/src/pool.ts`) but were not listed in `package.json#exports`, so `docs/DATABASE.md` examples like `import { monitorQuery } from '@revealui/core/monitoring/query-monitor'` and `import { getPoolStats } from '@revealui/db/pool'` would fail at the module resolver. No code changes — purely exports-map additions.

  `@revealui/core/monitoring/query-monitor` is exposed separately in the companion PR that adds `api/*` subpaths.

- f6ba434: **BREAKING (pre-1.0):** `SUPABASE_DATABASE_URL` is now required for vector queries — no longer falls back silently to `DATABASE_URL`. Prevents vector data routing to the wrong database in misconfigured deployments. Restore pool cleanup handler for graceful shutdown (SIGTERM/SIGINT/beforeExit). Add HNSW index for `rag_chunks.embedding` in Supabase vector setup SQL.
- 59c670b: Expose previously-documented APIs that weren't actually on the public surface:

  **`@revealui/db` — 8 new schema subpath exports** (source + dist existed; only the exports map was missing):

  - `./schema/password-reset-tokens`
  - `./schema/admin` (`posts`, `media`, `globalHeader`, `globalFooter`, `globalSettings`)
  - `./schema/licenses`
  - `./schema/api-keys` (`userApiKeys`, `tenantProviderConfigs`)
  - `./schema/audit-log`
  - `./schema/app-logs`
  - `./schema/error-events`

  **`@revealui/config` — 4 re-exports from the package root:**

  - `validateAndThrow` — already in `./validator.js`, now on the root barrel
  - `getDatabaseConfig` / `getRevealConfig` / `getStripeConfig` — from `./modules/{database,reveal,stripe}.js`

  **`@revealui/cli` — programmatic project creation:**

  - `createProject` and `CreateProjectConfig` are now exported from the package root for use in tests and custom tooling (documented in `docs/REFERENCE.md`).

  No behavior changes — purely surface-area additions. Drops docs-import-drift findings in REFERENCE.md by 19 (21 → 2; the remaining 2 are `@revealui/core/api/rate-limit` which the companion PR handles).

### Patch Changes

- Updated dependencies [59c670b]
  - @revealui/config@0.4.0

## 0.3.7

### Patch Changes

- Charge-readiness phases A-D: billing integration, media library, bulk operations, pagination, sidebar nav, and deploy hardening.
- Updated dependencies
  - @revealui/config@0.3.4
  - @revealui/utils@0.3.4

## 0.3.6

### Patch Changes

- 0f195e4: SDLC hardening, content overhaul, and cms→admin rename.

  - Promote all CI quality checks from warn-only to hard-fail
  - Kill banned phrases across 58 files (headless CMS → agentic business runtime)
  - Rename apps/cms to apps/admin throughout the codebase
  - Remove proprietary AI providers (Anthropic, OpenAI direct) — keep OpenAI-compatible base
  - Add Gmail-first email provider to MCP server (Resend deprecated)
  - Fix CodeQL security alerts (XSS validation, path traversal guard, prototype-safe objects)
  - Align all coverage thresholds with actual coverage
  - Add 4 ADRs (dual-database, Fair Source licensing, session-only auth, two-repo model)

- Updated dependencies [0f195e4]
  - @revealui/utils@0.3.3
  - @revealui/config@0.3.3

## 0.3.5

### Patch Changes

- add NeonSaga transaction-safe operations layer, idempotency keys migration, CRDT optimistic locking fix, observability routes, and database health check error surfacing
- Updated dependencies
- Updated dependencies
  - @revealui/utils@0.3.2
  - @revealui/config@0.3.2

## 0.3.4

### Patch Changes

- fix: security hardening, CodeQL fixes, docs, and dependency cleanup

  - Replace regex with string methods across source code (CodeQL)
  - Harden CLI content pull and remove trivial conditionals
  - Fix router dependency (core → utils) to resolve DTS build OOM
  - Add migration 0006 indexes for agent_actions, crdt_operations, boards, ticket_labels
  - Remove legacy Supabase-era billing handlers from services
  - Re-export agentMemories from db schema for published @revealui/ai compat
  - Add publishConfig.registry consistency to editors, mcp, services
  - Add READMEs and JSDoc across all packages

- Updated dependencies
  - @revealui/config@0.3.1
  - @revealui/utils@0.3.1

## 0.3.3

### Patch Changes

- fix(db): add missing indexes on boards, ticketLabels, agentActions, crdtOperations; Drizzle migration 0005 for deletedAt columns, mfa counter, new indexes, and db:push-only tables

## 0.3.2

### Patch Changes

- fix(db): add soft-delete (`deletedAt`) columns to orders and licenses tables for financial audit compliance, fix dual-DB boundary so `agentMemories` exports from rest schema instead of vector, remove orphaned migration file

## 0.3.1

### Patch Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/config@0.3.0
  - @revealui/utils@0.3.0

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI database layer.

  - Drizzle ORM schema definitions for 25+ tables
  - Dual-database architecture support (NeonDB PostgreSQL, Supabase)
  - Client factory for database connections
  - Migration system
  - Schema modules: users, sessions, sites, pages, posts, media, agents, conversations, CRDT operations, rate limits, waitlist, and more
  - Type generation utilities for contracts integration

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/config@0.2.0
  - @revealui/utils@0.2.0
