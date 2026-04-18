# @revealui/core

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
- 0e459ca: **`@revealui/presentation`** — expose 4 Catalyst-style components from the main barrel:

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
