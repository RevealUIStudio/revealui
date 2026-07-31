# `@rsc-poc/app` — GAP-194 RSC POC (T8 dual-mode consumer)

> **Status (2026-07-31):** T8 rewire onto `@revealui/router` **0.4.0-rc.2** RSC mode.
> Pathname-dispatch shim removed. Server uses `renderRequest` + registered routes;
> browser hydrates under `RouterProvider` and re-fetches flight on navigation (D3).

## What this is

Integration harness for dual-mode `@revealui/router`. Phase 2.1 proved Vite +
plugin-rsc; Phase 2.2.2 T0–T7 built the engine; **T8** is the first real consumer.

## Authoritative docs

- Kickoff (T0–T9): `.jv/docs/specs/2026-05-23-phase-2.2.2-router-rsc-core-engine-kickoff.md`
- RSC ADR: `.jv/docs/decisions/2026-05-18-rsc-router-greenfield.md`
- Gap: `.jv/docs/gaps/GAP-194.yml`

## Architecture (T8)

| Piece | Role |
|-------|------|
| `src/app-router.ts` | `new Router({ rsc: {} })` + three demo routes + layout |
| `src/entry.rsc.tsx` | `renderRequest` + `createRscStream` (plugin-rsc) + `x-rsc-action` |
| `src/entry.ssr.tsx` | SSR from teed flight; payload inline owned by router |
| `src/entry.browser.tsx` | Hydrate + `RouterProvider` + click/popstate RSC fetch (no History patch) |
| `src/pages/*` | Demo pages + server actions |

## Commands

```bash
# from monorepo root (worktree OK)
pnpm install
pnpm --filter @revealui/router build
pnpm --filter @rsc-poc/app build
pnpm --filter @rsc-poc/app dev
```

## Pin policy

- `react` / `react-dom` / `react-server-dom-webpack`: **exact same version**, floor **≥19.2.4**
- `@vitejs/plugin-rsc`: pin exact (0.5.27)
- `vite`: workspace catalog
