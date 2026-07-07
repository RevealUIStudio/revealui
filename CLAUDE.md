---
title: "RevealUI Monorepo"
description: "Agentic business runtime. People, content, offers, payments, and agents - pre-wired, open source, and ready to deploy."
visibility: internal
status: verified
audience: agent
---

# RevealUI Monorepo

Agentic business runtime. People, content, offers, payments, and agents  -  pre-wired, open source, and ready to deploy.

## Current Phase
**Phase 5  -  Agent-First Infrastructure** (post-Phase 4). See `docs/MASTER_PLAN.md` for the active 5.x tracks.

## Stack
- React 19, Next.js 16 (admin), Vite (docs / marketing), Hono (server), Node 24, TypeScript 6
- pnpm 10, Turborepo, Biome 2, Vitest 4
- Drizzle ORM (NeonDB), Tailwind CSS v4
- Cloudflare R2 (S3-compatible object storage; replacing Vercel Blob)
- Lexical (rich text), ElectricSQL (sync), Stripe (payments)

## Git Identity
RevealUI Studio <founder@revealui.com>

## Branch Pipeline
```
feature/* ──PR──▶ test ──PR──▶ main
                    │              │
              CI              production deploy
```

| Branch | Environment | CI | Deploy |
|--------|------------|-----|--------|
| `main` | production | Full gate + integration + E2E | Auto (push to main triggers `deploy.yml`) |
| `test` | QA/staging | Full gate (quality + typecheck + tests + build) | Manual only (`deploy-test.yml` workflow_dispatch) |
| `feature/*` | local | PR-level: affected-only typecheck + build, unit tests | None |

- **Default branch:** `test` (PRs target it by default)
- **Production deploys:** `deploy.yml` on push to `main` only (Vercel Git Integration disabled)
- **Test previews:** `deploy-test.yml` manual trigger  -  Vercel preview URLs, not production
- **Pre-push gate:** `main`/`test` = full gate, `feature/*` = quality-only (phase 1)
- **CI:** Triggers on push/PR to `test` or `main`

## Package Map

### Apps (4)
| App | Port | Framework | Purpose |
|-----|------|-----------|---------|
| server | 3004 | Hono | REST API (OpenAPI + Swagger) |
| admin | 4000 | Next.js 16 | Admin dashboard, content management + system monitoring |
| docs | 3002 | Vite/React | Documentation site (docs.revealui.com) |
| marketing | 3000 | Vite/React | Product marketing site (revealui.com) |

> Note: the RevealUI Studio agency site (revealuistudio.com) lives in a
> separate repo. It consumes `@revealui/{router,presentation,core,contracts}`
> via npm rather than via workspace links — same brand surface, decoupled
> repo + deploy cadence.

### OSS Packages (MIT) — 21
| Package | Purpose |
|---------|---------|
| @revealui/core | admin engine, REST API, auth, rich text, admin UI, plugins |
| @revealui/contracts | Zod schemas + TypeScript types (single source of truth) |
| @revealui/db | Drizzle ORM schema (85 tables) on NeonDB (Postgres) — legacy Supabase code remains in tree during phase-out |
| @revealui/auth | Session auth, password reset, rate limiting |
| @revealui/presentation | Native UI components in `packages/presentation/src/components/` (Tailwind v4, zero external UI deps  -  only clsx + CVA) |
| @revealui/router | Lightweight file-based router with SSR |
| @revealui/config | Type-safe env config (Zod + lazy Proxy) |
| @revealui/utils | Logger, DB helpers, validation |
| @revealui/cli | `create-revealui` scaffolding tool |
| @revealui/setup | Environment setup utilities |
| @revealui/sync | ElectricSQL real-time sync |
| @revealui/cache | CDN config, edge cache, ISR presets, revalidation |
| @revealui/resilience | Circuit breaker, retry, bulkhead patterns |
| @revealui/security | Headers, CORS, RBAC/ABAC, encryption, audit, GDPR |
| create-revealui | `npm create revealui` initializer |
| revealui | Meta-installer that proxies to `create-revealui` (unpublished — npm name collision) |
| @revealui/dev | Shared configs (Biome, TS, Tailwind, Vite) + editor config sync (Zed, VS Code) |
| @revealui/test | E2E specs (Playwright), integration tests, fixtures, mocks, test utilities |
| @revealui/openapi | Type-safe OpenAPI 3.x for Hono — route definitions, Zod validation, spec generation + Swagger UI |
| @revealui/paywall | Runtime license enforcement, feature gating, and upgrade UI (Stripe + x402) |
| @revealui/tokens | Design tokens — canonical CSS variables, typed TS export, brand canon (zero internal deps) |

### Pro Packages (Fair Source  -  FSL-1.1-MIT, converts to MIT after 2 years) — 5
| Package | Purpose |
|---------|---------|
| @revealui/ai | AI agents, CRDT memory, LLM providers, orchestration |
| @revealui/engines | Unified entry point for the five business primitives (private workspace package) |
| @revealui/harnesses | AI harness adapters, workboard coordination, JSON-RPC |
| @revealui/mcp | MCP hypervisor, adapter framework, tool discovery |
| @revealui/services | Stripe (billing + circuit breaker), Vercel (deploy + DNS) |

### Internal Package (no license, build tooling) — 1
| Package | Purpose |
|---------|---------|
| @revealui/scripts | Shared monorepo script utilities — logging, paths, exec, workflow state, validation. `private: true`, no `license` field — outside the OSS/Pro split. |

## Common Commands

### Development
```bash
pnpm dev                    # Start all apps in parallel
pnpm dev:app                # Build auth + start Admin + API (port 4000 + 3004)
pnpm dev:api                # Start API only (port 3004)
pnpm dev:admin              # Build auth + start Admin only (port 4000)
```

### Building
```bash
pnpm build                  # Build all (turbo, respects dependency order)
pnpm build:api              # Build API only
pnpm build:admin            # Build auth + Admin
```

### Testing
```bash
pnpm test                   # Run all tests (turbo, 15 concurrency)
pnpm test:coverage          # Tests with coverage
pnpm test:e2e               # Playwright E2E tests
pnpm test:integration       # Integration tests
```

### Quality
```bash
pnpm gate                   # Full CI gate (lint, typecheck, test, build)
pnpm gate:quick             # Quick gate (phase 1 only)
pnpm lint                   # Biome lint
pnpm lint:fix               # Auto-fix lint issues
pnpm format                 # Biome format
pnpm typecheck:all          # TypeScript check all packages
```

### Auditing
```bash
pnpm audit:any              # Find avoidable `any` types
pnpm audit:console          # Find production console statements
pnpm preflight              # Full pre-launch checklist (15 checks)
```

### Database
```bash
pnpm db:init                # Initialize database
pnpm db:migrate             # Run migrations
pnpm db:seed                # Seed sample content
pnpm db:reset               # Reset database
```

### Publishing
```bash
pnpm changeset              # Create changeset
pnpm changeset:version      # Apply versions
pnpm changeset:publish      # Publish to npm
pnpm changeset:status       # Check changeset status
```

### Dependencies
```bash
pnpm deps:check             # Check for mismatches (syncpack)
pnpm deps:fix               # Fix mismatches
```

## Key Patterns

### Workspace References
Always use `workspace:*` for internal package dependencies:
```json
"@revealui/core": "workspace:*"
```

### Package Filtering
```bash
pnpm --filter @revealui/core test    # Run tests for one package
pnpm --filter ./packages/* build     # Build all packages
pnpm --filter admin dev                # Dev one app
```

### admin Collections
Collections are defined in `apps/admin/src/collections/` with access control, hooks, and field definitions. Use `@revealui/contracts` for type schemas.

### Feature Gating
Pro features use `isLicensed('pro')` and `isFeatureEnabled('ai')` from `@revealui/core`. Tiers: free, pro, max, enterprise.

### Database Schema
Schemas are in `packages/db/src/schema/`. Use Drizzle ORM for queries. NeonDB (Postgres) is the primary store. Legacy Supabase code (vectors, some auth flows) remains in tree during phase-out — **new features must not depend on Supabase-specific behavior**. The Supabase MCP adapter at `packages/mcp/src/servers/supabase.ts` is intentionally retained as an adapter for customers who use Supabase, separate from internal usage.

### Testing
- Unit/integration: Vitest (`*.test.ts`)
- E2E: Playwright (`*.e2e.ts`)
- Test helpers: `@revealui/test` package
- Unit tests mock the DB (or use in-process PGlite where a package embeds Postgres — cache, mcp, harnesses); relational integration tests run against a real Postgres via `pnpm db:setup-test`

## Engineering Posture

Key postures — full definitions in `docs/methodology.md`.

- **Audit-first SDLC (M5):** every meaningful change starts with an audit of existing state (file paths + line numbers + intentional-vs-accidental classification). Audit precedes proposal, always.
- **No-regex (M2):** zero regex authored in the fleet. Use AST walkers, typed predicates, `Set`/`Map` lookups, `Intl.Segmenter`, and built-in parsers (`URL`, `JSON.parse`, `Date.parse`). Third-party regex-string config marked `// REGEX-CONFIG-BOUNDARY` and minimized.
- **Revvault-first (M4):** all secrets live in `revvault`. No `.env` primary. No plaintext on disk. See `docs/SECRETS.md`.
- **Per-session beacons + note.js (M9):** `session-note` SKILL + `note.js` CLI provide handoff continuity across Claude Code sessions. Context beacon written on stop.
- **Workboard automation (M10):** `workboard-check.js` (read-only drift detector, fires on session-start) + `workboard-sweep.js` (idempotent cleanup, agent reviews diff + commits manually). Hooks never write to the workboard by design.
- **Charge-readiness (M11):** subscription billing 3 days from live; Stripe LIVE_MODE owner-gated. Pro-package gates being removed via Path A (FSL-1.1-MIT normalization).

## Build & Security Status
- All workspaces build and typecheck clean (run `pnpm build` and `pnpm typecheck:all`)
- Extensive test suite across unit, integration, and E2E layers (run `pnpm test` for current count)
- Pinned overrides enforce minimum safe versions for transitive deps (see `pnpm.overrides` block in root `package.json`)
- React 19 (resolved patch tracked via `pnpm-lock.yaml`; minimum-safe range pinned per `pnpm.overrides`; CVE-2025-55182 React2Shell mitigated)
- GitHub security alerts (CodeQL + Dependabot) monitored via the Security tab; future triage trackers land in the private coordination hub per the issue-redaction convention
- AST-based code-pattern analyzer: execSync injection, TOCTOU, ReDoS (ret parser + contracts schemas)
- Pre-push gate runs affected tests on protected branches
- Run `pnpm audit:any` and `pnpm audit:console` for current any/console counts (warn-only)

## CI Gate Architecture
The `pnpm gate` script runs 3 phases:
1. **Quality** (parallel): Biome lint (hard fail), audits (warn), structure (warn), security (warn), boundary validation (hard fail), claim-drift validation (hard fail)
2. **Type checking** (serial): `pnpm -r typecheck` across all workspaces
3. **Test + Build** (parallel): Vitest (hard fail), turbo build (hard fail)

Biome, boundary, claim-drift, typecheck, tests, and build all block pushes. Audits and structure checks are warn-only.

## Security
- CSP, CORS, HSTS headers in `@revealui/security` (re-exported via `packages/core/src/security/`)
- Auth: bcrypt (12 rounds), brute force protection, rate limiting, session-only (no JWT)
- Session cookies: httpOnly, secure, sameSite=lax  -  set in sign-in/sign-up/OAuth routes
- Admin gate: proxy.ts checks `revealui-role` cookie for /admin routes (defense-in-depth)
- Access control: find/findByID enforce `access.read`, update enforces `access.update`, delete enforces `access.delete` (boolean or WhereClause)
- `overrideAccess` query param stripped from external requests in proxy.ts
- License enforcement: 5-min DB status check (checkLicenseStatus) + requireFeature middleware on Pro routes
- Feature gates: AI routes (agent-tasks, agent-stream, RAG, collab/agent), dashboard (provenance)
- Resource limits: enforceSiteLimit on site creation, advisory-locked user limit in admin sign-up
- Encryption keys: non-extractable by default (configurable via `extractable` option)
- Rich text: isSafeUrl() blocks javascript:/vbscript:/data: in Lexical link/image rendering
- Webhook rate limiting: 100 req/min on /api/webhooks
- Cross-DB cleanup: `@revealui/db/cleanup` for orphaned legacy-Supabase data after site deletion (relevant during migration; will retire once phase-out completes)
- RBAC + ABAC policy engine in core (enforcement tests in `packages/core/src/__tests__/auth/` and `packages/core/src/collections/operations/__tests__/access-enforcement.test.ts` prove role isolation)
- GDPR compliance framework (consent, deletion, anonymization)
- AI memory validation: prototype pollution prevention, depth/size limits
- CI: CodeQL, Gitleaks, dependency auditing, secret scanning (security-audit.yml, consolidated)
