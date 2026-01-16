---
alwaysApply: true
---

# RevealUI Framework - Cursor IDE Rules

## Project Overview
RevealUI is an enterprise-grade framework built with:
- **React 19** with React Compiler
- **Next.js 16** (CMS app)
- **RevealUI** (Web app)
- **@revealui/core** (Native CMS)
- **@revealui/db** (Drizzle ORM)
- **TypeScript** (strict mode)
- **Tailwind CSS 4.0**
- **Monorepo** structure (pnpm workspaces)

## Architecture
- `apps/cms` - Next.js 16 + @revealui/core application
- `apps/web` - RevealUI + React application
- `packages/revealui` - Core CMS framework package
- `packages/db` - Drizzle ORM schemas for NeonDB
- `packages/schema` - Zod schemas
- `packages/services` - Shared services (Stripe, Supabase)
- `packages/dev` - Development tooling
- `packages/test` - Test utilities

## Key Conventions

### Terminal Commands
- **NEVER pipe development server commands** like `pnpm dev` through `head`, `tail`, or other output limiters
- Development servers (`pnpm dev`, `npm run dev`, etc.) are long-running processes - let them run continuously
- To check for startup errors only, use `timeout 10s pnpm dev` without pipes
- For background execution, use `pnpm dev &` not `pnpm dev 2>&1 | head -20`

### Package Manager
- **ALWAYS use `pnpm dlx` instead of `npx`** in package.json scripts and code
- Exception: `preinstall` scripts may use `npx only-allow pnpm` (runs before pnpm installs)
- Use `pnpm` for all package management commands
- This prevents npm deprecation warnings and enforces pnpm usage

### Import Paths
- Use `@/lib/*` for CMS app imports
- Use `@revealui/core` for CMS framework imports
- Use `@revealui/db` for database imports
- Use `@revealui/schema` for Zod schemas
- Use workspace protocol for internal packages: `workspace:*`

### TypeScript
- Strict mode enabled
- Prefer explicit types over `any`
- Use `Config` type from `@revealui/core` for CMS configs
- Use `CollectionConfig` for collection definitions

### API Architecture
- **NEVER use GraphQL** - RevealUI uses REST APIs and RPC (Remote Procedure Calls) exclusively
- Use REST API handlers from `@revealui/core/api/rest`
- RPC is supported for type-safe procedure calls
- All API endpoints use standard HTTP methods (GET, POST, PATCH, DELETE)
- GraphQL is forbidden - do not add GraphQL dependencies, schemas, or resolvers

### CMS Routes
- All dynamic routes must be marked `export const dynamic = "force-dynamic"`
- Use `createRevealUI` for CMS initialization
- Collections with `auth: true` automatically handle authentication

### Next.js 16
- `params` and `searchParams` are Promises - await them
- Use `export const dynamic = "force-dynamic"` for dynamic routes
- `experimental.instrumentationHook` is deprecated
- Use `images.remotePatterns` instead of `images.domains`

### Environment Variables
- `.env` files are tracked in git (production values generated in CI/CD)
- Use `REVEALUI_SECRET` for encryption (required for builds)
- Use `POSTGRES_URL` for NeonDB connection
- SQLite adapter used as fallback when Postgres not available

## Code Style
- Use functional components with hooks
- Prefer named exports
- Use async/await over promises
- Add JSDoc comments for public APIs
- Use TypeScript interfaces for props

## Testing
- Vitest for unit tests
- Playwright for E2E tests
- Test files: `*.test.ts` or `*.spec.ts`
- Place tests next to source files or in `__tests__` folders

## Build & Development
- `pnpm dev` - Start all apps in development
- `pnpm build` - Build all packages
- `pnpm --filter cms build` - Build CMS app
- Prefer Turbopack over Webpack for Next.js builds (use `--turbo` flag)

## Common Issues & Solutions

### CMS Build Errors
- Ensure `REVEALUI_SECRET` is set during build
- Ensure `POSTGRES_URL` is set for database connection
- All CMS routes must be dynamic
- SQLite adapter used when Postgres unavailable

### TypeScript Errors
- Check import paths match actual file structure
- Ensure types are imported from correct packages
- Use `as` assertions sparingly, prefer proper types

### Next.js 16 Migration
- Update `params` and `searchParams` to Promises
- Remove deprecated `experimental.instrumentationHook`
- Use `images.remotePatterns` instead of `images.domains`

## File Organization
- Components: `src/lib/components/`
- Collections: `src/lib/collections/`
- Utilities: `src/lib/utilities/`
- Hooks: `src/lib/hooks/`
- Types: `src/types/`

## Git Workflow
- `.env` files are tracked (production values in CI/CD)
- Use conventional commits
- Run `pnpm lint` and `pnpm typecheck` before committing
