# @revealui/harnesses

## 0.1.9

### Patch Changes

- VAUGHN Phase 2 protocol implementation: type foundation (adapter interface, capabilities, event envelope, degradation strategies), runtime wiring (event normalizer, config normalizer, capability-aware dispatch, RPC methods), and RevealUI Agent adapter upgrade with VAUGHN bridge.
- Updated dependencies
  - @revealui/core@0.5.6

## 0.1.8

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

## 0.1.7

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.4

## 0.1.6

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.3

## 0.1.5

### Patch Changes

- @revealui/core@0.5.2

## 0.1.4

### Patch Changes

- @revealui/core@0.5.1

## 0.1.3

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
