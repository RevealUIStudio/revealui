# @revealui/openapi

## 0.3.0

### Minor Changes

- 7b481c8: F8 Phase 3 Stage 1 — Contracts OpenAPI mirror codegen pipeline.

  `@revealui/openapi` (0.2.3 → 0.3.0):

  - New `scripts/emit-from-mcp.ts` emits a contracts-types-only OpenAPI 3.1 doc from the contracts MCP server's catalog
  - New committed reference `packages/openapi/contracts.openapi.json` (109 components from 17 categories)
  - New `pnpm emit:contracts` and `pnpm check:contracts` package scripts
  - New CI gate `Contracts OpenAPI mirror drift` (hard-fail) wired into `pnpm gate` Phase 1
  - Added 23 unit tests in `src/__tests__/emit-from-mcp.test.ts` (deterministic output, schema completeness, OpenAPI 3.1 conformance, regression pins for PR #731's contracts surface)
  - README section "Contracts mirror — cross-language codegen pipeline"

  `@revealui/mcp` (0.3.0 → 0.4.0):

  - New public exports `getContractsCatalog()` and `ContractCategoryName` / `ContractCategorySchemas` types from `@revealui/mcp/contracts-server`
  - The factory's previously-private `buildJsonSchemaCache` is refactored into the public `getContractsCatalog`; the contracts MCP server still calls it internally — single source of truth for the JSON Schema catalog
  - Bypasses the package's index.ts barrel (consumers import via `@revealui/mcp/contracts-server` to avoid triggering other server launchers' license-check side effects on import)

  Stages 2 (apps/server `/openapi.json` route exposing the contracts doc) and 3 (revdev/apps/console oapi-codegen + revvault Rust progenitor consumer wiring) are deferred to follow-on PRs — Stage 1 is complete-on-its-own infrastructure.

  Per [`docs/decisions/2026-05-03-contracts-protocol-pyramid.md`](https://github.com/RevealUIStudio/revealui-jv/blob/main/docs/decisions/2026-05-03-contracts-protocol-pyramid.md) §"Phase 3" in the internal `revealui-jv` repo.

## 0.2.3

### Patch Changes

- OpenAPI Phase B with native Zod-to-OpenAPI scaffold. Pipeline gap fixes, pre-push tests, code-pattern scanner. Dependency updates and SDLC hardening.

## 0.2.2

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

## 0.2.1

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
