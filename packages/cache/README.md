---
title: "@revealui/cache"
description: "Cache store adapters and distributed invalidation for RevealUI. Memory, PGlite, and browser backends."
visibility: public
status: verified
audience: user
---

# @revealui/cache

Cache store adapters, tag-aware memoization, and a distributed invalidation channel for RevealUI applications.

## When to Use This

- You need a pluggable `CacheStore` (in-memory, PGlite, or browser/WASM)
- You need CMS-style **tag-aware** data memoization (`createCachedFunction` + `revalidateTag`) without Next.js
- You need multi-instance cache busting via `CacheInvalidationChannel`
- You want a small logger hook for cache package diagnostics

Edge/CDN helpers (Cache-Control builders, ISR presets, edge rate limit, CDN purge) were **removed** in fleet-redundancy C11 (2026-07-23). Prefer platform-native APIs for HTML/CDN. **Do not** put router RSC payloads here (ADR D4: `@revealui/router` stays uncached).

## Installation

```bash
pnpm add @revealui/cache
```

## API Reference

### Main entry (`@revealui/cache`)

| Export | Type | Purpose |
|--------|------|---------|
| `CacheStore` / `CacheEntry` | Types | Store contract |
| `createCachedFunction` | Function | Tag-aware memoization (explicit `keyParts` + tags) |
| `revalidateTag` / `revalidatePath` | Functions | Local-evict by tag or path tag/prefix |
| `getDefaultCacheStore` / `setDefaultCacheStore` | Functions | Process default store |
| `CacheInvalidationChannel` | Class | Distributed cache busting across store instances |
| `configureCacheLogger` / `getCacheLogger` | Functions | Package logger hook |

```ts
import {
  createCachedFunction,
  revalidateTag,
} from '@revealui/cache'

const loadFooter = createCachedFunction(async () => fetchFooter(), {
  keyParts: ['global', 'footer'],
  tags: ['global_footer'],
  ttlSeconds: 300,
})

await loadFooter()
await revalidateTag('global_footer')
```

### Adapters subpath (`@revealui/cache/adapters`)

| Export | Purpose |
|--------|---------|
| `InMemoryCacheStore` | Map-backed, single-process |
| `PGliteCacheStore` | PostgreSQL-backed via PGlite |
| `createBrowserCache` | PGlite WASM + IndexedDB |
| `useBrowserCache` | React hook for browser cache singleton |

## Design Principles

- **Adapters over monoliths** — pick a store backend; do not bake CDN provider SDKs into this package
- **No Next.js peer dep** — HTTP edge helpers lived here previously; app frameworks own their revalidation APIs
- **Honest surface** — only ship what runtime paths use

## License

MIT
