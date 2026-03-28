# RevealUI Monorepo

Business Operating System Software (B.O.S.S.). Build your business, not your boilerplate. Users, content, products, payments, and AI — pre-wired, open source, and ready to deploy.

## Current Phase
**Phase 3 — Launch Preparation** (docs, OSS prep, marketing, Pro distribution).

## Stack
- React 19, Next.js 16, Node 24, TypeScript 6
- pnpm 10, Turborepo, Biome 2, Vitest 4
- Drizzle ORM (NeonDB + Supabase), Hono, Tailwind CSS v4
- Lexical (rich text), ElectricSQL (sync), Stripe (payments)

## Git Identity
RevealUI Studio <founder@revealui.com>

## Branch Pipeline
```
feature/* ──PR──▶ develop ──PR──▶ test ──PR (1+ review)──▶ main
                    │               │                        │
                development       test                  production
```

| Branch | Environment | Domain Pattern | Database |
|--------|------------|----------------|----------|
| `main` | production | `*.revealui.com` | NeonDB main |
| `test` | test/QA | `test.*.revealui.com` | NeonDB `test` branch |
| `develop` | development (default) | `dev.*.revealui.com` | NeonDB `dev` branch |
| `feature/*` | preview | `*.vercel.app` (auto) | NeonDB `dev` branch |

- **Default branch:** `develop` (PRs target it by default)
- **Deploys:** GitHub Actions only (Vercel auto-deploy disabled)
- **Pre-push gate:** `main`/`test` = full gate, `develop` = changed-only, `feature/*` = quality-only
- **CI:** Integration tests + E2E run on `main` and `test` only

## Package Map

### Apps (6)
| App | Port | Framework | Purpose |
|-----|------|-----------|---------|
| api | 3004 | Hono | REST API (OpenAPI + Swagger) |
| cms | 4000 | Next.js 16 | Headless CMS with admin dashboard + system monitoring |
| docs | 3002 | Vite/React | Documentation site |
| marketing | 3000 | Next.js | Marketing + waitlist |
| studio | — | Tauri 2 + React 19 | Desktop companion: DevPod manager, app launcher, first-run wizard, system tray |
| terminal | — | Go (Bubble Tea) | TUI client: API integration, QR checkout, SSH fingerprint lookup |

### OSS Packages (MIT)
| Package | Purpose |
|---------|---------|
| @revealui/core | CMS engine, REST API, auth, rich text, admin UI, plugins |
| @revealui/contracts | Zod schemas + TypeScript types (single source of truth) |
| @revealui/db | Drizzle ORM schema (75 tables), dual-DB (Neon + Supabase) |
| @revealui/auth | Session auth, password reset, rate limiting |
| @revealui/presentation | 50+ native UI components (Tailwind v4, zero external UI deps — only clsx + CVA) |
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
| @revealui/dev | Shared configs (Biome, TS, Tailwind) |
| @revealui/test | E2E specs (Playwright), integration tests, fixtures, mocks, test utilities |

### Pro Packages (Commercial — source-available, commercially licensed)
| Package | Purpose |
|---------|---------|
| @revealui/ai | AI agents, CRDT memory, LLM providers, orchestration |
| @revealui/mcp | MCP hypervisor, adapter framework, tool discovery |
| @revealui/editors | Editor config sync (Zed, VS Code, Cursor) |
| @revealui/services | Stripe + Supabase integrations |
| @revealui/harnesses | AI harness adapters, workboard coordination, JSON-RPC |

## Common Commands

### Development
```bash
pnpm dev                    # Start all apps in parallel
pnpm dev:app                # Build auth + start CMS + API (port 4000 + 3004)
pnpm dev:api                # Start API only (port 3004)
pnpm dev:cms                # Build auth + start CMS only (port 4000)
```

### Building
```bash
pnpm build                  # Build all (turbo, respects dependency order)
pnpm build:api              # Build API only
pnpm build:cms              # Build auth + CMS
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
pnpm --filter cms dev                # Dev one app
```

### CMS Collections
Collections are defined in `apps/cms/src/collections/` with access control, hooks, and field definitions. Use `@revealui/contracts` for type schemas.

### Feature Gating
Pro features use `isLicensed('pro')` and `isFeatureEnabled('ai')` from `@revealui/core`. Tiers: free, pro, max, enterprise (code string for Forge).

### Database Schema
Schemas are in `packages/db/src/schema/`. Use Drizzle ORM for queries. Dual-database: NeonDB (REST) + Supabase (vectors/auth).

### Testing
- Unit/integration: Vitest (`*.test.ts`)
- E2E: Playwright (`*.e2e.ts`)
- Test helpers: `@revealui/test` package
- Database tests use PGlite (in-memory PostgreSQL)

## Build & Security Status
- 24 workspaces build and typecheck clean
- 10,784 tests (2,563 core + 1,734 API + 1,256 CMS + 911 DB + 187 security + 4,133 other)
- 36 pnpm overrides enforce minimum safe versions for transitive deps
- React 19.2.4 (CVE-2025-55182 React2Shell patched)
- Run `pnpm audit:any` and `pnpm audit:console` for current any/console counts (warn-only)

### Known npm Vulnerabilities (Accepted Risk)
| Severity | Module | Via | Issue | Fixable? |
|----------|--------|-----|-------|----------|
| low | @tootallnate/once | vercel CLI | Incorrect Control Flow Scoping | Upgrade to >=3.0.1 when vercel updates |

## CI Gate Architecture
The `pnpm gate` script runs 3 phases:
1. **Quality** (parallel): Biome lint (hard fail), audits (warn), structure (warn), security (warn)
2. **Type checking** (serial): `pnpm -r typecheck` across all workspaces
3. **Test + Build** (parallel): Vitest (hard fail), turbo build (hard fail)

Biome, typecheck, tests, and build all block pushes. Audits and structure checks are warn-only.

## Security
- CSP, CORS, HSTS headers in `@revealui/security` (re-exported via `packages/core/src/security/`)
- Auth: bcrypt (12 rounds), brute force protection, rate limiting, session-only (no JWT)
- Session cookies: httpOnly, secure, sameSite=lax — set in sign-in/sign-up/OAuth routes
- Admin gate: proxy.ts checks `revealui-role` cookie for /admin routes (defense-in-depth)
- Access control: find/findByID enforce `access.read`, update enforces `access.update`, delete enforces `access.delete` (boolean or WhereClause)
- `overrideAccess` query param stripped from external requests in proxy.ts
- License enforcement: 5-min DB status check (checkLicenseStatus) + requireFeature middleware on Pro routes
- Feature gates: AI routes (agent-tasks, agent-stream, RAG, collab/agent), dashboard (provenance)
- Resource limits: enforceSiteLimit on site creation, advisory-locked user limit in CMS sign-up
- Encryption keys: non-extractable by default (configurable via `extractable` option)
- Rich text: isSafeUrl() blocks javascript:/vbscript:/data: in Lexical link/image rendering
- Webhook rate limiting: 100 req/min on /api/webhooks
- Cross-DB cleanup: `@revealui/db/cleanup` for orphaned Supabase data after site deletion
- RBAC + ABAC policy engine in core (58 enforcement tests prove role isolation)
- GDPR compliance framework (consent, deletion, anonymization)
- AI memory validation: prototype pollution prevention, depth/size limits
- CI: CodeQL, Gitleaks, dependency auditing, secret scanning (security-audit.yml, consolidated)
- Zero-trust agent architecture (planned): process isolation, least privilege, continuous verification
