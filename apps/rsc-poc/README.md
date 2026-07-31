# `@rsc-poc/app` — GAP-194 RSC POC (T0 revive)

> **Status (2026-07-31):** Restored from tag `archive/rsc-poc-spike` @ `918f5e083` for Phase 2.2.2 **T0 revive-POC gate**. Deps re-baselined to React/RSDW **19.2.7** lockstep (CVE floor ≥19.2.4) and `@vitejs/plugin-rsc` **0.5.27**. Survives into 2.2.x as the integration harness (not deleted until greenfield ships).

## What this is

Sandbox that proved React Server Components work with Vite + Hono + `@vitejs/plugin-rsc` during Phase 2.1 (2026-05-18). It does **not** yet use `@revealui/router` 0.4 RSC mode (that is T8 after the core engine). Today it uses a pathname-dispatch shim; the kickoff replaces that once dual-mode lands.

## Authoritative docs

- Kickoff (T0–T9): `.jv/docs/specs/2026-05-23-phase-2.2.2-router-rsc-core-engine-kickoff.md`
- RSC ADR: `.jv/docs/decisions/2026-05-18-rsc-router-greenfield.md`
- Design re-audit: `.jv/docs/audits/2026-07-04-rsc-router-design-reaudit.md`
- Gap: `.jv/docs/gaps/GAP-194.yml`

## T0 acceptance (from Phase 2.1)

| Id | Criterion |
|----|-----------|
| A | RSC render |
| B | Hydrate |
| C | Server-action round-trip |
| D | Production build |
| E | HMR |

## Commands

```bash
# from monorepo root (worktree OK)
pnpm install
pnpm --filter @rsc-poc/app build
pnpm --filter @rsc-poc/app dev
```

## Entries

| File | Role |
|------|------|
| `src/entry.rsc.tsx` | RSC render entry |
| `src/entry.ssr.tsx` | SSR + `tee()` / payload inline (D15 pattern) |
| `src/entry.browser.tsx` | Hydrate + action callback (history monkey-patch must **not** carry into 0.4 — D3) |
| `src/pages/*` | Demo pages + server actions |

## Pin policy

- `react` / `react-dom` / `react-server-dom-webpack`: **exact same version**, floor **≥19.2.4**
- `@vitejs/plugin-rsc`: pin exact (0.5.27 at T0)
- `vite`: workspace catalog
