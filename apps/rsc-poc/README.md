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
| `src/entry.rsc.tsx` | `renderRequest` + JS actions + progressive `decodeFormAction` (2.2.4) |
| `src/entry.ssr.tsx` | SSR from teed flight; payload inline owned by router |
| `src/entry.browser.tsx` | Hydrate + `setRscPayloadLoader` + `useRscPayload` (2.2.3 router-owned nav) |
| `src/auth/*` | Dogfood signed-cookie session + `useAction` requireSession (2.3.1) |
| `src/observability/*` | Node + browser init via `@revealui/core/observability` (2.3.3) |
| `src/request-layer/*` | Secure headers, domain-lock, CSRF origin (2.3.4; outside `Router.match`) |
| `src/pages/*` | Demo pages + `/session` + `/errors` (2.3.2 boundaries + 2.3.3 capture) |

## Commands

```bash
# from monorepo root (worktree OK)
pnpm install
pnpm --filter @revealui/router build
pnpm --filter @rsc-poc/app build
pnpm --filter @rsc-poc/app dev
# after preview/dev is up:
BASE_URL=http://127.0.0.1:4173 pnpm --filter @rsc-poc/app smoke:http
```

Migration + runtime docs: `packages/router/docs/MIGRATION-RSC.md`,
`packages/router/docs/RUNTIME-SUPPORT.md`.

## Observability (2.3.3)

Framework-agnostic sink only — **no** `@sentry/nextjs`.

| Runtime | Init | Capture |
|---------|------|---------|
| Node / RSC | `src/observability/node.ts` → `initNodeObservability` from entry.rsc | `renderRequest({ onError })` → loader/action/form failures (action id, never body) |
| Browser | `src/observability/browser.ts` → `initBrowserObservability` from entry.browser | `ErrorBoundary onError` + window handlers |

Request correlation: bind `x-request-id` or `x-correlation-id` per request.

Dogfood: open `/errors/boom` (Node console) or click client throw on `/errors` (browser console).

## Request layer (2.3.4)

Perimeter **outside** `Router.match` / route tables:

| Concern | Implementation |
|---------|----------------|
| Secure headers | `@revealui/security` `createSecurityMiddleware` (`src/request-layer/security.ts`) |
| Domain-lock | `RSC_POC_ALLOWED_HOSTS` host allowlist (optional) |
| CSRF (dogfood) | Same-origin Origin/Referer check on non-action POSTs |
| Session mutations | `useAction` requireSession (2.3.1) — not match-time auth |

Checklist (admin port): `packages/router/docs/REQUEST-LAYER.md`.

Smoke asserts `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP present, and evil-Origin POST → 403.

## Pin policy

- `react` / `react-dom` / `react-server-dom-webpack`: **exact same version**, floor **≥19.2.4**
- `@vitejs/plugin-rsc`: pin exact (0.5.27)
- `vite`: workspace catalog
