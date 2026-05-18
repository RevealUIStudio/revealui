# `@rsc-poc/app` — Phase 2.1 RSC POC spike (THROWAWAY)

> **Status:** scaffolded 2026-05-18. Not yet runnable — `pnpm install` + `vite.config.ts` + entries are next-session work. **This app is deleted after Phase 2.1 retrospective.**

## What this is

Throwaway sandbox for [GAP-194](../../../.jv/docs/gaps/GAP-194.yml) Phase 2.1. Validates that React Server Components work inside a Vite + `@revealui/router` + Hono app shape, using `@vitejs/plugin-rsc` as the bundler-split + RSC wire-format primitive.

**Goal:** prove the architecture before committing to multi-month admin migration. The findings drive Phase 2.2 (server actions in `@revealui/router`), not this code.

## Authoritative docs

- **Spec (acceptance + sub-steps + exit criteria):** [`.jv/docs/specs/2026-05-18-phase-2.1-rsc-poc-spike.md`](../../../.jv/docs/specs/2026-05-18-phase-2.1-rsc-poc-spike.md)
- **ADR (decisions + Q1 amendment + Q6 override):** [`.jv/docs/decisions/2026-05-16-admin-platform.md`](../../../.jv/docs/decisions/2026-05-16-admin-platform.md)
- **GAP tracking:** [`.jv/docs/gaps/GAP-194.yml`](../../../.jv/docs/gaps/GAP-194.yml)

## Current scaffold state

✅ `package.json` — deps pinned (`@vitejs/plugin-rsc ^0.5.26`, `react-server-dom-webpack ^19.2.6`, `@revealui/router workspace:*`)
✅ `tsconfig.json` — strict + bundler resolution
✅ `.gitignore`
✅ Registered in root `pnpm-workspace.yaml` via the `apps/*` glob

## Next session — pick up here

Per spec §Sub-step breakdown, step 2.1.1 onward. Use a **dedicated WSL terminal session** (not this Windows-host UNC instance) for `pnpm install` + dev-server work — UNC is too slow for the iteration cycle.

```bash
cd ~/revfleet/revealui/apps/rsc-poc
pnpm install                          # 2.1.1 — resolve deps; verify no plugin-rsc peer warnings
```

Then:

- **2.1.2** — write `vite.config.ts` wiring `@vitejs/plugin-rsc` + `@vitejs/plugin-react` (verify the actual API shape against [@vitejs/plugin-rsc README](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc))
- **2.1.3** — write `src/server.ts` (Hono entry), `src/entry.client.tsx`, `src/entry.server.tsx`, `src/pages/home.tsx` (RSC), `src/pages/counter.tsx` (Client Component), `src/pages/actions.tsx` (server action)
- **2.1.4** — wire `@revealui/router` for navigation between the 3 pages
- **2.1.5** — verify acceptance A–E from the spec
- **2.1.6** — populate spec §Retrospective; draft Phase 2.2 spec

## Exit criteria

| Outcome | Action |
|---|---|
| All A–E from spec met | Write retrospective → Phase 2.2 starts → this directory deleted |
| A–E met with caveats | Same + caveats carried into 2.2 |
| A or critical step fails | Escalate to ADR Option C (custom DIY against `react-server-dom-webpack`); may require second ADR amendment |

## Reference

- `@vitejs/plugin-rsc` repo: https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc
- Waku 1.0.0-beta.0 (production reference, also built on `@vitejs/plugin-rsc`): https://github.com/wakujs/waku
- React Server Components RFC: https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md
