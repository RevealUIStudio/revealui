# @revealui/cache

## 0.4.0

### Minor Changes

- f727852: Add tag-aware `createCachedFunction`, `revalidateTag`, and `revalidatePath` over `CacheStore` (GAP-194 Phase 3 Tier 0 step 3.7a). Explicit `keyParts` prevent zero-arg key collisions; tags drive `deleteByTags`. Process default store via `getDefaultCacheStore` / `setDefaultCacheStore`. Admin CMS data reads and tag invalidation migrate off `next/cache` unstable_cache; Next `revalidatePath` remains for Full Route Cache while admin is still on Next.js.

## 0.2.5

### Patch Changes

- Updated dependencies [16b235f]
- Updated dependencies [578214d]
- Updated dependencies [b550aa2]
  - @revealui/security@0.5.0

## 0.2.4

### Patch Changes

- Updated dependencies
  - @revealui/security@0.4.3

## 0.2.3

### Patch Changes

- @revealui/security@0.4.2

## 0.2.2

### Patch Changes

- @revealui/security@0.4.1

## 0.2.1

### Patch Changes

- Updated dependencies [198e56a]
- Updated dependencies [1d5a9e4]
- Updated dependencies [0f2906c]
  - @revealui/security@0.4.0

## 0.1.5

### Patch Changes

- @revealui/security@0.3.1

## 0.1.4

### Patch Changes

- Browser PGlite cache with offline mutation queue (Cache Phase E), SOC2 6.2 controls, and preflight fixes.

## 0.1.3

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

## 0.1.2

### Patch Changes

- add PGlite adapters for rate limiter, circuit breaker, and cache invalidation channel with atomic rate limit checks and backslash escaping fix

## 0.1.1

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

## 0.2.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.
