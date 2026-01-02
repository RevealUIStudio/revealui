# RevealUI Agent Handoff Document

## Project Overview

RevealUI is an enterprise-grade React 19 framework with Next.js 16. The codebase is a monorepo managed by pnpm and TurboRepo.

**Vision**: RevealUI is being built as a "translator OS" - a platform where humans and AI collaborate efficiently, each communicating in their native languages. It will serve as a website builder (like v0) with CMS capability (like PayloadCMS), built on Next.js and Vite.

## Current State (As of Handoff)

### What Works ✅
- `@revealui/schema` package: 165 tests passing, builds clean
- `@revealui/db` package: Builds clean (Drizzle ORM schemas for Neon Postgres)
- `apps/web`: Builds clean (Vite + Hono SSR)

### What's Broken ❌
- `apps/cms`: Build fails with TypeScript errors in `revealui.config.ts`
- Lint: 86 errors in `@revealui/db` (from generated `.d.ts` files)
- TypeCheck: Multiple errors in `@revealui/cms` package types

## Recent Changes Made

### 1. Package Rename
- Renamed `@revealui/core` → `@revealui/cms` (per user request)
- Updated all workspace references in:
  - `packages/revealui/package.json`
  - `apps/cms/package.json`
  - `apps/web/package.json`
  - `packages/test/package.json`

### 2. Import Path Fixes
- Changed ~50 imports from `revealui/cms` → `@revealui/cms`
- Changed all `@payloadcms/richtext-lexical` imports → `@revealui/cms/richtext-lexical`

### 3. Created Vanilla Lexical Integration
User explicitly requested: **NO PayloadCMS packages** - use vanilla Lexical npm packages only.

Created these files:
- `packages/revealui/src/cms/richtext-lexical/index.ts` - Main exports (lexicalEditor, BoldFeature, etc.)
- `packages/revealui/src/cms/richtext-lexical/exports/client/index.ts` - Client components
- `packages/revealui/src/cms/richtext-lexical/exports/server/rsc.tsx` - RSC components

### 4. Created UI Components
- `packages/revealui/src/cms/ui/index.ts` - TextInput, FieldLabel, useFormFields, etc.

### 5. Updated Package Exports
Added cleaner export paths in `packages/revealui/package.json`:
```json
"./richtext-lexical": "./src/cms/richtext-lexical/index.ts",
"./richtext-lexical/client": "./src/cms/richtext-lexical/exports/client/index.ts",
"./richtext-lexical/rsc": "./src/cms/richtext-lexical/exports/server/rsc.tsx",
"./ui": "./src/cms/ui/index.ts"
```

### 6. Updated Webpack Aliases
Modified `packages/revealui/src/cms/nextjs/withRevealUI.js` to add explicit aliases for subpath exports:
```javascript
'@revealui/cms/richtext-lexical/client': nodePath.resolve(cmsRoot, 'richtext-lexical/exports/client/index.ts'),
'@revealui/cms/richtext-lexical/rsc': nodePath.resolve(cmsRoot, 'richtext-lexical/exports/server/rsc.tsx'),
// etc.
```

### 7. Updated AdminConfig Types
Extended `packages/revealui/src/cms/types/index.ts` to support:
- `components.beforeNavLinks`, `components.beforeDashboard`, `components.graphics`, etc.
- `meta.icons` array
- `livePreview.url` as function
- `livePreview.collections`

## Immediate Next Steps

### Step 1: Fix Remaining Type Errors in revealui.config.ts
The build is failing at TypeScript check. Run:
```bash
cd /home/joshua-v-dev/projects/RevealUI && pnpm --filter cms build 2>&1 | tail -80
```

Look for type errors and update `packages/revealui/src/cms/types/index.ts` to add missing properties.

### Step 2: Fix DB Package Lint
The lint errors are from generated `.d.ts` files in `dist/`. Fix by adding to `packages/db/biome.json`:
```json
{
  "files": {
    "ignore": ["dist/**"]
  }
}
```

### Step 3: Verify Full CI
```bash
pnpm lint && pnpm typecheck:all && pnpm test && pnpm build
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `packages/revealui/package.json` | Main CMS package exports |
| `packages/revealui/src/cms/types/index.ts` | All TypeScript types (~1300 lines) |
| `packages/revealui/src/cms/nextjs/withRevealUI.js` | Next.js webpack config wrapper |
| `apps/cms/revealui.config.ts` | CMS app configuration |
| `packages/schema/src/` | Core Zod schemas for the new architecture |
| `packages/db/src/` | Drizzle ORM database schemas |

## Architecture Decisions

### User Preferences (Explicitly Stated)
1. **NO PayloadCMS packages** - even `@payloadcms/richtext-lexical`
2. Use **vanilla Lexical npm packages** for rich text editing
3. Package name: `@revealui/cms` (not `@revealui/core` or `@revealui/revealui`)
4. Use **Vite + Next.js** (no Vike)
5. Database: **Neon Postgres** with **pgvector** for embeddings
6. Real-time: **ElectricSQL** or **Y.js + Hocuspocus** for CRDTs

### New Packages Created
- `@revealui/schema` - Zod schemas with dual human/agent representations
- `@revealui/db` - Drizzle ORM schemas for Neon Postgres

## Commands Reference

```bash
# Install dependencies
pnpm install

# Build all
pnpm build

# Build specific package
pnpm --filter cms build
pnpm --filter @revealui/schema build

# Run tests
pnpm test
pnpm --filter @revealui/schema test

# Type check
pnpm typecheck:all

# Lint
pnpm lint
```

## Warning Signs

1. **Import resolution issues**: If modules can't be found, check:
   - Package.json exports field
   - Webpack aliases in withRevealUI.js
   - File extensions (.ts vs .tsx for JSX)

2. **Type errors**: The CMS types are incomplete. Many PayloadCMS-like properties need to be added to `AdminConfig`, `Config`, etc.

3. **Generated files**: Don't try to fix lint errors in `dist/` directories - ignore them in config.

## Files Modified in This Session

1. `packages/revealui/package.json` - renamed, updated exports
2. `packages/revealui/src/cms/types/index.ts` - extended AdminConfig
3. `packages/revealui/src/cms/nextjs/withRevealUI.js` - added webpack aliases
4. `packages/revealui/src/cms/richtext-lexical/index.ts` - created
5. `packages/revealui/src/cms/richtext-lexical/exports/client/index.ts` - created
6. `packages/revealui/src/cms/richtext-lexical/exports/server/rsc.tsx` - created
7. `packages/revealui/src/cms/ui/index.ts` - created
8. `apps/cms/revealui.config.ts` - fixed livePreview.url type
9. `apps/cms/src/instrumentation.ts` - removed broken import
10. `apps/cms/src/app/(backend)/admin/importMap.js` - fixed imports
11. Multiple files in `apps/cms/src/` - sed replacements for import paths

---

## Prompt for New Agent

```
I'm continuing work on the RevealUI framework. Please read AGENT-HANDOFF.md for full context.

CRITICAL USER PREFERENCES:
- NO PayloadCMS packages - use vanilla Lexical npm packages
- Package name is @revealui/cms
- Building a "translator OS" for human-AI collaboration

IMMEDIATE TASK:
The CMS build is failing with TypeScript errors. Run:
pnpm --filter cms build 2>&1 | tail -80

Then iteratively fix type errors in packages/revealui/src/cms/types/index.ts until the build passes.

After build passes, run full CI: pnpm lint && pnpm typecheck:all && pnpm test && pnpm build

Be brutally honest about what works and what doesn't. Stop and ask if unsure about any architectural decisions.
```
