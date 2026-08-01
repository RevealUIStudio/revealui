---
title: "Migrate to RSC mode (@revealui/router 0.4)"
description: "Opt-in dual-mode migration: keep client SPA, or enable RSC with renderRequest and payload loaders."
visibility: public
status: verified
audience: user
---

# Migrate to RSC mode

`@revealui/router` **0.4** is dual-mode. Existing SPA consumers keep the 0.3.x
contract by default. RSC is **opt-in** via the constructor.

## Mode selection (ADR D1 / L3)

| Construct | Mode | Behavior |
|-----------|------|----------|
| `new Router()` | `client` | 0.3.x SPA: History API, loaders only on `resolve()`, no flight fetch |
| `new Router({ rsc: {} })` | `rsc` | Content negotiation (`Accept: text/x-component`) + soft-nav flight |
| `new Router({ rsc: { endpoint: '/.rsc' } })` | `rsc` | CDN `Vary: accept` escape hatch — RSC URLs under that prefix |

```ts
// SPA (marketing, docs, agency) — no change required
const router = new Router()
router.registerRoutes(routes)

// RSC app — opt in
const router = new Router({ rsc: {} })
```

## Client SPA → stay on client mode

1. Keep `import { Router, RouterProvider, Routes, Link } from '@revealui/router'`.
2. Do **not** pass `rsc` in options.
3. SPA SSR stays on `@revealui/router/server-ssr` (`createSSRHandler`, `hydrate`).

Compat suite: `src/__tests__/client-mode-compat.test.tsx` (T9 / D16).

## Client SPA → opt into RSC

### 1. Shared route table

```ts
import { Router } from '@revealui/router/core' // no createContext — RSC-safe

export function createAppRouter() {
  const router = new Router({ rsc: {} })
  router.register({ path: '/', component: Home, layout: AppLayout })
  // ...
  return router
}
```

Use `@revealui/router/core` for route modules imported from server entries so the
plugin-rsc graph never pulls React client context.

### 2. Server entry (`renderRequest`)

```ts
import { renderRequest } from '@revealui/router/server'
// Wire plugin-rsc / RSDW yourself (ADR D11)
await renderRequest(request, {
  router,
  createRscStream: async (req, ctx) => /* flight stream */,
  loadServerAction: (id) => loadServerAction(id),
  decodeActionArgs: (req) => decodeReply(...),
  decodeFormAction: (fd) => decodeAction(fd),       // progressive forms (2.2.4)
  decodeFormState: (result, fd) => decodeFormState(result, fd),
  loadBootstrapScriptContent: () => /* client bootstrap */,
  renderHtml: async ({ rscStream, bootstrapScriptContent, formState }) => /* SSR */,
})
```

Import map:

| Subpath | Use |
|---------|-----|
| `@revealui/router` | Client components/hooks |
| `@revealui/router/core` | `Router` class + types (server + client shared) |
| `@revealui/router/server` | `renderRequest`, `redirect`, `notFound`, `getRequest` |
| `@revealui/router/server-ssr` | SPA-only `createSSRHandler` / `hydrate` |

### 3. Browser entry (soft navigation)

```ts
import {
  RouterProvider,
  useRscPayload,
  useNavigationStatus,
} from '@revealui/router'
import { RSC_ACCEPT } from '@revealui/router/core'

const router = createAppRouter()
router.setRscPayloadLoader(async (url, signal) =>
  createFromFetch(fetch(url, { headers: { accept: RSC_ACCEPT }, signal })),
)
router.applyRscPayload(initialPayload) // from __RSC_PAYLOAD__ or first fetch
router.initClient()

function App() {
  const payload = useRscPayload<{ root: React.ReactNode }>()
  const status = useNavigationStatus()
  return (
    <RouterProvider router={router}>
      {status === 'loading' ? <Progress /> : null}
      {payload?.root}
    </RouterProvider>
  )
}
```

### 4. Server actions + progressive forms

| Path | Request | Router options |
|------|---------|----------------|
| JS | `POST` + `x-rsc-action` + `Accept: text/x-component` | `loadServerAction`, `decodeActionArgs` |
| No JS | `POST` form body, no action header | `decodeFormAction`, `decodeFormState` |

Both paths run `router.useAction(...)` middleware (auth/RBAC).

`redirect('/path')` from an action:

- HTML representation → **307/308** + `Location`
- RSC representation → **200** JSON + `X-Router-Redirect`  
  Client: `getRouterRedirect(response)` then `router.navigate(path)`.

### 5. CDN / caching (D1 / D4)

- Default negotiation needs **`Vary: accept`** on the origin (or edge config).
- Broken CDNs: set `rsc: { endpoint: '/.rsc' }` and fetch prefixed URLs.
- Router does **not** ship `revalidatePath` / tag cache (D4). Use HTTP
  `Cache-Control` + CDN, or `@revealui/cache` when appropriate.

## What does not migrate 1:1 from Next App Router

| Next | RevealUI router |
|------|-----------------|
| `loading.tsx` / `error.tsx` | Compose `Suspense` + route `errorBoundary` (D5) |
| `revalidatePath` / `revalidateTag` | CDN / `@revealui/cache` (D4) |
| File-based `app/` tree | Programmatic `router.register` |
| Built-in RSDW bundling | Consumer wires `@vitejs/plugin-rsc` or RSDW (D11) |

## Reference app

`apps/rsc-poc` is the dual-mode dogfood harness (GAP-194 Phase 2.2).

## Runtime support

See [RUNTIME-SUPPORT.md](./RUNTIME-SUPPORT.md) (D18.b matrix).
