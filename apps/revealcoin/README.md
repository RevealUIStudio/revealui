# revealcoin

Public dashboard for RevealCoin (RVUI / RVC) — token info, allocations, vesting, and whitepaper. Lives at `revealcoin.revealui.com`.

## Stack

- Vite + React 19
- `@revealui/router` (file-based routing + SSR-capable, currently used in SPA mode)
- `@revealui/presentation` (UI primitives)
- Tailwind CSS v4
- Geist + Geist Mono via `@fontsource-variable`
- Calls `apps/api`'s `/api/coin/*` endpoints for on-chain data (no client-side Solana RPC)

## Develop

```bash
pnpm --filter revealcoin dev          # http://localhost:3005
pnpm --filter revealcoin typecheck
pnpm --filter revealcoin build
pnpm --filter revealcoin preview
```

`apps/api` must be running on `http://localhost:3004` for `/coin/*` data fetches to succeed in dev. Override the API URL with `VITE_API_URL`.

## Deploy

Vercel: push triggers preview, merge to `main` triggers production. Build command and output configured in `vercel.json`. CF Pages-compatible by construction (Vite static + Hono-based router); no CF deployment wired yet — see the migration design doc.
