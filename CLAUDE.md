# RevealUI Monorepo

Open-source business infrastructure for software companies. Users, content, products, payments, and AI — pre-wired and ready to deploy.

## Current Phase
**Phase 3 — Launch Preparation** (docs, OSS prep, marketing, Pro distribution).

## Stack
- React 19, Next.js 16, Node 24, TypeScript 5.9
- pnpm 10, Turborepo, Biome 2, Vitest 4
- Drizzle ORM (NeonDB + Supabase), Hono, Tailwind CSS v4
- Lexical (rich text), ElectricSQL (sync), Stripe (payments)

## Git Identity
RevealUI Studio <founder@revealui.com>

## Package Map

### Apps (5)
| App | Port | Framework | Purpose |
|-----|------|-----------|---------|
| api | 3004 | Hono | REST API (OpenAPI + Swagger) |
| cms | 4000 | Next.js 16 | Headless CMS with admin dashboard + system monitoring |
| docs | 3002 | Vite/React | Documentation site |
| marketing | 3000 | Next.js | Marketing + waitlist |
| studio | — | Tauri 2 + React 19 | Desktop companion: DevPod manager, app launcher, first-run wizard, system tray |

### OSS Packages (MIT)
| Package | Purpose |
|---------|---------|
| @revealui/core | CMS engine, REST API, auth, rich text, admin UI, plugins |
| @revealui/contracts | Zod schemas + TypeScript types (single source of truth) |
| @revealui/db | Drizzle ORM schema (50 tables), dual-DB (Neon + Supabase) |
| @revealui/auth | Session auth, password reset, rate limiting |
| @revealui/presentation | 50+ native UI components (Tailwind v4, zero external UI deps — only clsx + CVA) |
| @revealui/router | Lightweight file-based router with SSR |
| @revealui/config | Type-safe env config (Zod + lazy Proxy) |
| @revealui/utils | Logger, DB helpers, validation |
| @revealui/cli | `create-revealui` scaffolding tool |
| @revealui/setup | Environment setup utilities |
| @revealui/sync | ElectricSQL real-time sync |
| @revealui/dev | Shared configs (Biome, TS, Tailwind) |
| @revealui/test | E2E specs (Playwright), integration tests, fixtures, mocks, test utilities |

### Pro Packages (Commercial — source-available, commercially licensed)
| Package | Purpose |
|---------|---------|
| @revealui/ai | AI agents, CRDT memory, LLM providers, orchestration |
| @revealui/mcp | MCP servers (Stripe, Supabase, Neon, Vercel, Playwright) |
| @revealui/editors | Editor daemon (Zed, VS Code, Neovim adapters) |
| @revealui/services | Stripe + Supabase integrations |
| @revealui/harnesses | AI harness adapters, daemon, workboard coordination, JSON-RPC |

## Common Commands

### Development
```bash
pnpm dev                    # Start all apps in parallel
pnpm dev:api                # Start API only
pnpm dev:cms                # Build auth + start CMS
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
- 20 workspaces (5 apps + 14 OSS packages + scripts/lib) build and typecheck clean
- 33 pnpm overrides enforce minimum safe versions for transitive deps
- React 19.2.4 (CVE-2025-55182 React2Shell patched)
- Run `pnpm audit:any` and `pnpm audit:console` for current any/console counts (warn-only)

### Known npm Vulnerabilities (Accepted Risk)
| Severity | Module | Via | Issue | Fixable? |
|----------|--------|-----|-------|----------|
| high | oauth2-server | @neondatabase/mcp-server-neon | Open Redirect + Code Injection | No (patched: `<0.0.0`, transitive, unused at runtime) |
| moderate | payload | @revealui/services | IDOR in Access Control | Upgrade to >=3.74.0 when compatible |
| moderate | payload | @revealui/services | SSRF in File URL Uploads | Upgrade to >=3.75.0 when compatible |
| low | @tootallnate/once | vercel CLI | Incorrect Control Flow Scoping | Upgrade to >=3.0.1 when vercel updates |

**oauth2-server**: Only pulled in by `@neondatabase/mcp-server-neon` (dev/MCP tool). Not used in any production API path. No patch exists (`<0.0.0` means the maintainer has not fixed it). Acceptable risk for v1.

**payload**: Transitive via `@revealui/services`. File upload SSRF mitigated by our CSP + CORS headers. IDOR requires multi-auth setup we don't use. Will upgrade when payload 3.75+ is tested compatible.

## CI Gate Architecture
The `pnpm gate` script runs 3 phases:
1. **Quality** (parallel): Biome lint (hard fail), audits (warn), structure (warn), security (warn)
2. **Type checking** (serial): `pnpm -r typecheck` across all workspaces
3. **Test + Build** (parallel): Vitest (warn), turbo build (hard fail)

Only Biome, typecheck, and build can block pushes. Tests are warn-only.

## Security
- CSP, CORS, HSTS headers in `packages/core/src/security/`
- Auth: bcrypt, brute force protection, rate limiting, sessions
- RBAC + ABAC policy engine in core
- GDPR compliance framework (consent, deletion, anonymization)
- AI memory validation: prototype pollution prevention, depth/size limits
- CI: CodeQL, Gitleaks, dependency auditing, secret scanning (security-audit.yml, consolidated)
- Zero-trust agent architecture (planned): process isolation, least privilege, continuous verification
