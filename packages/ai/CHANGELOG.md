# @revealui/ai

## 0.3.0

### Minor Changes

- 1f2d9b2: Expose two previously internal-but-documented modules as public subpath imports:

  - `@revealui/ai/a2a` — agent card registry, JSON-RPC handler, and task-store helpers (`agentCardRegistry`, `handleA2AJsonRpc`, `createTask`, `cancelTask`, `getTask`, `appendArtifact`, etc.)
  - `@revealui/ai/orchestration/runtime` — non-streaming `AgentRuntime` (complement to the existing `./orchestration/streaming-runtime`)

  Both modules have existed in source and dist for multiple releases but were not listed in `package.json#exports`. `docs/AI.md` references them directly.

  Duplicates the `./orchestration/runtime` entry added in the pending AI prompt-caching PR — merge order agnostic, the entries are identical.

- 4bb1466: Add subpath exports for AI caching, orchestration, and skills registry helpers:

  - `@revealui/ai/llm/cache-utils` — `withCache`, `cacheableSystemPrompt`, and related prompt-caching helpers
  - `@revealui/ai/llm/response-cache` — `getGlobalResponseCache`, `calculateResponseCacheSavings`
  - `@revealui/ai/llm/semantic-cache` — `getGlobalSemanticCache`, `calculateSemanticCacheSavings`
  - `@revealui/ai/orchestration/runtime` — non-streaming agent runtime (complement to the existing `./orchestration/streaming-runtime`)
  - `@revealui/ai/skills/registry` — `globalSkillRegistry`, `SkillRegistry`, `SkillStorageConfig`

  Docs under `docs/ai/PROMPT_CACHING.md`, `docs/ai/RESPONSE_CACHING.md`, and `docs/ai/SEMANTIC_CACHING.md` reference these paths; they previously resolved only via deep relative paths.

- 2204021: Remove the legacy log-redaction duplicates in favor of the audited `@revealui/security` chokepoint.

  - `@revealui/core`: `sanitizeLogData` (exported from `@revealui/core/observability/logger`) is gone. Replace with `redactLogContext` from `@revealui/security` — same intent, broader coverage (recurses into arrays, scrubs inline secret shapes in string values, depth-capped at 8).
  - `@revealui/ai`: `redactSensitiveFields` (exported from `@revealui/ai/llm/client`) is gone. Replace with `redactLogContext` from `@revealui/security`.

  Behavior is strictly broader, not narrower, so existing redactions continue to fire. Consumers that relied on arrays being passed through unredacted will now see array members walked.

### Patch Changes

- Updated dependencies [80cc561]
- Updated dependencies [77a9a68]
- Updated dependencies [f6ba434]
- Updated dependencies [284fd1f]
- Updated dependencies [f6ba434]
- Updated dependencies [0e459ca]
- Updated dependencies [59c670b]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
  - @revealui/core@0.6.0
  - @revealui/db@0.4.0
  - @revealui/contracts@1.4.0

## 0.2.9

### Patch Changes

- Complete CRDT implementation with sync, replay, and GC. MCP default reply-to from env var. Autonomous agent architecture phases 2-3.
- Updated dependencies
- Updated dependencies
  - @revealui/db@0.3.7
  - @revealui/core@0.5.6
  - @revealui/contracts@1.3.7

## 0.2.8

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
  - @revealui/core@0.5.5
  - @revealui/db@0.3.6
  - @revealui/contracts@1.3.6

## 0.2.7

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.5
  - @revealui/core@0.5.4
  - @revealui/contracts@1.3.5

## 0.2.6

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.3.4
  - @revealui/core@0.5.3
  - @revealui/db@0.3.4

## 0.2.4

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.3
  - @revealui/contracts@1.3.3
  - @revealui/core@0.5.2

## 0.2.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/db@0.3.2
  - @revealui/core@0.5.1

## 0.2.2

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
  - @revealui/db@0.3.1
  - @revealui/contracts@1.3.1

## 0.2.0

### Minor Changes

- Add `restDb` parameter to IngestionPipeline constructor for dual-database support (Neon + Supabase vector store).

  BREAKING: `IngestionPipeline` now takes 3 arguments `(db, restDb, embeddingFn)` instead of 2 `(db, embeddingFn)`.
