# @revealui/db

## 0.8.0

### Minor Changes

- 76efd75: Widen the LLM provider surface with Anthropic and OpenAI (no behavior change).

  `@revealui/ai`: `LLMProviderType` now includes `anthropic` and `openai`, added to
  the `createProvider` factory as OpenAI-compatible wrappers (Anthropic at
  `https://api.anthropic.com/v1`, OpenAI at `https://api.openai.com/v1`) with
  conservative default models. Fixes a latent defect where `huggingface` was
  accepted by the env factory but had no `createProvider` case and threw at first
  use. `createLLMClientFromEnv` auto-detects the two new providers after the
  existing checks so existing deployments resolve identically, and now emits the
  one-line boot warning it always documented when the zero-config localhost default
  is selected. The OpenAI-compatible client sets a 60s request timeout and one
  retry so an unreachable endpoint fails fast instead of burning the serverless
  duration. Exports a `hostedViable` classification for later resolver/UI wiring.

  `@revealui/db`: migration widening the provider CHECK constraints on
  `user_api_keys` and `workspace_inference_configs` (and the latter's key-pairing
  CHECK) to allow `anthropic` and `openai`. Constraint-widening only, idempotent,
  no backfill.

### Patch Changes

- eac1a1b: remove dangling export subpaths that pointed at nonexistent source modules: `./schema/cms` in @revealui/db (no `src/schema/cms.ts`; `posts` lives in `schema/admin.ts`) and `./client` in @revealui/auth (no `src/client/` implementation). No consumer imports either subpath.
- Updated dependencies
  - @revealui/config@0.5.1
  - @revealui/utils@0.3.6

## 0.7.3

### Patch Changes

- Updated dependencies [639dfa5]
  - @revealui/config@0.5.0

## 0.7.2

### Patch Changes

- Updated dependencies [95ddc7b]
  - @revealui/config@0.4.3

## 0.7.1

### Patch Changes

- Updated dependencies [145975d]
  - @revealui/config@0.4.2

## 0.7.0

### Minor Changes

- 96b1049: Add `@revealui/db/orm` subpath that re-exports Drizzle ORM query helpers (`eq`, `and`, `or`, `sql`, `inArray`, `desc`, `count`, ...).

  Worker scripts and apps should depend on Drizzle through this subpath instead of importing the bare `drizzle-orm` package. Under pnpm's isolated linker, `drizzle-orm` is materialized only inside the `node_modules` of packages that declare it (such as `@revealui/db`), not at the repo root — so a bare `import('drizzle-orm')` from repo-root `scripts/` fails with `ERR_MODULE_NOT_FOUND`. Importing through `@revealui/db/orm` resolves from any workspace location and guarantees the operators come from the same Drizzle instance as the db client and schema.

### Patch Changes

- e08adbe: Attach an `'error'` event handler to the pg pools created by the database client (localhost / self-hosted Postgres path). A pg `Pool` is an EventEmitter, and an unhandled `'error'` event — emitted when an idle connection is dropped by the server (admin termination, autosuspend, network blip) — throws and crashes the process. The handler logs the error and keeps the pool alive, matching the existing behavior in `pool.ts` (Neon-backed deployments use the HTTP driver and are unaffected).

## 0.6.0

### Minor Changes

- 363d4b5: Remove the RevealCoin (RVUI) on-chain payment integration. RevealCoin is a separate pre-launch product; this drops its wiring from the framework while leaving x402 micropayments (USDC on Base) fully intact.

  - **@revealui/contracts**: removed the RevealCoin module exports (token config, mint addresses, allocations, amount helpers) and the `rvuiDiscount` pricing field; the agent `pricing` schema is now USDC-only.
  - **@revealui/db**: dropped the `revealcoin_payments` and `revealcoin_price_snapshots` tables (migration `0016`) and their generated types.
  - **@revealui/services**: removed the `./revealcoin` entry point (on-chain client, price oracle, payment safeguards).
  - **@revealui/core**: x402 observability is USDC-only — removed the safeguard-rejection counter and narrowed the payment-metric currency/scheme labels.
  - **@revealui/mcp**: removed the `revealcoin` contracts-introspection category.

  Breaking for any consumer importing the removed symbols (minor bumps under pre-1.0 SemVer).

- 6643d0b: Add a claim/complete idempotency state to `processed_webhook_events` (`status` +
  `claimed_at`) and a per-event `agent_credit_events` ledger, with migration 0017.

  Enables crash-safe Stripe webhook processing: an event is claimed as
  `processing` and only marked `completed` after its side effects run, so an
  uncaught crash/timeout leaves the event reclaimable (a later retry re-runs it)
  rather than a permanent dedup marker that silently drops a paid event. The
  credit ledger makes credit-bundle application idempotent on replay. Existing
  rows migrate as `completed` (default), preserving dedup of already-processed
  events.

## 0.5.0

### Minor Changes

- 972b052: Add `mcp_document_operations` as a Drizzle-tracked schema (`packages/db/src/schema/mcp-document-operations.ts`) with companion migration `0009_mcp_document_operations.sql`.

  Operation log for MCP's document-oriented CRDT replication — distinct from the AI memory system's `crdt_operations` (per-CRDT-instance op log for LWW / OR-set / PN-counter primitives). The two tables model different domains and share column names only coincidentally; they must not be reconciled into one.

  Schema:

  - `id` (text PK)
  - `document_id` (text NOT NULL, indexed) — replication scope unit
  - `operation_type` (text NOT NULL)
  - `payload` (jsonb NOT NULL) — operation delta
  - `vector_clock` (jsonb NOT NULL) — causal history `{ nodeId: counter }`
  - `node_id` (text NOT NULL, indexed)
  - `created_at` (timestamptz DEFAULT NOW() NOT NULL, indexed DESC)
  - `applied_at` (timestamptz NULLABLE) — idempotent replay marker

  Additive only; no MCP code changes yet. Follow-up PR-3b.3 rewires MCP's integration test to use the new table and re-exports typed helpers. See `.jv/docs/mcp-crdt-reconciliation-design.md` for the full Phase 3b design.

- 6ce0d60: A.3a of the post-v1 MCP arc — backend for the `/admin/mcp` Usage tab.

  The accompanying A.3b PR adds the admin UI on top of this; A.3a lands
  the schema migration + sink-side population + aggregation endpoint
  independently so the UI can ship against a stable backend.

  **`@revealui/db`:**

  - Migration `0011_usage_meters_duration_ms.sql` adds two nullable
    columns to `usage_meters`: `duration_ms` (bigint) + `errored`
    (boolean). Pre-A.3 rows carry NULL; post-migration rows populate
    from the Stage 6.1/6.2 sinks.
  - Drizzle schema mirror in `accounts.ts`.

  **`@revealui/ai`:**

  - Extend `McpUsageMeterRow` with `durationMs?: number` + `errored?: boolean`.
  - `createUsageMeterSink` populates both from `event.duration_ms` /
    `!event.success` so existing consumers automatically capture the
    new fields once the schema accepts them.

  **`api`:**

  - New `GET /api/mcp/usage?range=24h|7d|30d` endpoint that aggregates
    per-`meterName` totals + success/error/unknown counts +
    p50/p95 duration via PostgreSQL `percentile_disc`. Filters by
    `entitlementMiddleware`-resolved `accountId` (account-scoped, same
    precedent as A.1's metering writer). Mounted at canonical +
    `/api/v1/...` paths.
  - 9 PGlite-backed integration tests cover auth, accountId scoping,
    per-meter aggregation, percentile correctness, range filtering,
    and zod validation.

### Patch Changes

- Updated dependencies [37952d2]
  - @revealui/config@0.4.1
  - @revealui/utils@0.3.5

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
