# @revealui/cache

Caching infrastructure for RevealUI applications. Provides CDN cache configuration, edge cache helpers, ISR presets, tag-based revalidation, and rate limiting at the edge.

## When to Use This

- You need Cache-Control headers for CDN responses (Vercel, Cloudflare)
- You want ISR presets for Next.js pages (static, dynamic, real-time)
- You need tag-based cache invalidation when content changes
- You want edge-level rate limiting or A/B test variant assignment
- You need cache warming for static paths

If you're caching in-memory data within a single request, use standard `Map` or LRU  -  this package is for HTTP-layer and CDN caching.

## Installation

```bash
pnpm add @revealui/cache
```

Optional peer dependency: `next` (>=14.0.0)  -  required for ISR helpers.

## API Reference

### CDN Configuration

| Export | Type | Purpose |
|--------|------|---------|
| `generateCacheControl` | Function | Build Cache-Control header string from config |
| `getCacheTTL` | Function | Get TTL for a content type |
| `CDN_CACHE_PRESETS` | Object | Pre-built configs (static, api, dynamic, immutable) |
| `DEFAULT_CDN_CONFIG` | Object | Default CDN configuration |
| `generateCacheTags` | Function | Generate cache tags for content-based invalidation |
| `generateVercelCacheConfig` | Function | Vercel-specific cache headers |
| `generateCloudflareConfig` | Function | Cloudflare-specific cache config |
| `shouldCacheResponse` | Function | Determine if a response should be cached |

### CDN Purge

| Export | Type | Purpose |
|--------|------|---------|
| `purgeCDNCache` | Function | Purge CDN cache by URL patterns |
| `purgeCacheByTag` | Function | Purge by cache tag (content-type based) |
| `purgeAllCache` | Function | Full CDN cache purge |
| `warmCDNCache` | Function | Pre-warm cache for a list of URLs |

### Edge Cache & ISR

| Export | Type | Purpose |
|--------|------|---------|
| `ISR_PRESETS` | Object | Next.js ISR configs (static: 1h, dynamic: 60s, realtime: 10s, immutable: 1y) |
| `revalidatePath` | Function | Revalidate a single Next.js path |
| `revalidatePaths` | Function | Batch path revalidation |
| `revalidateTag` | Function | Revalidate by cache tag |
| `revalidateTags` | Function | Batch tag revalidation |
| `generateStaticParams` | Function | Helper for Next.js static generation |
| `setEdgeCacheHeaders` | Function | Set edge-specific cache headers on response |
| `createEdgeCachedFetch` | Function | Fetch wrapper with edge caching |
| `createCachedFunction` | Function | Memoize an async function with TTL |
| `warmISRCache` | Function | Pre-warm ISR cache for static paths |
| `addPreloadLinks` | Function | Add `Link: <url>; rel=preload` headers |

### Edge Utilities

| Export | Type | Purpose |
|--------|------|---------|
| `EdgeRateLimiter` | Class | Token bucket rate limiter for edge functions |
| `getGeoLocation` | Function | Extract geo data from edge request headers |
| `getABTestVariant` | Function | Deterministic A/B test variant assignment |
| `getPersonalizationConfig` | Function | Edge personalization based on geo/device |

### Configuration

| Export | Type | Purpose |
|--------|------|---------|
| `configureCacheLogger` | Function | Set custom logger (defaults to console) |

## JOSHUA Alignment

- **Adaptive**: ISR presets scale from real-time (10s) to immutable (1y) based on content volatility
- **Unified**: Cache tags follow the same taxonomy as CMS collections  -  invalidation is automatic
- **Orthogonal**: Caching is a separate concern from content serving  -  swap CDN providers without changing business logic

## Related Packages

- `apps/server`  -  Applies cache headers to REST responses
- `apps/marketing`  -  Uses ISR presets for marketing pages
- `@revealui/core`  -  Triggers cache invalidation on content changes
