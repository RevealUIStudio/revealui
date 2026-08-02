# Request layer vs router (Phase 2.3.4)

Admin-shaped dual-mode apps put **HTTP security and session gates outside**
`Router.match` / `renderRequest` route tables. The router owns RSC/HTML
negotiation, loaders, actions, and UI. The request layer owns the
perimeter.

Dogfood reference: `apps/rsc-poc/src/request-layer/`.

## Split of concerns

| Concern | Owner | Not in |
|---------|--------|--------|
| CSP / secure headers | Hono or Fetch middleware (`@revealui/security` `SecurityHeaders` / `createSecurityMiddleware`) | `Router.match` |
| CSRF (origin / double-submit) | Request layer before mutations | `Router.match` |
| Session cookie gate (path or progressive login) | Request layer / form endpoints | Route `loader` as sole auth |
| Domain-lock (RevForge) | Request layer host allowlist | Router |
| Action RBAC | `router.useAction(...)` (middleware on mutations) | URL match alone |
| RSC / HTML negotiation | `renderRequest` | Edge-only rewrite of Accept |
| Observability init | Node + browser entries (`@revealui/core/observability/capture`) | Next-only Sentry |

**Hard rule:** no auth decisions inside `Router.match`. Match is pure path →
route. Authorization is `useAction`, loaders that call shared helpers, or
request-layer gates that return 403 before `renderRequest`.

## Checklist (admin port / new dual-mode app)

Copy this into the PR description for Phase 3 and tick it.

### Perimeter (request layer)

- [ ] Security headers applied on every response (`X-Content-Type-Options`,
      `X-Frame-Options`, CSP tuned for inline RSC bootstrap)
- [ ] HSTS only on HTTPS production (skip on local `http://`)
- [ ] Domain-lock / host allowlist when RevForge stamps a kit
- [ ] CSRF: same-origin (or double-submit cookie) on cookie-auth POSTs that
      are not already covered by `x-rsc-action` + SameSite
- [ ] Session login/logout (if progressive forms) live as explicit API routes,
      not inside route components’ match tables

### Router

- [ ] `new Router({ rsc: {} })` + `renderRequest` for dual-mode
- [ ] Protected mutations via `router.useAction` (fail closed)
- [ ] `onError` → `@revealui/core/observability/capture` (no body secrets)
- [ ] Error boundaries + controlled 404/500 shells (2.3.2)

### Proof

- [ ] HTTP smoke asserts security headers (see `apps/rsc-poc` `smoke:http`)
- [ ] Anonymous protected action → 403 without touching `match` auth
- [ ] Zero `@sentry/nextjs` in dogfood shell

## Minimal Fetch wrap (dogfood shape)

```ts
import { createSecurityMiddleware, SecurityHeaders } from '@revealui/security'

const withSecurity = createSecurityMiddleware(
  /* dogfood CSP with 'unsafe-inline' for RSC payload scripts */,
)

export default {
  fetch: (request: Request) =>
    withSecurity(request, async () => {
      const blocked = domainLock(request) ?? csrfOriginGate(request)
      if (blocked) return blocked
      return renderRequest(request, { router, /* … */ })
    }),
}
```

Hono equivalent: `app.use('*', async (c, next) => { … })` then
`c.env` / `c.req.raw` into `renderRequest`.

## Related

- Phase 2.3 hardening spec (`.jv`): `docs/specs/2026-08-01-phase-2.3-admin-prod-hardening.md`
- [PHASE-3-READY.md](./PHASE-3-READY.md) — Phase 2.3 acceptance + pre–Phase 3 gate (2.3.6)
- [MIGRATION-RSC.md](./MIGRATION-RSC.md) — dual-mode consumer recipe
- [RUNTIME-SUPPORT.md](./RUNTIME-SUPPORT.md) — edge matrix (D18.b)
