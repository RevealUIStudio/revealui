---

## 0.6.1
### Patch Changes

- c77ac4f: Pro and Max subscription tiers now deep-link into the existing trial checkout path (`/signup?plan=pro|max`) instead of the waitlist contact form. Display strings only; no price or schema changes.
title: "@revealui/contracts"
description: "Breaking for any consumer importing the removed symbols (minor bumps under pre-1.0 SemVer)."
visibility: public
status: narrative
audience: user
---

# @revealui/contracts

## 0.6.0

### Minor Changes

- 363d4b5: Remove the RevealCoin (RVUI) on-chain payment integration. RevealCoin is a separate pre-launch product; this drops its wiring from the framework while leaving x402 micropayments (USDC on Base) fully intact.

  - **@revealui/contracts**: removed the RevealCoin module exports (token config, mint addresses, allocations, amount helpers) and the `rvuiDiscount` pricing field; the agent `pricing` schema is now USDC-only.
  - **@revealui/db**: dropped the `revealcoin_payments` and `revealcoin_price_snapshots` tables (migration `0016`) and their generated types.
  - **@revealui/services**: removed the `./revealcoin` entry point (on-chain client, price oracle, payment safeguards).
  - **@revealui/core**: x402 observability is USDC-only — removed the safeguard-rejection counter and narrowed the payment-metric currency/scheme labels.
  - **@revealui/mcp**: removed the `revealcoin` contracts-introspection category.

  Breaking for any consumer importing the removed symbols (minor bumps under pre-1.0 SemVer).

- e4a3779: Add server-side upload validation helpers and drop `image/svg+xml` from the
  media allowlist.

  `verifyMagicBytes(mimeType, bytes)` checks a file's leading bytes against its
  declared MIME type so a client cannot store active content (HTML/JS) under an
  image type, or a polyglot — fail-closed on unknown/unverifiable types.
  `extensionForMimeType(mime)` derives a safe storage extension from the verified
  type (never the user-supplied filename), and `sanitizeFilename(name)` strips
  path separators / control characters and clamps length. `image/svg+xml` is
  removed from `IMAGE_MIME_TYPES` (text/markup with no signature + an
  inline-script XSS vector; re-introduce only behind server-side sanitization).

### Patch Changes

- 9ec7c07: Fix the `SERVICE_OFFERINGS` discovery-call `ctaHref` slug. `cal.com/revealuistudio/revealui-discovery-call` returns HTTP 404; the live event slug is `discovery`. These offerings are dormant (the pricing API intentionally returns `services: []` until the `service` billing track is built), but the data is now correct for when they're wired — and the agency site already uses the correct `/discovery` link.

## 0.5.0

### Minor Changes

- f7ea9b4: Add `@revealui/contracts/secrets` subpath: `SecretPathSchema` (revvault path convention), `RotationEventSchema`, `SecretAuditEventSchema`, plus actor / reason / event-type enums and `parseSecretPath` / `isSecretPath` / `createRotationEvent` / `createSecretAuditEvent` factory helpers. Source-of-truth schemas for revvault IPC payloads and any TypeScript consumer of revvault-managed secrets. Hashes are SHA-256 hex digests; secret values are never carried in events or audit log entries by design.
- 47c75fe: feat(contracts): add @revealui/contracts/marketing-voice — shared primitives (Token + tokenize, typed predicate library, Rule discriminated union, checkRule dispatcher with 4 claim-drift variant checkers; CMS-content variants throw deferred-to-Phase-B). Used by CI claim-drift retirement (GAP-192) and the marketing-CMS spec Phase B runtime validators.
- a8ca087: **F8 Phase 1 of the contracts protocol-pyramid ADR** (`docs/decisions/2026-05-03-contracts-protocol-pyramid.md`) — adds a new MCP server `revealui-contracts` that exposes every `@revealui/contracts` category as MCP **resources** (read-only catalog of JSON Schemas) and matching MCP **tools** that parse arbitrary JSON against any registered schema.

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

- f56d3d3: Refactor revealcoin to consume @revealui/revealcoin-manifest

  Per docs/decisions/2026-05-03-revealcoin-manifest-transport.md §Phase 4,
  RVUI_MINT_ADDRESSES + RVUI_MINT_AUTHORITY now derive from
  manifest.networks; RVUI_ALLOCATIONS[].wallet derives from
  manifest.allocations by-name match. Human-decided fields
  (percentage, amount, vestingDescription) plus helpers
  (formatRvuiAmount, parseRvuiAmount, getRvuiMintAddress) unchanged.
  SolanaNetwork type is now re-exported from the manifest (same string
  union, no consumer-visible change). Existing exports preserved
  shape-identical per the ADR's "no behavior change for consumers"
  guarantee.

- f8199c8: Add `pending-payment` state to `A2ATaskStateSchema` and optional `pricing: { usdc, rvui? }` field to `AgentDefinitionSchema`. Schema-only PR 1 of GAP-149 (x402 A2A wiring); the new state and field are not yet emitted or consumed at runtime — PR 2 wires the A2A handler to emit on first call without proof and accept proof-of-payment headers.
- dbf405a: Expose `McpDocumentOperationsInsert`, `McpDocumentOperationsRow`, and `McpDocumentOperationsUpdate` through the explicit named-export list in `@revealui/contracts` (top-level) and `@revealui/contracts/database`.

  The underlying Zod schemas were auto-generated by the schema addition in PR-3b.2 (`packages/db/src/schema/mcp-document-operations.ts`), but the backward-compatibility named-export list in `packages/contracts/src/index.ts` and `packages/contracts/src/generated/database.ts` is hand-maintained. This changeset adds the three Mcp-document-operations types alongside the existing table types (AgentActions, CrdtOperations, Media, etc.) so downstream consumers importing by name rather than via `export *` pick them up.

  Pure additive — no breaking changes. Part of the Phase 3b raw-SQL migration arc.

- 3d09425: Stage 4.1 of the MCP v1 plan — expose RevealUI content as MCP resources.
  First cut of the content-pipeline-as-resources arc; the admin UI opt-out
  toggle + `revealui://<tenant>/…` URI scheme land with Stage 4.2.

  **`@revealui/contracts`:**

  - `CollectionStructure.mcpResource?: boolean` — declarative opt-out for
    exposing a collection's rows to MCP clients. Default behavior (when
    absent) is to expose. Added to both the TypeScript interface and the
    `CollectionStructureSchema` Zod schema.

  **`@revealui/mcp`:**

  - `revealui-content` server advertises the `resources` capability.
  - `resources/list` walks a curated default set (`posts`, `pages`,
    `products`, `media`) and returns one resource per row under the URI
    scheme `revealui-content://<collection>/<id>`. Partial upstream
    failure is tolerated — an unavailable collection doesn't blank the
    rest of the list.
  - `resources/read` parses the URI, fetches the record from
    `/api/<collection>/<id>`, and returns the JSON verbatim as an
    `application/json` text block.
  - Malformed URIs + collections outside the default set throw with
    clear messages.

  5 new integration tests (mcp: 195 → 200 passing / 5 skipped). The
  curated default set is the minimum-viable surface — collection-config
  introspection (which consults `mcpResource`) lands with Stage 4.2
  alongside the admin UI toggle.

### Patch Changes

- 54557b7: Add `invoice.payment_action_required` to RELEVANT_STRIPE_WEBHOOK_EVENTS (12 → 13) for 3DS/SCA authentication flows
- 6afae69: Add `payment_intent.requires_action` to RELEVANT_STRIPE_WEBHOOK_EVENTS (13 → 14) for 3DS/SCA authentication flows on one-time charges (perpetual licenses, credit bundles, support renewal). Closes GAP-124 surface 5 BLOCKING.
- ad6aa4c: Drop the 710-line dead parallel `AgentMemory` implementation at `packages/contracts/src/entities/agent-memory.ts` (and its barrel re-exports from `entities/index.ts`). The canonical AgentMemory shape lives at `packages/contracts/src/agents/index.ts` and is what every production caller (14+ in `@revealui/ai`) actually imports — `from '@revealui/contracts/agents'` (or via the top-level `@revealui/contracts` re-export, which already points at the agents path). The `entities/agent-memory.ts` implementation was a richer but unused parallel design with `Date` objects, lifecycle helpers, computed views, etc.; verified zero production imports of any `AgentMemory*` symbol via the `@revealui/contracts/entities` subpath. Closes GAP-135.
- 0eb3131: Drop the vestigial `SessionSchema` / `Session` type / `createSession` helper from `packages/contracts/src/entities/user.ts`. They were the older ISO-string shape (predating `entities/session.ts`), still re-exported at top level even though every `import { Session } from '@revealui/contracts'` consumer was zero (verified). Top-level `@revealui/contracts` now redirects `Session` and `SessionSchema` to the comprehensive Date-typed shape from `entities/session.ts` (which the entities barrel already pointed at). Also removes the orphan `SESSION_SCHEMA_VERSION` constant from `user.ts` and its `USER_SESSION_SCHEMA_VERSION` alias re-export from `entities/index.ts` (the canonical `SESSION_SCHEMA_VERSION` lives in `entities/session.ts`). Closes GAP-134.
- 25dba49: Hoist the verbatim-duplicate `Database<T>` generic out of `database/bridge.ts` and `database/type-bridge.ts` into a new shared module `database/types.ts`. Both files now `import type` + re-export from the canonical location, eliminating ~50 lines of duplication. Public API is unchanged: `import { Database } from '@revealui/contracts/database/bridge'` (or `/type-bridge`) still works because both modules re-export the type. Closes GAP-136 Phase 1. Phase 2 (renaming the unrelated concrete `interface Database` in `generated/database.ts` to disambiguate) is intentionally deferred — that file is auto-generated and a rename needs generator-tooling investigation; tracked separately if/when prioritized.
- 9a6ebb3: Honest perpetual-tier CTA labels: change `cta: 'Buy License'` → `cta: 'Contact Sales'` for Pro Perpetual and Agency Perpetual entries in `PERPETUAL_TIERS` (`packages/contracts/src/pricing.ts:369,384`). The `ctaHref` for these tiers is a `mailto:` link — i.e. it opens an email to support@revealui.com — which is a "contact us" flow, not a self-serve license purchase. The previous "Buy License" label implied immediate purchase; the new label matches the actual flow and is parallel to the existing Enterprise Perpetual entry (line 399, already labeled "Contact Sales").

  Audit reference: `.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md` Phase 0 Item 0.4. No behavior change — `ctaHref` and the rest of the tier metadata are unchanged. Only the button label is updated.

- 1f7ae24: Fix: RVUI_MINT_ADDRESSES dist regenerated from manifest source. Pre-fix dist had hardcoded mainnet-beta=devnet-address. Affects only external npm consumers; in-tree consumers always read src/ via workspace links.

  The previously published `1.4.0` dist predated the manifest-derived refactor in `packages/contracts/src/revealcoin.ts:59-79` (`deriveNetworkRecord` + the `RVUI_MINT_ADDRESSES` / `RVUI_MINT_AUTHORITY` exports). External consumers of `@revealui/contracts@1.4.0` from npm therefore read the wrong `mainnet-beta` value (the devnet mint address copied across networks). Bumping to `1.4.1` with a clean `pnpm --filter @revealui/contracts build` republishes the correct manifest-derived behavior — empty string for unconfigured networks, the real address only when `REVEALCOIN_MANIFEST.networks[network].mintAddress` is non-empty.

  Behavioral fix only. No exported types or schemas change. Per `~/revfleet/.jv/.claude/rules/versioning.md` `@revealui/contracts` exception, patch is the correct semver level (no breaking change).

  Audit reference: `~/revfleet/.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md` §5 Phase 0. Related: revealui#763 (revealcoin frontend mainnet honesty) — same dishonesty class on the frontend; this PR closes the npm-consumer side.

- 2eb63dc: Pre-flip pricing honesty: reframe Enterprise tier as RevealUI Fleet OEM (white-label deployment), drop services from public API response, update FEATURE_LABELS for accuracy.

  - `SUBSCRIPTION_TIERS[3]` (Enterprise): bullet `'Multi-tenant architecture'` + `'White-label branding (coming soon)'` → single bullet `'RevealUI Fleet license — branded white-label deployment for your own customers (managed setup)'`. The "multi-tenant architecture" claim implied hosted SaaS multi-tenancy; code ships single-instance license-enforced self-host with per-customer revforge stamping for Enterprise. The new copy matches what's actually deliverable today (white-label deployment via hand-stamped revforge kits).
  - `PERPETUAL_TIERS[1]` (Agency Perpetual): description `'Deploy for multiple clients without per-site subscriptions.'` → `'RevealUI Fleet license for agencies. Sell branded RevealUI to your clients without per-site subscriptions.'` Leans into the OEM/reseller positioning the agency-perpetual track was always implicitly serving.
  - `FEATURE_LABELS.multiTenant` (`'Multi-tenant Management'` → `'Multi-site Content Management'`): the feature flag governs within-install multi-site management (the `sites` table), not hosted SaaS multi-tenancy. New label removes the ambiguity.
  - `FEATURE_LABELS.whiteLabel` (`'(Coming Soon)'` → `'(managed setup via revforge)'`): white-label is available today via hand-stamped revforge kits at the Enterprise tier; "coming soon" understated what's already shipped.

  Audit reference: `.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md` §5 Phase 1.9 (multi-tenant copy resolution) and the service-offering deliverability audit (2026-05-10). No type-level breaking changes — exports, type shapes, and enum keys all unchanged.

- 5479d59: Pro and Max subscription tiers: CTA changed from "Start Free Trial" to "Join the waitlist", with `ctaHref` pointed at the contact page. Stripe runs in TEST mode in production — there is no live trial-to-paid path yet, so "Start Free Trial" overstated what the funnel can deliver. Per the 2026-05-14 public messaging audit (honesty doctrine). The admin upgrade page does not consume `ctaHref`, so the in-app upgrade flow is unaffected.

## 0.4.0

### Retroactive demotion: 1.4.0 → 0.4.0

This package never met the 1.0.0 promotion criteria laid out in `docs/methodology.md` versioning conventions (real external consumers, stable contract across multiple release cycles, breaking-change discipline). It should have stayed pre-1.0 like every other `@revealui/*` package (`@revealui/core` at 0.6.0, `@revealui/db` at 0.4.0, etc.).

Per the April 2026 precedent (`revealui-doctor` / `-handoff` / `-sync-lts` demoted from `2.0.0` to `0.2.0`), the iteration count is preserved as the minor: `1.4.0` → `0.4.0`.

**Action required for npm consumers:**

- Published `1.x` versions on npm have been deprecated.
- Install `^0.4.0` going forward.
- API surface is unchanged — this is a version-string fix, not a behavior change.

## 1.4.0

### Patch Changes

- f6ba434: Add prices to service offerings (Architecture Review $3,500, Launch Package $7,500, Migration Assist $300/hr, Consulting Hour $300/hr). CTAs now link to Cal.com booking instead of mailto. Update service offering order: launch package before migration assist.
- Updated dependencies [77a9a68]
- Updated dependencies [f6ba434]
- Updated dependencies [59c670b]
  - @revealui/db@0.4.0

## 1.3.7

### Patch Changes

- Security hardening across packages: expanded dangerous URL scheme check, CodeQL alert resolution, Dependabot vulnerability fixes, security rule schemas with AST-typed ReDoS detection, and RBAC/ABAC enforcement tests.
- Updated dependencies
  - @revealui/db@0.3.7

## 1.3.6

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
  - @revealui/db@0.3.6

## 1.3.5

### Patch Changes

- add NeonSaga transaction-safe operations layer, idempotency keys migration, CRDT optimistic locking fix, observability routes, and database health check error surfacing
- Updated dependencies
  - @revealui/db@0.3.5

## 1.3.4

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
  - @revealui/db@0.3.4

## 1.3.3

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.3

## 1.3.2

### Patch Changes

- fix(contracts): regenerated Zod schemas and contract types to include new `deletedAt` columns on orders and licenses tables
- Updated dependencies
  - @revealui/db@0.3.2

## 1.3.1

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/db@0.3.1

## 1.2.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.0

## 1.1.0

### Minor Changes

- Add vision/multipart message support to ChatRequestContract.

  Introduces `TextPart`, `ImagePart`, and `ContentPart` schemas so message content can be either a plain string or an array of content parts (text + image_url). This aligns with the OpenAI vision API format and enables inference-snaps multimodal models (Gemma 3, Qwen 2.5 VL) to be used through the chat endpoint.

## 1.0.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI type contracts and Zod schemas.

  - CMS type contracts: `CollectionConfig`, `GlobalConfig`, `Field`, `Block`, access and hook types
  - Agent type contracts and definitions
  - Block types for rich text CMS content
  - Validation utilities: `defineCollection`, `defineGlobal`, `defineField`, `validateWithErrors`
  - Extensibility: `registerCustomFieldType`, `registerPluginExtension`
  - Generated entity types for all database tables (Users, Sessions, Pages, Posts, Media, etc.)
  - Zod schemas for runtime validation with TypeScript type inference

### Patch Changes

- Updated dependencies [4d76d68]
  - @revealui/db@0.2.0
