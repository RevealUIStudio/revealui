# RevealUI Agent Handoff Document

## Project Overview

RevealUI is an enterprise-grade React 19 framework with Next.js 16. The codebase is a monorepo managed by pnpm and TurboRepo.

**Vision**: RevealUI is being built as a "translator OS" - a platform where humans and AI collaborate efficiently, each communicating in their native languages. It serves as a website builder with CMS capability, built on Next.js and Vite.

## Current State (As of January 2, 2026)

### What Works ✅
- `@revealui/schema` package: 165 tests passing, builds clean
- `@revealui/db` package: Builds clean (Drizzle ORM schemas for NeonDB Postgres)
- `@revealui/cms` package: Native CMS implementation (no external CMS dependencies)
- `apps/web`: Builds clean (Vite + Hono SSR)
- `apps/cms`: Compiles successfully, connects to NeonDB

### What Needs Work ⚠️
- Database tables need to be created in NeonDB
- ~400 lint errors (mostly in unused packages)
- Type consolidation needed

## Architecture Decisions

### Core Principles
1. **No external CMS packages** - Native RevealUI CMS implementation
2. Use **vanilla Lexical npm packages** for rich text editing
3. Package name: `@revealui/cms`
4. Use **Vite + Next.js** (no Vike)
5. Database: **NeonDB Postgres** with **Drizzle ORM** + **pgvector** for embeddings
6. Real-time: **ElectricSQL** or **Y.js + Hocuspocus** for CRDTs

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Next.js 16, RevealUI |
| Styling | Tailwind CSS v4 |
| CMS | @revealui/cms (native) |
| Database | NeonDB Postgres + Drizzle ORM |
| Storage | Vercel Blob |
| Auth | RevealUI Auth |
| Testing | Vitest |
| Deployment | Vercel Edge |

## Key Packages

### `@revealui/cms` (packages/revealui)
Native CMS framework providing:
- Database adapters (Postgres, SQLite)
- Lexical rich text editor (vanilla @lexical/react)
- Plugin system (form-builder, nested-docs, redirects)
- Auth utilities (anyone, authenticated)
- Type system (integrated with @revealui/schema)

### `@revealui/db` (packages/db)
Drizzle ORM schemas for NeonDB:
- Users, Sessions
- Sites, Site Collaborators
- Pages, Page Revisions
- Agent Contexts, Memories, Conversations, Actions

### `@revealui/schema` (packages/schema)
Zod schemas with dual human/agent representations:
- Core primitives
- Block definitions
- Agent configuration
- CMS contracts

## Key Files to Know

| File | Purpose |
|------|---------|
| `packages/revealui/package.json` | Main CMS package exports |
| `packages/revealui/src/cms/types/index.ts` | All TypeScript types |
| `packages/db/src/schema/` | Drizzle ORM table definitions |
| `packages/db/src/client/index.ts` | NeonDB Drizzle client |
| `apps/cms/revealui.config.ts` | CMS app configuration |
| `packages/schema/src/` | Core Zod schemas |

## Environment Variables

Required:
```env
REVEALUI_SECRET=<32+ char secret>
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
STRIPE_SECRET_KEY=sk_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx
```

## Commands Reference

```bash
# Install dependencies
pnpm install

# Build all
pnpm build

# Build specific package
pnpm --filter cms build
pnpm --filter @revealui/schema build
pnpm --filter @revealui/db build

# Run tests
pnpm test
pnpm --filter @revealui/schema test

# Type check
pnpm typecheck:all

# Lint
pnpm lint

# Database commands (via @revealui/db)
pnpm --filter @revealui/db db:generate  # Generate migrations
pnpm --filter @revealui/db db:push      # Push schema to DB
pnpm --filter @revealui/db db:studio    # Open Drizzle Studio
```

## Immediate Next Steps

1. **Create database tables** - Run Drizzle migrations or SQL
2. **Clean lint errors** - Delete unused packages or add ignores
3. **Consolidate types** - Use @revealui/schema as single source
4. **Resume CRDT work** - After build is stable

## Warning Signs

1. **Import resolution issues**: Check package.json exports, webpack aliases
2. **Type errors**: Update types in @revealui/cms or @revealui/schema
3. **Generated files**: Don't fix lint in `dist/` - ignore them in config

---

## Prompt for New Agent

```
I'm continuing work on the RevealUI framework. Please read AGENT-HANDOFF.md for full context.

CRITICAL REQUIREMENTS:
- No external CMS packages - use native @revealui/cms
- Use @revealui/db with Drizzle ORM for database
- Building a "translator OS" for human-AI collaboration

CURRENT STATE:
- CMS compiles but needs database tables
- ~400 lint errors to clean up
- See docs/migration/DETAILED-PLAN.md for full plan

Be brutally honest about what works and what doesn't.
```
