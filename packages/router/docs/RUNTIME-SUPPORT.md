---
title: "Runtime support (@revealui/router 0.4)"
description: "D18.b edge-first runtime matrix for dual-mode router."
visibility: public
status: verified
audience: user
---

# Runtime support (D18.b)

Phase 2.2 targets **edge-first** design: Web Platform APIs on the RSC render and
dispatch path. Node-only APIs are not used in `@revealui/router/server`.

## Support matrix

| Runtime | Client mode | RSC mode (`renderRequest`) | `getRequest()` ALS | Notes |
|---------|-------------|----------------------------|--------------------|-------|
| **Node 24+** | ✅ | ✅ | ✅ `node:async_hooks` | CI default |
| **Vercel Edge** | ✅ | ✅ | ✅ | ALS since ~2023 |
| **Cloudflare Workers** | ✅ | ✅ | ✅ | ALS since 2024 |
| **Deno Deploy** | ✅ | ✅ | ✅ | |
| **Bun** | ✅ | ✅ | ✅ | |
| **Netlify Edge / Fastly Compute** | ✅ | ⚠️ | ⚠️ | Mixed ALS; if `getRequest()` is unavailable, pass `Request` explicitly and avoid ALS-dependent helpers (D9 transport escape) |

## Edge-safe checklist (enforced in tests)

On the dual-mode RSC path (`server-rsc`, `actions`, `negotiate`, `navigation`,
`base64`, `request-context`, `router` core):

| Use | Avoid |
|-----|--------|
| `URL`, `Request`/`Response`, `fetch` | `node:fs`, `node:path` |
| `ReadableStream` / `tee()` | `Buffer` for payload encode |
| `TextEncoder` / `TextDecoder` | `String.fromCharCode(...spread)` on large payloads |
| `AsyncLocalStorage` (`node:async_hooks` or runtime polyfill) | Hard `node:crypto` (use WebCrypto if needed) |
| Chunked base64 (`encodeBase64Chunked`) | Stack-blowing spreads |

SPA-only **`@revealui/router/server-ssr`** intentionally uses `react-dom/server`
and is **not** for the plugin-rsc “react-server” graph. Import it only from
Node/Vite client-mode SSR entries.

## Verification

- Unit: `src/__tests__/edge-safety.test.ts` (import ban + ALS smoke + Web stream path)
- Package coverage gate: ≥80% lines/statements on package sources (2.2.5)
- Dogfood: `apps/rsc-poc` build + preview smoke

## Selection guidance

1. **Default self-host / Vercel Node:** full dual-mode, no special flags.
2. **Edge (Workers / Vercel Edge / Deno / Bun):** use `renderRequest` + Web
   APIs; keep secrets and heavy I/O out of the request path.
3. **Edge without ALS:** do not call `getRequest()`; thread `Request` through
   loaders/actions yourself; keep `serverActionTransport` if you customize fetch.
