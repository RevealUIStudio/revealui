# RevealUI Framework - Cursor IDE Rules

## Project Overview
RevealUI is an enterprise-grade framework built with:
- **React 19** with React Compiler
- **Next.js 16** (CMS app)
- **RevealUI** (Web app)
- **PayloadCMS 3.65.0** (Headless CMS)
- **TypeScript** (strict mode)
- **Tailwind CSS 4.0**
- **Monorepo** structure (pnpm workspaces)

## Architecture
- `apps/cms` - Next.js 16 + PayloadCMS application
- `apps/web` - RevealUI + React application
- `packages/reveal` - Core framework package
- `packages/services` - Shared services (Stripe, Supabase)
- `packages/dev` - Development tooling
- `packages/test` - Test utilities

## Key Conventions

### Import Paths
- Use `@/lib/*` for CMS app imports
- Use `reveal/*` for framework imports
- Use workspace protocol for internal packages: `workspace:*`

### TypeScript
- Strict mode enabled
- Prefer explicit types over `any`
- Use `Config` type from `payload` for PayloadCMS configs
- Use `CollectionConfig` for PayloadCMS collections

### PayloadCMS
- All routes using PayloadCMS must be marked `export const dynamic = "force-dynamic"`
- Use `getPayloadHMR` for development, `getPayload` for production
- Collections with `auth: true` automatically handle authentication
- API keys can be enabled with `auth: { useAPIKey: true }`

### Next.js 16
- `params` and `searchParams` are Promises - await them
- Use `export const dynamic = "force-dynamic"` for dynamic routes
- `experimental.instrumentationHook` is deprecated
- Use `images.remotePatterns` instead of `images.domains`

### Environment Variables
- `.env` files are tracked in git (production values generated in CI/CD)
- Use `PAYLOAD_SECRET` for PayloadCMS (required for builds)
- Use `POSTGRES_URL` or `SUPABASE_DATABASE_URI` for production database
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
- Use `--webpack` flag for Next.js builds (Turbopack compatibility)

## Common Issues & Solutions

### PayloadCMS Build Errors
- Ensure `PAYLOAD_SECRET` is set during build
- All PayloadCMS routes must be dynamic
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

