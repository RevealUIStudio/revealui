---
"@revealui/openapi": minor
"@revealui/mcp": minor
---

F8 Phase 3 Stage 1 — Contracts OpenAPI mirror codegen pipeline.

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
