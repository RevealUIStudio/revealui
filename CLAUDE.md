# RevealUI Monorepo

Full-stack React framework with CMS, auth, DB, UI components, and AI agents.

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

## Build Status Notes
- 19/21 packages build clean (90.5%)
- CMS: ~10-15 TypeScript errors remaining
- MCP: 100+ TypeScript errors (module resolution, Sentry)
- 0 avoidable `any` types, 0 production console statements
