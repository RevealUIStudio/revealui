---
title: "@revealui/cache"
description: "Cache store adapters and distributed invalidation for RevealUI. Memory, PGlite, and browser backends."
visibility: public
status: verified
audience: user
---

# @revealui/cache

Cache store adapters and a distributed invalidation channel for RevealUI applications.

## When to Use This

- You need a pluggable `CacheStore` (in-memory, PGlite, or browser/WASM)
- You need multi-instance cache busting via `CacheInvalidationChannel`
- You want a small logger hook for cache package diagnostics

Edge/CDN helpers (Cache-Control builders, ISR presets, edge rate limit, CDN purge) were **removed** in fleet-redundancy C11 (2026-07-23): they were tests-only with zero app consumers. Prefer platform-native cache APIs at the app boundary (`next/cache`, provider CDN APIs).

## Installation

```bash
pnpm add @revealui/cache
```

## API Reference

### Main entry (`@revealui/cache`)

| Export | Type | Purpose |
|--------|------|---------|
| `CacheStore` / `CacheEntry` | Types | Store contract |
| `CacheInvalidationChannel` | Class | Distributed cache busting across store instances |
| `configureCacheLogger` / `getCacheLogger` | Functions | Package logger hook |

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
