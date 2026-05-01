# Copilot / AI Agent Instructions for RevealUI

Purpose: give an AI coding agent concise, actionable context to be productive in this monorepo.

- Big picture: Next.js 16 + React 19 monorepo. Apps live in `apps/` (notably `apps/admin`, `apps/server`, `apps/marketing`) and shared code lives in `packages/` (core, `auth`, `services`, `mcp`).

- Key integrations: NeonDB + Drizzle ORM (`docs/DATABASE.md`), Vercel (edge-ready), MCP adapters in `packages/mcp/src/servers/` (e.g. `neon.ts`). Third-party: Stripe, Supabase (`packages/services`).

- Quick start commands (most-used):
  - `pnpm install`
  - `pnpm dev` (runs `turbo run dev --parallel`)
  - `pnpm --filter <pkg> dev` (package scoped)
  - `pnpm build` (turbo)
  - `pnpm test` (turbo); e2e: `pnpm test:e2e` (Playwright)
  - `pnpm format` / `pnpm lint`

- Conventions & gotchas:
  - Prefer `pnpm --filter <pkg>` for package-scoped work; `turbo` coordinates cross-package tasks.
  - Operational CLIs live under `scripts/` and are invoked via `tsx` in `package.json` scripts.
  - Node requirement: `node >= 24.13.0`.
  - Run `pnpm audit:any` to see current `any` type count before large type changes.

- Editing patterns:
  - Use existing `scripts/*` CLIs instead of adding ad-hoc scripts.
  - Follow `scripts/STANDARDS.md` and `docs/STANDARDS.md` for naming and packaging.
  - Run `pnpm format` and `pnpm lint` before committing.

- Where to run/verify changes:
  - Auth or integration changes: `packages/auth`, `packages/services/*`, `apps/admin` (preview flows).
  - MCP servers: `packages/mcp/src/servers/*` — run with `pnpm run mcp:neon|vercel|stripe|supabase`.
  - Visual/e2e: Playwright (`pnpm test:e2e` / `pnpm test:e2e:visual:update`).

- Quick reference files:
  - `package.json` (root scripts)
  - `scripts/cli/*` (CLIs)
  - `packages/mcp/src/servers/neon.ts`
  - `apps/admin`, `apps/server`

Ask for human review when a change requires secrets/env values or DB snapshots (see `docs/ENVIRONMENT_VARIABLES_GUIDE.md`).

If you want, I can expand this with concrete examples for a package (for example `packages/mcp`).

Concrete examples (MCP & quick commands):

- Run the local Neon MCP adapter (must set `NEON_API_KEY`):

  - Command: `pnpm run mcp:neon`
  - File: `packages/mcp/src/servers/neon.ts` — script validates `NEON_API_KEY` and connects to remote `mcp.neon.tech`.

- Run all MCP adapters concurrently for development:

  - Command: `pnpm run mcp:all`

- Playwright visual snapshot update (when changing UI):

  - Command: `pnpm test:e2e:visual:update`

- Start a single package dev server (example: Admin):

  - Command: `pnpm --filter admin dev`

These concrete examples are safe to run locally after `pnpm install`. If an example requires secrets or a DB snapshot, request access before running.
