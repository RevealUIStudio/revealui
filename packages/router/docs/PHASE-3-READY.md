# Phase 3 ready checklist (GAP-194 Phase 2.3.6)

**Purpose:** Prove Phase 2.3 production-hardening gates are met on dual-mode
`@revealui/router` + dogfood `apps/rsc-poc`, so **Phase 3** (`apps/admin` port
from Next.js) may start when the **owner** marks criterion G.

**Not this document:** Owner disposition (G). Optional thin admin shell (2.3.5)
was deferred by owner ruling: dogfood **`apps/rsc-poc` only** until Phase 3.

**Phase 3 inventory (private fleet brain):**  
`revealui-jv` → `docs/specs/2026-05-23-phase-3-admin-port-scope.md`  
(Re-count at Tier-0 start; do not trust stale table counts alone.)

**Public recipes:** [MIGRATION-RSC.md](./MIGRATION-RSC.md),  
[REQUEST-LAYER.md](./REQUEST-LAYER.md), [RUNTIME-SUPPORT.md](./RUNTIME-SUPPORT.md).

## Package floor (as of this checklist)

| Package | Version | Notes |
|---------|---------|--------|
| `@revealui/router` | `0.4.0-rc.9` | Dual-mode RSC + `onError` hooks (2.3.2–2.3.3) |
| `@revealui/core` | `0.12.3` | `observability/capture` (2.3.3) |
| Dogfood | `apps/rsc-poc` | Auth, errors, observability, request-layer |

## Phase 2.3 acceptance

| # | Criterion | Status | Evidence (code / dogfood) |
|---|-----------|--------|---------------------------|
| **A** | Auth available in RSC path without Next `cookies()` API | **Met** | Signed dogfood cookie + ALS `getRequest()`: `apps/rsc-poc/src/auth/session.ts`, `session-server.ts`, progressive `/api/session/login` in `entry.rsc.tsx`. Page: `pages/session.tsx`. |
| **B** | Action mutations fail closed without session via `useAction` | **Met** | `createServerAppRouter` → `router.useAction(requireSessionForProtectedActions)` in `app-router.server.ts`; markers `secretPing` / `protected-ping` in `auth/require-session.ts`; actions in `pages/session.server.ts`. |
| **C** | Route error boundary + notFound UI documented and tested | **Met** | `ErrorBoundary` + `renderRequest` 404/500 shells; dogfood `/errors`, `/errors/not-found`, `/errors/boom`; tests `packages/router/src/__tests__/error-boundary.test.tsx`; UI `pages/errors.tsx`, `error-fallback.tsx`. |
| **D** | Observability init without `@sentry/nextjs` | **Met** | `@revealui/core/observability/capture` (`initNodeObservability` / `initBrowserObservability`); dogfood `apps/rsc-poc/src/observability/{node,browser}.ts`; `renderRequest({ onError })` + `ErrorBoundary onError`. Zero `@sentry/nextjs` in rsc-poc. |
| **E** | Request-layer vs router split documented | **Met** | [REQUEST-LAYER.md](./REQUEST-LAYER.md); dogfood `apps/rsc-poc/src/request-layer/*` + `withRequestLayer` on RSC `fetch`; **no auth inside `Router.match`**. |
| **F** | Dual-mode client consumers still green | **CI** | Docs/marketing typecheck + monorepo gate on PRs targeting `test`. Confirm green on the merge train PR before promote. |
| **G** | Owner marks Phase 2.3 done → Phase 3 may start | **Owner** | Disposition only. Not agent-mergeable. |

## Hard rules carried into Phase 3

1. **No auth in `Router.match`.** Match is pure path → route. Gates: request layer, `useAction`, or shared helpers called from loaders/actions.
2. **No `@sentry/nextjs` on dual-mode apps.** Use `@revealui/core/observability/capture`.
3. **Browser entry must not import `@revealui/router/server`** (AsyncLocalStorage). Pattern: `createAppRouter()` client-safe; `createServerAppRouter()` RSC-only (`apps/rsc-poc` 2026-08-02 fix).
4. **Perimeter first:** CSP / CSRF / domain-lock wrap `renderRequest` (Hono or Fetch middleware).

## Pre–Phase 3 operator checklist

Copy into the Tier-0 admin-port kickoff PR / lane.

### Dogfood green

- [ ] `pnpm --filter @revealui/router build && pnpm --filter @revealui/router test`
- [ ] `pnpm --filter @rsc-poc/app typecheck && build && test`
- [ ] `BASE_URL=… pnpm --filter @rsc-poc/app smoke:http` (headers + CSRF 403 + 404/500)
- [ ] Manual: Counter +/−, Session sign-in, `whoami` / protected action fail-closed when anonymous
- [ ] No `AsyncLocalStorage is not a constructor` in browser console

### Phase 3 kickoff artifacts

- [ ] Re-count admin `next/*` surfaces per phase-3 port scope (tracked source only; exclude `.next/`)
- [ ] Cut feature branch from `origin/test` (not a feature tip)
- [ ] Request-layer recipe for admin Hono shell chosen (extend rsc-poc pattern)
- [ ] Owner has disposed **G** (this file alone is not permission to start mass port)

## Out of scope for 2.3.6

| Item | Notes |
|------|--------|
| 2.3.5 admin-shell app | Deferred; rsc-poc only until Phase 3 |
| Route-by-route admin port | Phase 3 buckets in port-scope spec |
| Stable `0.4.0` router release | Still on `0.4.0-rc.*` until release train |

## History

| Date | Note |
|------|------|
| 2026-08-02 | 2.3.6 checklist authored; 2.3.1–2.3.4 dogfood on rsc-poc; browser ALS import graph fixed |
| 2026-08-02 | Tier 0 **3.0** pre-stage: `@revealui/core/vite/withRevealUI` (+ rsc-poc dogfood). Still owner **G** before mass admin port / `apps/admin-vite` (3.1). |
