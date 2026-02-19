# RevealUI Monorepo

Full-stack React framework with CMS, auth, DB, UI components, and AI agents.

## Master Plan
All priorities and sequencing live in `docs/MASTER_PLAN.md`. Check it before starting work.
Current phase: **Phase 0 — Prove It Works** (deploy, verify integrations, get first user).
See `.claude/rules/priorities.md` for scope freeze rules.

## Stack
- React 19, Next.js 16, Node 24, TypeScript 5.9
- pnpm 10, Turborepo, Biome 2, Vitest 4
- Drizzle ORM (NeonDB + Supabase), Hono, Tailwind CSS v4
- Lexical (rich text), ElectricSQL (sync), Stripe (payments)

## Git Identity
RevealUI Studio <founder@revealui.com>

## Package Map

### Apps (6)
| App | Port | Framework | Purpose |
|-----|------|-----------|---------|
| api | 3000 | Hono | REST API (OpenAPI + Swagger) |
| cms | 4000 | Next.js 16 | Headless CMS with admin dashboard |
| dashboard | 3003 | Next.js | System health + AI agent management |
| docs | 5173 | Vite/React | Documentation site |
| landing | 3002 | Next.js | Marketing + waitlist |
| web | 3001 | Hono SSR + React | Demo/showcase app |

### OSS Packages (MIT)
| Package | Purpose |
|---------|---------|
| @revealui/core | CMS engine, REST API, auth, rich text, admin UI, plugins |
| @revealui/contracts | Zod schemas + TypeScript types (single source of truth) |
| @revealui/db | Drizzle ORM schema (25+ tables), dual-DB (Neon + Supabase) |
| @revealui/auth | Session auth, password reset, rate limiting |
| @revealui/presentation | 50+ UI components (Tailwind v4) |
| @revealui/router | Lightweight file-based router with SSR |
| @revealui/config | Type-safe env config (Zod + lazy Proxy) |
| @revealui/utils | Logger, DB helpers, validation |
| @revealui/cli | `create-revealui` scaffolding tool |
| @revealui/setup | Environment setup utilities |
| @revealui/sync | ElectricSQL real-time sync |
| @revealui/dev | Shared configs (Biome, ESLint, TS, Tailwind) |
| @revealui/test | Testing infra (fixtures, mocks, helpers) |

### Pro Packages (Commercial)
| Package | Purpose |
|---------|---------|
| @revealui/ai | AI agents, CRDT memory, LLM providers, orchestration |
| @revealui/mcp | MCP servers (Stripe, Supabase, Neon, Vercel, Playwright) |
| @revealui/editors | Editor daemon (Zed, VS Code, Neovim adapters) |
| @revealui/services | Stripe + Supabase integrations |

## Common Commands

### Development
```bash
pnpm dev                    # Start all apps in parallel
pnpm dev:api                # Start API only
pnpm dev:cms                # Build auth + start CMS
```

### Building
```bash
pnpm build                  # Build all (turbo, parallel)
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
pnpm lint                   # Biome + ESLint
pnpm lint:fix               # Auto-fix lint issues
pnpm format                 # Biome format
pnpm typecheck:all          # TypeScript check all packages
```

### Auditing
```bash
pnpm audit:any              # Find avoidable `any` types
pnpm audit:console          # Find production console statements
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
pnpm deps:circular          # Check circular dependencies
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
Pro features use `isLicensed('pro')` and `isFeatureEnabled('ai')` from `@revealui/core`. Tiers: free, pro, enterprise.

### Database Schema
Schemas are in `packages/db/src/schema/`. Use Drizzle ORM for queries. Dual-database: NeonDB (REST) + Supabase (vectors/auth).

### Testing
- Unit/integration: Vitest (`*.test.ts`)
- E2E: Playwright (`*.e2e.ts`)
- Test helpers: `@revealui/test` package
- Database tests use PGlite (in-memory PostgreSQL)

## Build & Security Status
- 23/23 packages build and typecheck clean (100%)
- 0 avoidable `any` types, 0 production console statements
- 2 dependency vulnerabilities remaining (both devDependency-only, no patch exists)
- React 19.2.4 (CVE-2025-55182 React2Shell patched)
- 19 pnpm overrides enforce minimum safe versions for transitive deps

## CI Gate Architecture
The `pnpm gate` script runs 3 phases:
1. **Quality** (parallel): Biome lint (hard fail), ESLint (warn), audits (warn), structure (warn), security (warn)
2. **Type checking** (serial): `pnpm -r typecheck` across all 23 packages
3. **Test + Build** (parallel): Vitest (warn), turbo build (hard fail)

Only Biome, typecheck, and build can block pushes. ESLint and tests are warn-only.

## Security
- CSP, CORS, HSTS headers in `packages/core/src/security/`
- Auth: bcrypt, brute force protection, rate limiting, sessions
- RBAC + ABAC policy engine in core
- GDPR compliance framework (consent, deletion, anonymization)
- AI memory validation: prototype pollution prevention, depth/size limits
- CI: CodeQL, Gitleaks, dependency auditing, secret scanning workflows
- Zero-trust agent architecture (planned): process isolation, least privilege, continuous verification
