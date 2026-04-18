# @revealui/auth

## 0.4.0

### Minor Changes

- f6ba434: **BREAKING (pre-1.0):** Signup now defaults to closed. New deployments must set `REVEALUI_SIGNUP_OPEN=true` or `REVEALUI_SIGNUP_WHITELIST` to allow registration. Prevents accidental open registration on new deployments.

### Patch Changes

- Updated dependencies [80cc561]
- Updated dependencies [77a9a68]
- Updated dependencies [f6ba434]
- Updated dependencies [284fd1f]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
- Updated dependencies [0e459ca]
- Updated dependencies [2204021]
- Updated dependencies [59c670b]
- Updated dependencies [2204021]
- Updated dependencies [7db5151]
- Updated dependencies [2204021]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
  - @revealui/core@0.6.0
  - @revealui/db@0.4.0
  - @revealui/security@0.3.0
  - @revealui/config@0.4.0
  - @revealui/contracts@1.4.0

## 0.3.8

### Patch Changes

- Security hardening across packages: expanded dangerous URL scheme check, CodeQL alert resolution, Dependabot vulnerability fixes, security rule schemas with AST-typed ReDoS detection, and RBAC/ABAC enforcement tests.
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @revealui/db@0.3.7
  - @revealui/config@0.3.4
  - @revealui/security@0.2.7
  - @revealui/core@0.5.6
  - @revealui/contracts@1.3.7

## 0.3.7

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
  - @revealui/security@0.2.6
  - @revealui/config@0.3.3

## 0.3.6

### Patch Changes

- add SOC2 6.2 technical controls, local path leak detection, charge-readiness blocker fixes, and Gmail env vars to config schema
- Updated dependencies
- Updated dependencies
  - @revealui/db@0.3.5
  - @revealui/core@0.5.4
  - @revealui/contracts@1.3.5
  - @revealui/security@0.2.5
  - @revealui/config@0.3.2

## 0.3.5

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
  - @revealui/contracts@1.3.4
  - @revealui/core@0.5.3
  - @revealui/db@0.3.4

## 0.3.4

### Patch Changes

- fix(auth): passkey rpId reads from PASSKEY_RP_ID env var, throws in production if still localhost
- Updated dependencies
  - @revealui/db@0.3.3
  - @revealui/contracts@1.3.3
  - @revealui/core@0.5.2

## 0.3.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/db@0.3.2
  - @revealui/core@0.5.1

## 0.3.2

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.0

## 0.3.1

### Patch Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13
- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
  - @revealui/db@0.3.1
  - @revealui/contracts@1.3.1

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/core@0.3.0
  - @revealui/contracts@1.2.0
  - @revealui/db@0.3.0
  - @revealui/config@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.1.0
  - @revealui/core@0.2.1

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI session-based authentication.

  - Sign in, sign up, and sign out flows
  - Password reset with email tokens
  - bcrypt password hashing with configurable rounds
  - Rate limiting (per-IP and per-user)
  - Session management with cookie handling
  - Auth middleware and guards
  - Account lockout after failed attempts

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/config@0.2.0
  - @revealui/contracts@1.0.0
  - @revealui/core@0.2.0
  - @revealui/db@0.2.0
