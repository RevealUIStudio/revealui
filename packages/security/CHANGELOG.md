# @revealui/security

## 0.2.6

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
  - @revealui/utils@0.3.3

## 0.2.5

### Patch Changes

- add SOC2 6.2 technical controls, local path leak detection, charge-readiness blocker fixes, and Gmail env vars to config schema
- Updated dependencies
- Updated dependencies
  - @revealui/utils@0.3.2
  - @revealui/contracts@1.3.5

## 0.2.4

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
  - @revealui/contracts@1.3.4
  - @revealui/utils@0.3.1

## 0.2.3

### Patch Changes

- @revealui/contracts@1.3.3

## 0.2.2

### Patch Changes

- fix(security): RFC 6238 TOTP compliance — base32 decode key and 8-byte big-endian counter encoding so generated codes match standard authenticator apps
- Updated dependencies
  - @revealui/contracts@1.3.2

## 0.2.1

### Patch Changes

- @revealui/contracts@1.3.1

## 0.2.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.2.0
  - @revealui/utils@0.3.0
