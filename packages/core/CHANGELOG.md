# @revealui/core

## 0.8.0

### Minor Changes

- 198fc08: Enforce row-level access (`WhereClause`) in `findByID`, `update`, and `delete`.

  When a collection's `access.read/update/delete` returns a `WhereClause` (the
  documented row-ownership mechanism, e.g. `{ author: { equals: user.id } }`),
  these operations previously coerced it to "allow" and acted on any id —
  returning, updating, or deleting rows the filter was meant to scope out. They
  now confirm the target row matches the filter (reusing the same AND-merge
  `find` uses, across both storage adapters) before returning or mutating it, and
  deny otherwise. `find` was already correct; boolean access rules are unaffected.

- 363d4b5: Remove the RevealCoin (RVUI) on-chain payment integration. RevealCoin is a separate pre-launch product; this drops its wiring from the framework while leaving x402 micropayments (USDC on Base) fully intact.

  - **@revealui/contracts**: removed the RevealCoin module exports (token config, mint addresses, allocations, amount helpers) and the `rvuiDiscount` pricing field; the agent `pricing` schema is now USDC-only.
  - **@revealui/db**: dropped the `revealcoin_payments` and `revealcoin_price_snapshots` tables (migration `0016`) and their generated types.
  - **@revealui/services**: removed the `./revealcoin` entry point (on-chain client, price oracle, payment safeguards).
  - **@revealui/core**: x402 observability is USDC-only — removed the safeguard-rejection counter and narrowed the payment-metric currency/scheme labels.
  - **@revealui/mcp**: removed the `revealcoin` contracts-introspection category.

  Breaking for any consumer importing the removed symbols (minor bumps under pre-1.0 SemVer).

### Patch Changes

- 198e56a: Add a client-safe `@revealui/security/sanitize` subpath and route rich-text RSC rendering through it — fixes a `node:crypto` client-bundle crash.

  `@revealui/core/richtext/rsc` imported `isSafeUrl` / `sanitizeUrl` from the `@revealui/security` barrel, which statically re-exports `auth.ts` and `gdpr.ts`. Both modules have a top-level `import { ... } from 'node:crypto'`, so the entire crypto graph was pulled into every client/RSC bundle that rendered rich text. In the browser `node:crypto` is unavailable, which crashed the bundle and blanked any route loading rich-text content (e.g. the marketing `/blog` route, on `main`/production).

  - `@revealui/security`: new `./sanitize` export (built as a separate tsup entry). It bundles only `src/sanitize.ts` + `parse5` — no `node:crypto` — so it is safe to import from a browser/RSC client path. The barrel is unchanged for server consumers.
  - `@revealui/core`: `richtext/exports/server/rsc.tsx` now imports the URL helpers from `@revealui/security/sanitize` instead of the barrel. No public API change; existing re-exports of `isSafeUrl` / `sanitizeUrl` are preserved.

  The sync `totpHmac` (TOTP) usage in `auth.ts` is intentionally left as a static import — converting it to a lazy `await import('node:crypto')` would force an async signature change rippling to all TOTP callers. Isolating the client path via the subpath avoids that blast radius entirely.

- 1d5a9e4: Split server-only modules behind `@revealui/security/server` so the default `@revealui/security` barrel is client-bundle-safe.

  `auth`, `gdpr`, `audit` (`node:crypto`) and `ssrf` (`node:dns`) now export from the new `@revealui/security/server` subpath. The default barrel re-exports only client-safe modules — alerting, authorization, encryption (Web Crypto), GDPR storage, headers, logger, request-IP, and input sanitization — so a browser/RSC bundle that imports `@revealui/security` no longer drags the `node:` graph in (the crash class fixed in the previous release for richtext RSC).

  `@revealui/core/security` re-exports both the barrel and `./server`, so server consumers that import via `@revealui/core/security` are unaffected. Code that imported the moved symbols (`TwoFactorAuth`, `OAuthClient`, the GDPR managers, `AuditSystem`/`audit`, `assertPublicUrl`, etc.) directly from the `@revealui/security` barrel must switch to `@revealui/security/server`, which is server-only.

- Updated dependencies [9ec7c07]
- Updated dependencies [363d4b5]
- Updated dependencies [198e56a]
- Updated dependencies [1d5a9e4]
- Updated dependencies [0f2906c]
- Updated dependencies [e4a3779]
  - @revealui/contracts@0.6.0
  - @revealui/security@0.4.0
  - @revealui/cache@0.2.1

## 0.7.0

### Minor Changes

- b0bab95: Fix read-after-write failure in `create()` against pooled PostgreSQL adapters.

  The `create()` operation INSERTs a document, then reads it back via `findByID()` to return the stored shape (with defaults, computed columns, and JSON deserialization applied). Previously, these two queries ran on separate pool checkouts — under the `pg` library each `db.query()` call acquires a fresh client from the pool. Depending on snapshot-acquisition timing, the read-back could execute on a connection whose snapshot predated the INSERT's commit, returning `null` and throwing _"Failed to retrieve created document with id rvl_xxx. Document not found in database."_ even though the row was present.

  The root cause was a comment assuming SQLite same-connection WAL visibility applied to pooled PostgreSQL — it does not. Each pool checkout is independent under autocommit.

  **Fix:**

  - Added optional `transaction<T>(fn)` method to `QueryableDatabaseAdapter` and `DatabaseAdapter` types. Adapters that support it hold a single connection across the callback, wrapping the work in `BEGIN`/`COMMIT` (or `ROLLBACK` on throw).
  - Implemented `transaction` in `universalPostgresAdapter` for all providers (Neon, Supabase session + transaction pooling, Electric/PGlite, generic PostgreSQL).
  - `create()` now uses `db.transaction()` when available to run INSERT + `findByID()` on the same connection + snapshot. Adapters without a `transaction` method fall back to the previous sequential-query path for backward compatibility with test mocks.

  Closes revealui#383.

- af12683: Add x402 observability counters + helpers to the core metrics module:

  - `appMetrics.x402PaymentRequiredTotal` — counter, labels `{route, currency}`
  - `appMetrics.x402PaymentVerifyTotal` — counter, labels `{route, scheme, result}`
  - `appMetrics.x402PaymentVerifyDuration` — histogram, label `{scheme}`
  - `appMetrics.x402SafeguardRejectionTotal` — counter, label `{reason}`

  New helper functions for emission at call sites:

  - `trackX402PaymentRequired(route, currency)`
  - `trackX402PaymentVerify(route, scheme, result, durationMs)`
  - `trackX402SafeguardRejection(reason)` + exported `X402SafeguardRejectionReason` type

  New subpath export: `@revealui/core/observability/metrics` (mirrors the
  existing logger subpath). All existing metric helpers continue to work
  through the parent `@revealui/core/observability` export.

  Counters surface automatically through the existing `/api/metrics`
  Prometheus endpoint (gated on `METRICS_SECRET`) and `/api/metrics/json`
  endpoint. No new exposure surface needed.

  Part of GAP-149 PR 5 — wires the metrics into the x402 verify dispatch

  - all five 402-emission call sites in apps/api.

### Patch Changes

- 3ff25bb: Fix the instance-level `create()` method to honor `options.overrideAccess`.

  The low-level `collections/operations/create.ts` already short-circuits its `access.create` check when `overrideAccess: true` is passed, but the instance-level `instance/methods/create.ts` did not — so bootstrap, migrations, and other trusted internal callers would hit _"Access denied: you do not have permission to create in this collection"_ at the instance level _before_ ever reaching the low-level guard. Paired with #382 (which fixed the low-level overrideAccess propagation) and #384 (which fixed the read-after-write transaction wrap), this completes the chain that lets the bootstrap flow create the first admin user against a fresh database.

  Change is a one-line condition in `instance/methods/create.ts`: the access check now only fires when `!options.overrideAccess`. Mirrors the pattern in `collections/operations/create.ts:31`.

  Complementary change in the low-level `collections/operations/create.ts`: the post-INSERT `findByID` read-back now passes `overrideAccess: true`. Without this, the just-created doc would immediately face a second access-control check that had no `req` context (bootstrap has no authenticated user) and would therefore deny.

  Regression tests added in `instance/methods/__tests__/create.test.ts` verify both directions — access denied when `overrideAccess` is unset, check skipped when `overrideAccess: true`. The low-level `collections/operations/__tests__/create.test.ts` assertions on the `findByID` call signature were updated to include the new `overrideAccess: true` parameter.

- Updated dependencies [54557b7]
- Updated dependencies [6afae69]
- Updated dependencies [f7ea9b4]
- Updated dependencies [ad6aa4c]
- Updated dependencies [0eb3131]
- Updated dependencies [25dba49]
- Updated dependencies [9a6ebb3]
- Updated dependencies [47c75fe]
- Updated dependencies [a8ca087]
- Updated dependencies [1f7ae24]
- Updated dependencies [f56d3d3]
- Updated dependencies [f8199c8]
- Updated dependencies [37952d2]
- Updated dependencies [dbf405a]
- Updated dependencies [3d09425]
- Updated dependencies [2eb63dc]
- Updated dependencies [5479d59]
  - @revealui/contracts@0.5.0
  - @revealui/utils@0.3.5
  - @revealui/security@0.3.1
  - @revealui/cache@0.1.5

## 0.6.0

### Minor Changes

- 80cc561: Expose five previously internal-but-documented modules as public subpath imports:

  - `@revealui/core/api/compression` — response compression middleware + presets
  - `@revealui/core/api/payload-optimization` — cursor pagination, field selection, response shaping
  - `@revealui/core/api/rate-limit` — sliding-window rate limiter + presets (per-IP, per-user, per-API-key)
  - `@revealui/core/api/response-cache` — HTTP cache middleware, ETag, tag-based invalidation
  - `@revealui/core/monitoring/query-monitor` — `monitorQuery` DB performance wrapper

  Each module has existed in source (`packages/core/src/api/*.ts`, `monitoring/query-monitor.ts`) with full unit test coverage but was not listed in `package.json#exports`, so `docs/PERFORMANCE.md` examples like `import { compressResponse } from '@revealui/core/api/compression'` would fail at the module resolver. No code changes — this is purely an exports-map addition.

  Drops `docs-import-drift` findings by 35 (225 → 190).

- 77a9a68: Expose two previously internal-but-documented modules as public subpath imports:

  - `@revealui/core/cache/query-cache` — `cacheQuery`, `cacheList`, `cacheItem`, `invalidateCache`, `invalidateCachePattern`, `invalidateResource`, `cacheSWR`
  - `@revealui/db/pool` — `getPool`, `pool`, `checkDatabaseHealth`, `getPoolStats`, `startPoolMonitoring`, `warmupPool`

  Both modules have existed in source with full unit test coverage (`packages/core/src/cache/query-cache.ts`, `packages/db/src/pool.ts`) but were not listed in `package.json#exports`, so `docs/DATABASE.md` examples like `import { monitorQuery } from '@revealui/core/monitoring/query-monitor'` and `import { getPoolStats } from '@revealui/db/pool'` would fail at the module resolver. No code changes — purely exports-map additions.

  `@revealui/core/monitoring/query-monitor` is exposed separately in the companion PR that adds `api/*` subpaths.

- 284fd1f: Expose `./database/type-adapter` as a public subpath (source + dist already existed; only the exports map was missing). Unblocks `dbRowToContract` usage documented in `docs/ARCHITECTURE.md`.

  Paired with doc-only fixes across 10 files (AI-AGENT-RULES, ARCHITECTURE, AUTOMATION, BUILD_YOUR_BUSINESS, CORE_STABILITY, LOCAL_FIRST, LOGGING, STANDARDS, TYPE-SYSTEM-RULES, agent-rules/database-boundaries) that correct stale `@revealui/*` import paths and replace placeholder-named samples (`MyEntity`, `ItemType`, `MyConfig`, `NewTableSelectSchema`) with real exported contract types (`Page`, `User`, `SiteSettings`, `PostsSelectSchema`).

  Drops docs-import-drift findings by 22 (from 216 → 194 on `test`).

  No behavior changes.

- f6ba434: Add tiered license fail-mode with grace periods. New `getLicenseStatus()` returns `LicenseCheckResult` with mode (active/grace/read-only/expired/invalid/missing), grace remaining, and read-only flag. Configurable grace windows: 3-day subscription, 30-day perpetual, 7-day infra-unreachable. Add iss/aud claims to license JWTs for cross-environment replay prevention. Remove ES256 from allowed JWT algorithms (only RS256 is issued).
- 0e459ca: **`@revealui/presentation`** — expose 4 typography + table components from the main barrel:

  - `Heading`, `Subheading` (from `./components/heading`)
  - `Link` (from `./components/link`)
  - `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `Code`, `Strong`, `Text`, `TextLink` (from `./components/text`)

  All four source files already existed but were not re-exported from `src/components/index.ts`. The documented usage in `docs/COMPONENT_CATALOG.md` expected them at the top level.

  To avoid naming collision, the CVA-style primitives previously exported as `Heading` and `Text` from `./primitives` are now aliased as `HeadingPrimitive` and `TextPrimitive`. They remain available under `./primitives` via their file paths unchanged; only the barrel re-export name changed. No internal or external consumers import the primitive-named variants from the main barrel.

  **`@revealui/core`** — expose three `./client/*` subpath imports that already exist in the source tree:

  - `@revealui/core/client/ui`
  - `@revealui/core/client/admin`
  - `@revealui/core/client/richtext`

  Previously only the top-level `./client` barrel was exported; consumers could already reach these identifiers via that barrel, but the documented imports (`@revealui/core/client/ui`, etc.) failed at the resolver.

  Drops `docs-import-drift` findings by 41 (225 -> 184). Brings `docs/COMPONENT_CATALOG.md` to zero drift.

- 2204021: Remove the legacy log-redaction duplicates in favor of the audited `@revealui/security` chokepoint.

  - `@revealui/core`: `sanitizeLogData` (exported from `@revealui/core/observability/logger`) is gone. Replace with `redactLogContext` from `@revealui/security` — same intent, broader coverage (recurses into arrays, scrubs inline secret shapes in string values, depth-capped at 8).
  - `@revealui/ai`: `redactSensitiveFields` (exported from `@revealui/ai/llm/client`) is gone. Replace with `redactLogContext` from `@revealui/security`.

  Behavior is strictly broader, not narrower, so existing redactions continue to fire. Consumers that relied on arrays being passed through unredacted will now see array members walked.

### Patch Changes

- Updated dependencies [2204021]
- Updated dependencies [2204021]
- Updated dependencies [7db5151]
- Updated dependencies [2204021]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
  - @revealui/security@0.3.0
  - @revealui/contracts@1.4.0

## 0.5.6

### Patch Changes

- Security hardening across packages: expanded dangerous URL scheme check, CodeQL alert resolution, Dependabot vulnerability fixes, security rule schemas with AST-typed ReDoS detection, and RBAC/ABAC enforcement tests.
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @revealui/cache@0.1.4
  - @revealui/utils@0.3.4
  - @revealui/resilience@0.2.4
  - @revealui/security@0.2.7
  - @revealui/contracts@1.3.7

## 0.5.5

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
  - @revealui/contracts@1.3.6
  - @revealui/security@0.2.6
  - @revealui/utils@0.3.3
  - @revealui/cache@0.1.3
  - @revealui/resilience@0.2.3

## 0.5.4

### Patch Changes

- add NeonSaga transaction-safe operations layer, idempotency keys migration, CRDT optimistic locking fix, observability routes, and database health check error surfacing
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @revealui/utils@0.3.2
  - @revealui/contracts@1.3.5
  - @revealui/cache@0.1.2
  - @revealui/resilience@0.2.2
  - @revealui/security@0.2.5

## 0.5.3

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
  - @revealui/cache@0.1.1
  - @revealui/contracts@1.3.4
  - @revealui/resilience@0.2.1
  - @revealui/security@0.2.4
  - @revealui/utils@0.3.1

## 0.5.2

### Patch Changes

- @revealui/contracts@1.3.3
- @revealui/security@0.2.3

## 0.5.1

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/security@0.2.2

## 0.5.0

### Minor Changes

- Add AI sampling for free-tier users (50 tasks/month)

## 0.4.0

### Minor Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13

### Patch Changes

- @revealui/contracts@1.3.1
- @revealui/security@0.2.1

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.2.0
  - @revealui/utils@0.3.0
  - @revealui/cache@0.2.0
  - @revealui/resilience@0.2.0
  - @revealui/security@0.2.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.1.0

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of the RevealUI core framework.

  - Runtime engine with collection CRUD, field traversal, and hook system (afterChange, afterRead, beforeChange, beforeValidate)
  - REST API layer with framework-agnostic handlers
  - Auth utilities (access control helpers)
  - Config system with `buildConfig` and deep merge
  - Rich text editor integration (Lexical with Bold, Italic, Underline, Link, Heading)
  - Client components for admin dashboard, collection list, and document forms
  - Universal Postgres adapter (PGlite/PostgreSQL)
  - Plugins: form builder, nested docs, redirects
  - Vercel Blob storage adapter
  - Next.js integration with `withRevealUI` config wrapper
  - Logger, LRU cache, error handling, and type guard utilities
  - License validation and feature flag system
  - Security: CSP headers, input validation, rate limiting

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/contracts@1.0.0
  - @revealui/utils@0.2.0
