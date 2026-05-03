---
'@revealui/mcp': minor
'@revealui/contracts': minor
---

**F8 Phase 1 of the contracts protocol-pyramid ADR** (`docs/decisions/2026-05-03-contracts-protocol-pyramid.md`) — adds a new MCP server `revealui-contracts` that exposes every `@revealui/contracts` category as MCP **resources** (read-only catalog of JSON Schemas) and matching MCP **tools** that parse arbitrary JSON against any registered schema.

## `@revealui/mcp` (minor)

**New: contracts introspection MCP server.** Lives at `packages/mcp/src/servers/factories/contracts.ts` (factory) + `packages/mcp/src/servers/contracts.ts` (stdio launcher). Exposed via the new `@revealui/mcp/contracts-server` subpath export.

- **Resources:**
  - `revealui-contracts://catalog` — full discovery payload listing every category, primary schema name, secondary schema names, and human description.
  - `revealui-contracts://<category>` — JSON document for a single category, returning `{ category, primarySchema, schemas: Record<name, JSONSchema7> }`.
- **Tools:**
  - `contracts_list_categories` — same payload as the catalog resource (tool form for clients that prefer tool-call ergonomics).
  - `contracts_get_schema({ category, schema? })` — return the JSON Schema for a single `(category, schemaName)` pair. Defaults to the category primary when `schema` is omitted.
  - `contracts_validate_<category>({ schema?, data })` — one tool per registered category. Parses `data` against the named schema (defaults to category primary). Returns `{ success: true, data }` | `{ success: false, issues }`.
- **Categories surfaced (17):** a2a, admin, agents, api_auth, api_chat, api_gdpr, content, content_validation, devkit_profiles, entities, generated, providers, representation, revealcoin, secrets, security, stripe_webhook_events.
- **License:** intentionally NOT Pro-gated. `@revealui/contracts` is MIT and agent-side schema introspection is meant to enable any MCP client (Claude Code, Cursor, custom agents) to integrate cleanly. Pro-gating a public-package primitive would defeat the purpose.
- **Tests:** 70+ unit tests at `packages/mcp/src/__tests__/contracts-server.test.ts` (≥1 happy + 1 sad path per category, ADR's 34-minimum target comfortably exceeded).
- **README:** new section #8 + bumped "12 MCP Servers" → "13 MCP Servers" (claim-drift CI requires ground-truth count).

Also exposes `validatePayload(category, schemaName, data)` and `REGISTERED_CATEGORIES` for in-process consumers (the `@revealui/ai` package + future hypervisor wiring).

## `@revealui/contracts` (minor — additive)

**New subpath exports** for categories that already existed in `src/` but weren't exposed via `package.json` `exports`:

- `@revealui/contracts/a2a` — A2A AgentCard / Task / Message / Skill / Artifact / JSON-RPC envelopes.
- `@revealui/contracts/api/auth` — sign-in / sign-up / password reset / MFA / passkey / recovery.
- `@revealui/contracts/api/chat` — ChatRequest / ChatMessage.
- `@revealui/contracts/api/gdpr` — GDPRDeleteRequest / GDPRExportRequest.

These were already accessible via the root barrel (`from '@revealui/contracts'`); the new subpaths give consumers per-category granularity matching the existing pattern (`/entities`, `/representation`, etc.). Purely additive — no existing imports change behavior.

No code changes elsewhere in the contracts package.
