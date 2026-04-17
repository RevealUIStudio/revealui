# @revealui/config

## 0.4.0

### Minor Changes

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

## 0.3.4

### Patch Changes

- OpenAPI Phase B with native Zod-to-OpenAPI scaffold. Pipeline gap fixes, pre-push tests, code-pattern scanner. Dependency updates and SDLC hardening.

## 0.3.3

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

## 0.3.2

### Patch Changes

- add SOC2 6.2 technical controls, local path leak detection, charge-readiness blocker fixes, and Gmail env vars to config schema

## 0.3.1

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

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI configuration management.

  - Environment variable handling and validation
  - Configuration merging and resolution
  - Type-safe config access
