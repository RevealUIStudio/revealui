# @revealui/ai

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
