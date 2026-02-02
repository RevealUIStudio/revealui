# Caching Strategy Guide

This guide covers the comprehensive caching strategy implemented in RevealUI, including CDN configuration, browser caching, service workers, application-level caching, and edge computing.

## Table of Contents

- [Overview](#overview)
- [CDN Caching](#cdn-caching)
- [Browser Caching](#browser-caching)
- [Service Workers](#service-workers)
- [Application-Level Caching](#application-level-caching)
- [Edge Caching & ISR](#edge-caching--isr)
- [Cache Invalidation](#cache-invalidation)
- [Performance Impact](#performance-impact)
- [Best Practices](#best-practices)
- [Benchmarking](#benchmarking)

## Overview

A multi-layered caching strategy is essential for:
- Reducing server load (80-95% reduction possible)
- Improving response times (10-50x faster)
- Reducing bandwidth costs (60-90% savings)
- Better user experience (instant navigation)
- Offline support
- Improved reliability

Our caching strategy includes:
1. **CDN Caching** - Edge caching for global performance
2. **Browser Caching** - HTTP caching and service workers
3. **Application Caching** - React Query/SWR for data caching
4. **Edge Caching** - Next.js ISR and edge functions

## CDN Caching

Location: `packages/core/src/caching/cdn-config.ts`

### Cache-Control Headers

```typescript
import { generateCacheControl, CDN_CACHE_PRESETS } from '@revealui/core/caching/cdn-config'

// Generate Cache-Control header
const cacheControl = generateCacheControl({
  maxAge: 3600,          // 1 hour client cache
  sMaxAge: 31536000,     // 1 year CDN cache
  staleWhileRevalidate: 86400,  // 1 day SWR
  public: true,
  immutable: false,
})

// Use presets
const staticCacheControl = generateCacheControl(CDN_CACHE_PRESETS.static)
```

### CDN Cache Presets

```typescript
// Immutable assets (hashed filenames)
CDN_CACHE_PRESETS.immutable
// max-age=31536000, s-maxage=31536000, public, immutable

// Static assets (images, fonts)
CDN_CACHE_PRESETS.static
// max-age=2592000, s-maxage=31536000, stale-while-revalidate=86400, public

// API responses
CDN_CACHE_PRESETS.api
// max-age=0, s-maxage=60, stale-while-revalidate=30, public

// HTML pages
CDN_CACHE_PRESETS.page
// max-age=0, s-maxage=300, stale-while-revalidate=60, public

// Private user data
CDN_CACHE_PRESETS.private
// max-age=300, private, stale-while-revalidate=60

// No caching
CDN_CACHE_PRESETS.noCache
// no-store
```

### Cache Purging

#### Purge by URL

```typescript
import { purgeCDNCache } from '@revealui/core/caching/cdn-config'

await purgeCDNCache(
  [
    'https://example.com/api/users',
    'https://example.com/about',
  ],
  {
    provider: 'cloudflare',
    apiKey: process.env.CLOUDFLARE_API_KEY,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
  }
)
```

#### Purge by Tag

```typescript
import { purgeCacheByTag, generateCacheTags } from '@revealui/core/caching/cdn-config'

// Generate tags
const tags = generateCacheTags({
  type: 'post',
  id: 123,
  related: ['user:456', 'category:tech'],
})
// ['post', 'post:123', 'user:456', 'category:tech']

// Purge by tags
await purgeCacheByTag(['post', 'user:456'], {
  provider: 'cloudflare',
  apiKey: process.env.CLOUDFLARE_API_KEY,
  zoneId: process.env.CLOUDFLARE_ZONE_ID,
})
```

#### Purge Everything

```typescript
import { purgeAllCache } from '@revealui/core/caching/cdn-config'

await purgeAllCache({
  provider: 'cloudflare',
  apiKey: process.env.CLOUDFLARE_API_KEY,
  zoneId: process.env.CLOUDFLARE_ZONE_ID,
})
```

### Cache Warming

```typescript
import { warmCDNCache } from '@revealui/core/caching/cdn-config'

const result = await warmCDNCache(
  [
    '/popular-page-1',
    '/popular-page-2',
    '/popular-page-3',
  ],
  {
    concurrency: 5,
    headers: {
      'User-Agent': 'Cache-Warmer/1.0',
    },
  }
)

console.log(`Warmed: ${result.warmed}, Failed: ${result.failed}`)
```

## Browser Caching

### HTTP Caching

```typescript
// In Next.js API Route
export async function GET() {
  const data = await fetchData()

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  })
}
```

### Stale-While-Revalidate

```typescript
// Serve stale content while revalidating in background
{
  'Cache-Control': 'max-age=300, stale-while-revalidate=60'
}
```

This allows:
1. Serve from cache for 5 minutes
2. Between 5-6 minutes: serve stale, revalidate in background
3. After 6 minutes: fetch fresh

## Service Workers

Location: `packages/core/src/caching/service-worker.ts`

### Registration

```typescript
import { registerServiceWorker } from '@revealui/core/caching/service-worker'

// Register on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    registerServiceWorker({
      scope: '/',
      scriptURL: '/sw.js',
    })
  })
}
```

### React Hook

```typescript
import { useServiceWorker } from '@revealui/core/caching/service-worker'

function App() {
  const sw = useServiceWorker()

  useEffect(() => {
    sw.register()

    return () => {
      // Cleanup if needed
    }
  }, [])

  return <div>App</div>
}
```

### Update Notification

```typescript
// Listen for service worker updates
window.addEventListener('sw-update-available', (event) => {
  const registration = event.detail.registration

  // Show update notification
  showNotification('New version available!', {
    onUpdate: async () => {
      await skipWaitingAndActivate()
    },
  })
})
```

### Cache Management

```typescript
import {
  clearAllCaches,
  clearCache,
  precacheURLs,
  getCacheSize,
} from '@revealui/core/caching/service-worker'

// Clear all caches
await clearAllCaches()

// Clear specific cache
await clearCache('static-assets-v1')

// Precache URLs
await precacheURLs([
  '/',
  '/about',
  '/contact',
  '/styles/critical.css',
  '/fonts/inter.woff2',
])

// Get cache size
const { quota, usage, available } = await getCacheSize()
console.log(`Using ${usage} of ${quota} bytes (${available} available)`)
```

### Offline Detection

```typescript
import { isOffline, onNetworkChange } from '@revealui/core/caching/service-worker'

// Check if offline
if (isOffline()) {
  showOfflineMessage()
}

// Listen for network changes
const cleanup = onNetworkChange((online) => {
  if (online) {
    hideOfflineMessage()
    syncOfflineData()
  } else {
    showOfflineMessage()
  }
})
```

## Application-Level Caching

Location: `packages/core/src/caching/app-cache.ts`

### React Query Configuration

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEFAULT_REACT_QUERY_CONFIG } from '@revealui/core/caching/app-cache'

const queryClient = new QueryClient(DEFAULT_REACT_QUERY_CONFIG)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  )
}
```

### Cache Key Generation

```typescript
import { CacheKeyGenerator } from '@revealui/core/caching/app-cache'

const keyGen = new CacheKeyGenerator('app')

// List keys
const usersListKey = keyGen.list('users', { page: 1, limit: 20 })
// ['app', 'users', 'list', '{"page":1,"limit":20}']

// Detail keys
const userDetailKey = keyGen.detail('users', 123)
// ['app', 'users', 'detail', '123']

// Infinite query keys
const postsInfiniteKey = keyGen.infinite('posts', { category: 'tech' })
// ['app', 'posts', 'infinite', '{"category":"tech"}']

// Custom keys
const customKey = keyGen.custom('users', 'me', 'preferences')
// ['app', 'users', 'me', 'preferences']
```

### Cache Invalidation

```typescript
import { CacheInvalidator } from '@revealui/core/caching/app-cache'
import { useQueryClient } from '@tanstack/react-query'

function Component() {
  const queryClient = useQueryClient()

  const handleUpdate = () => {
    // Invalidate all user queries
    queryClient.invalidateQueries({
      queryKey: CacheInvalidator.byResource('users'),
    })

    // Invalidate specific user
    queryClient.invalidateQueries({
      queryKey: CacheInvalidator.byId('users', 123),
    })

    // Invalidate lists only
    queryClient.invalidateQueries({
      queryKey: CacheInvalidator.lists('users'),
    })
  }
}
```

### Optimistic Updates

```typescript
import { OptimisticUpdater } from '@revealui/core/caching/app-cache'
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUserAPI,
    onMutate: async (newUser) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['app', 'users'] })

      // Snapshot previous value
      const previousUsers = queryClient.getQueryData(['app', 'users', 'list'])

      // Optimistically update
      queryClient.setQueryData(
        ['app', 'users', 'list'],
        (old) => OptimisticUpdater.updateInList(old, newUser.id, newUser)
      )

      return { previousUsers }
    },
    onError: (err, newUser, context) => {
      // Rollback on error
      queryClient.setQueryData(['app', 'users', 'list'], context.previousUsers)
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['app', 'users'] })
    },
  })
}
```

### Prefetching

```typescript
import { CachePrefetcher } from '@revealui/core/caching/app-cache'
import { useQueryClient } from '@tanstack/react-query'

function UserLink({ userId }) {
  const queryClient = useQueryClient()

  const prefetchUser = () => {
    queryClient.prefetchQuery({
      queryKey: ['app', 'users', 'detail', userId],
      queryFn: () => fetchUser(userId),
    })
  }

  // Prefetch on hover
  const hoverHandlers = CachePrefetcher.onHover(prefetchUser, 300)

  return (
    <Link to={`/users/${userId}`} {...hoverHandlers}>
      View User
    </Link>
  )
}
```

### Cache Persistence

```typescript
import { CachePersistence } from '@revealui/core/caching/app-cache'

const persistence = new CachePersistence({
  key: 'app-cache',
  storage: 'localStorage',
  version: 1,
  maxAge: 86400000, // 1 day
})

// Save to storage
await persistence.save(data)

// Load from storage
const cachedData = await persistence.load()

// Remove from storage
await persistence.remove()
```

## Edge Caching & ISR

Location: `packages/core/src/caching/edge-cache.ts`

### ISR Configuration

```typescript
// app/posts/[id]/page.tsx
export const revalidate = 3600 // 1 hour

export async function generateStaticParams() {
  const posts = await getPosts()

  return posts.map((post) => ({
    id: String(post.id),
  }))
}

export default async function Page({ params }) {
  const post = await getPost(params.id)

  return <PostDetail post={post} />
}
```

### On-Demand Revalidation

```typescript
import { revalidatePath, revalidateTag } from '@revealui/core/caching/edge-cache'

// Revalidate specific path
await revalidatePath('/posts/123', process.env.REVALIDATE_SECRET)

// Revalidate by tag
await revalidateTag('posts', process.env.REVALIDATE_SECRET)

// Revalidate multiple paths
import { revalidatePaths } from '@revealui/core/caching/edge-cache'

const result = await revalidatePaths(
  ['/posts/123', '/posts/456', '/'],
  process.env.REVALIDATE_SECRET
)

console.log(`Revalidated: ${result.revalidated}, Failed: ${result.failed}`)
```

### Edge Caching Headers

```typescript
import { setEdgeCacheHeaders } from '@revealui/core/caching/edge-cache'
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await fetchData()
  const response = NextResponse.json(data)

  return setEdgeCacheHeaders(response, {
    maxAge: 0,
    sMaxAge: 300,
    staleWhileRevalidate: 60,
    tags: ['api', 'users'],
  })
}
```

### Edge Rate Limiting

```typescript
import { EdgeRateLimiter } from '@revealui/core/caching/edge-cache'
import { NextRequest, NextResponse } from 'next/server'

const rateLimiter = new EdgeRateLimiter({
  limit: 100,
  window: 60000, // 1 minute
})

export function middleware(request: NextRequest) {
  const result = rateLimiter.check(request)

  if (!result.allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': new Date(result.reset).toISOString(),
      },
    })
  }

  return NextResponse.next()
}
```

### Geolocation-Based Caching

```typescript
import { getGeoLocation, getPersonalizationConfig } from '@revealui/core/caching/edge-cache'

export function middleware(request: NextRequest) {
  const geo = getGeoLocation(request)
  const personalization = getPersonalizationConfig(request)

  // Customize response based on location
  const response = NextResponse.next()

  response.headers.set('X-User-Country', geo?.country || 'unknown')
  response.headers.set('X-User-Device', personalization.device)

  return response
}
```

## Cache Invalidation

### When to Invalidate

| Event | Invalidation Strategy |
|-------|----------------------|
| Create | Invalidate lists |
| Update | Invalidate item + lists |
| Delete | Invalidate item + lists |
| Bulk operation | Invalidate resource |
| User logout | Clear user-specific caches |

### Invalidation Patterns

```typescript
// After creating a post
queryClient.invalidateQueries({ queryKey: CacheInvalidator.lists('posts') })

// After updating a post
queryClient.invalidateQueries({ queryKey: CacheInvalidator.byId('posts', postId) })
queryClient.invalidateQueries({ queryKey: CacheInvalidator.lists('posts') })

// After deleting a post
queryClient.invalidateQueries({ queryKey: CacheInvalidator.byId('posts', postId) })
queryClient.invalidateQueries({ queryKey: CacheInvalidator.lists('posts') })

// After user logout
queryClient.clear()
await clearAllCaches()
```

## Performance Impact

### Cache Hit Rates

Expected cache hit rates:

| Cache Layer | Target Hit Rate | Latency Reduction |
|-------------|----------------|-------------------|
| CDN | >80% | 10-20x faster |
| Browser (HTTP) | >70% | 50-100x faster (instant) |
| Service Worker | >60% | 100-1000x faster |
| React Query | >80% | 50-100x faster |

### Performance Comparison

**Without Caching:**
- Server request: 150ms
- Database query: 50ms
- Total: 200ms per request
- 1000 requests = 200s

**With Multi-Layer Caching (80% hit rate):**
- 800 cached: ~2ms = 1.6s
- 200 fresh: ~200ms = 40s
- Total: 41.6s
- **Improvement: 79% faster**

### Production Impact

For an application with 1M requests/day:

**Server Load:**
- Without caching: 1M requests
- With 80% cache hit rate: 200K requests
- **Load reduction: 80%**

**Response Times:**
- Without caching: 200ms average
- With caching: 42ms average
- **Improvement: 79% faster**

**Bandwidth:**
- Without caching: 200GB/day
- With CDN + compression: 40GB/day
- **Savings: 80%**

## Best Practices

### 1. Layer Your Caching

```
User → Browser Cache → Service Worker → CDN → Edge Cache → Origin
         ↓              ↓                ↓        ↓           ↓
       Instant      ~2ms            ~20ms    ~50ms      ~200ms
```

### 2. Use Appropriate TTLs

| Content Type | CDN TTL | Browser TTL |
|--------------|---------|-------------|
| Immutable assets | 1 year | 1 year |
| Versioned assets | 1 year | 1 month |
| Dynamic content | 5 minutes | 0 |
| User-specific | 0 | 5 minutes (private) |
| API responses | 1 minute | 0 |

### 3. Tag Everything

```typescript
// Tag responses for easy invalidation
response.headers.set('Cache-Tag', 'post,post:123,user:456,category:tech')

// Invalidate related content
await purgeCacheByTag(['user:456']) // Invalidates all content for user 456
```

### 4. Prefetch Strategically

```typescript
// Prefetch on hover (300ms delay to avoid false positives)
const handlers = CachePrefetcher.onHover(prefetchFn, 300)

// Prefetch on idle
CachePrefetcher.onIdle(prefetchFn)

// Prefetch on visibility
CachePrefetcher.onVisible(element, prefetchFn)
```

### 5. Monitor Cache Performance

```typescript
import { CacheStatsTracker } from '@revealui/core/caching/app-cache'

const tracker = new CacheStatsTracker()

// Track hits and misses
if (cachedData) {
  tracker.recordHit()
} else {
  tracker.recordMiss()
}

// Get statistics
const stats = tracker.getStats()
console.log(`Hit rate: ${stats.hitRate.toFixed(1)}%`)
```

### 6. Handle Cache Failures Gracefully

```typescript
try {
  const cachedData = await cache.get(key)
  if (cachedData) return cachedData
} catch (error) {
  // Cache failure - fetch fresh
  console.warn('Cache read failed:', error)
}

const freshData = await fetchFresh()
return freshData
```

## Benchmarking

Location: `scripts/performance/benchmark-cache.ts`

### Running Benchmarks

```bash
# Run all cache benchmarks
pnpm benchmark:cache

# Run specific benchmark
pnpm benchmark:cache:cdn          # CDN headers
pnpm benchmark:cache:keys         # Cache key generation
pnpm benchmark:cache:optimistic   # Optimistic updates
pnpm benchmark:cache:hit-rate     # Cache hit rate simulation
pnpm benchmark:cache:dedupe       # Query deduplication
pnpm benchmark:cache:cdn-perf     # CDN vs origin performance
pnpm benchmark:cache:isr          # ISR vs SSR
pnpm benchmark:cache:storage      # Storage performance
```

### Example Results

```
=== Cache Hit Rate Simulation ===

Cache Statistics:
  Total Queries: 1000
  Cache Hits: 847
  Cache Misses: 153
  Hit Rate: 84.7%

Performance Impact:
  With cache: 25,644ms
  Without cache: 150,000ms
  Time savings: 124,356ms (82.9%)

=== ISR vs SSR Performance ===

Rendering Strategy Comparison (10,000 page views):

SSR (Server-Side Rendering):
  Generations: 10,000
  Time per generation: 150ms
  Total time: 1500.0s

ISR (Incremental Static Regeneration):
  Generations: 17
  Cached serves: 9,983
  Time per generation: 150ms
  Time per cached serve: 20ms
  Total time: 202.2s

Performance Impact:
  Time savings: 1297.8s (86.5%)
  Speedup: 7.4x
  Server load reduction: 99.8%
```

## Troubleshooting

### High Cache Miss Rate

1. Check TTL values (too short?)
2. Verify cache key consistency
3. Review cache eviction policies
4. Monitor cache storage limits
5. Check for cache key variations

### Stale Data Issues

1. Implement cache invalidation on mutations
2. Use shorter TTLs for frequently changing data
3. Enable stale-while-revalidate
4. Add manual revalidation triggers

### Service Worker Issues

1. Check service worker registration
2. Verify cache strategies
3. Clear old caches on update
4. Test offline functionality
5. Monitor cache storage usage

## Further Reading

- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [React Query Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [Next.js ISR](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [Cloudflare Cache](https://developers.cloudflare.com/cache/)
