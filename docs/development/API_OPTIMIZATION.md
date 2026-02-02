# API Performance Optimization Guide

This guide covers the API performance optimization infrastructure implemented in RevealUI, including response compression, HTTP caching, payload optimization, and rate limiting.

## Table of Contents

- [Overview](#overview)
- [Response Compression](#response-compression)
- [HTTP Caching](#http-caching)
- [Payload Optimization](#payload-optimization)
- [Rate Limiting](#rate-limiting)
- [Performance Monitoring](#performance-monitoring)
- [Best Practices](#best-practices)
- [Benchmarking](#benchmarking)

## Overview

API performance optimization is critical for:
- Reducing bandwidth usage
- Improving response times
- Preventing API abuse
- Enhancing user experience
- Reducing infrastructure costs

Our optimization strategy includes:
1. **Response Compression** - Reduce payload size with gzip/brotli
2. **HTTP Caching** - Minimize redundant requests
3. **Payload Optimization** - Send only necessary data
4. **Rate Limiting** - Prevent abuse and ensure fair usage

## Response Compression

Location: `packages/core/src/api/compression.ts`

### Features

- **Multi-format Support**: Gzip and Brotli compression
- **Automatic Detection**: Uses client Accept-Encoding header
- **Configurable Threshold**: Only compress responses above size threshold
- **Content Type Filtering**: Skip already-compressed content (images, videos)
- **Compression Levels**: Configurable 1-9 for gzip, 0-11 for brotli

### Usage

#### Basic Compression

```typescript
import { compressResponse, COMPRESSION_PRESETS } from '@revealui/core/api/compression'

// In Next.js API route
export async function GET(request: NextRequest) {
  const data = await fetchData()
  const response = NextResponse.json(data)

  // Compress response
  return compressResponse(request, response, COMPRESSION_PRESETS.api)
}
```

#### Compression Middleware

```typescript
import { createCompressionMiddleware } from '@revealui/core/api/compression'

const compressionMiddleware = createCompressionMiddleware({
  threshold: 1024, // 1KB minimum
  level: 6,
  preferBrotli: true,
})

// Apply to route
export async function GET(request: NextRequest) {
  return compressionMiddleware(request, async () => {
    const data = await fetchData()
    return NextResponse.json(data)
  })
}
```

### Compression Presets

```typescript
// Fast compression (lower ratio, faster)
COMPRESSION_PRESETS.fast

// Balanced (default)
COMPRESSION_PRESETS.balanced

// Maximum compression (slower, best ratio)
COMPRESSION_PRESETS.max

// For static assets
COMPRESSION_PRESETS.static

// For API responses
COMPRESSION_PRESETS.api
```

### Performance Impact

- **Typical Savings**: 60-80% for JSON responses
- **Brotli vs Gzip**: Brotli typically 15-25% better compression
- **CPU Cost**: Minimal for level 6, moderate for level 9
- **Latency**: +5-20ms compression time, offset by faster transfer

### Best Practices

1. **Set Appropriate Threshold**: Don't compress tiny responses (<1KB)
2. **Use Brotli for Static**: Pre-compress static assets with brotli level 11
3. **Cache Compressed**: Cache both compressed and uncompressed versions
4. **Monitor CPU**: Watch CPU usage on high-traffic endpoints
5. **Skip Images**: Never compress already-compressed formats

## HTTP Caching

Location: `packages/core/src/api/response-cache.ts`

### Features

- **Cache-Control Headers**: Automatic header management
- **ETag Support**: Conditional requests with 304 responses
- **Tag-based Invalidation**: Invalidate related cache entries
- **Stale-While-Revalidate**: Serve stale content while revalidating
- **Private/Public Caching**: Control cache scope

### Usage

#### Cache Middleware

```typescript
import { createCacheMiddleware, CACHE_PRESETS } from '@revealui/core/api/response-cache'

// Cache for 5 minutes
const cacheMiddleware = createCacheMiddleware(CACHE_PRESETS.medium)

export async function GET(request: NextRequest) {
  return cacheMiddleware(request, async () => {
    const data = await fetchData()
    return NextResponse.json(data)
  })
}
```

#### Manual Caching

```typescript
import { getCachedResponse, setCachedResponse } from '@revealui/core/api/response-cache'

export async function GET(request: NextRequest) {
  // Try cache first
  const cached = await getCachedResponse(request)
  if (cached) return cached

  // Generate response
  const data = await fetchData()
  const response = NextResponse.json(data)

  // Cache it
  await setCachedResponse(request, response, {
    ttl: 300,
    tags: ['users', 'profiles'],
  })

  return response
}
```

#### Cache Invalidation

```typescript
import { invalidateCacheTags, invalidateCachePattern } from '@revealui/core/api/response-cache'

// Invalidate by tags
invalidateCacheTags(['users', 'profiles'])

// Invalidate by pattern
invalidateCachePattern('/api/users/*')
```

### Cache Presets

```typescript
// No caching
CACHE_PRESETS.noCache

// 1 minute cache
CACHE_PRESETS.short

// 5 minute cache
CACHE_PRESETS.medium

// 1 hour cache
CACHE_PRESETS.long

// 1 day cache
CACHE_PRESETS.veryLong

// 1 year (immutable)
CACHE_PRESETS.immutable

// Private user data
CACHE_PRESETS.private

// Public static data
CACHE_PRESETS.public
```

### Cache Headers

The middleware automatically sets:

```http
Cache-Control: public, max-age=300, stale-while-revalidate=60
ETag: "abc123"
Age: 45
X-Cache: HIT
Vary: Accept-Encoding
```

### Best Practices

1. **Cache GET Requests**: Only cache GET and HEAD requests
2. **Use ETags**: Implement ETags for conditional requests
3. **Tag Everything**: Use tags for related resources
4. **Vary Headers**: Include Vary header for correct caching
5. **Monitor Hit Rate**: Target >80% cache hit rate
6. **Stale-While-Revalidate**: Use for better UX with fresh data

## Payload Optimization

Location: `packages/core/src/api/payload-optimization.ts`

### Features

- **Field Selection**: Include/exclude specific fields
- **Pagination**: Offset and cursor-based pagination
- **Empty Value Removal**: Strip null/undefined values
- **Date Transformation**: Convert dates to ISO strings
- **Sensitive Field Sanitization**: Remove passwords, tokens, etc.
- **Size Calculation**: Measure and report optimization savings

### Usage

#### Field Selection

```typescript
import { selectFields } from '@revealui/core/api/payload-optimization'

const user = {
  id: 1,
  name: 'John',
  email: 'john@example.com',
  password: 'secret',
  createdAt: new Date(),
}

// Include only specific fields
const publicUser = selectFields(user, {
  include: ['id', 'name', 'email'],
})
// { id: 1, name: 'John', email: 'john@example.com' }

// Exclude sensitive fields
const safeUser = selectFields(user, {
  exclude: ['password'],
})
```

#### Pagination

```typescript
import { paginateArray } from '@revealui/core/api/payload-optimization'

const users = await db.query.users.findMany()

// Paginate results
const result = paginateArray(users, {
  page: 1,
  limit: 20,
  maxLimit: 100,
})

/*
{
  data: [...20 users...],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    hasMore: true
  }
}
*/
```

#### Cursor-based Pagination

```typescript
import { createCursor, parseCursor } from '@revealui/core/api/payload-optimization'

// Create cursor from last item
const lastUser = users[users.length - 1]
const cursor = createCursor(lastUser, 'id')

// Parse cursor in next request
const { field, value } = parseCursor(cursor)
// Use value to fetch next page: WHERE id > value
```

#### Complete Optimization

```typescript
import { optimizePayload } from '@revealui/core/api/payload-optimization'

const result = optimizePayload(users, {
  include: ['id', 'name', 'email', 'createdAt'],
  removeEmpty: true,
  transformDates: true,
  sanitize: true,
})

console.log(`Original: ${result.originalSize} bytes`)
console.log(`Optimized: ${result.optimizedSize} bytes`)
console.log(`Savings: ${result.savingsPercent.toFixed(1)}%`)
```

#### Query Parameter Support

```typescript
import { parseFieldsFromQuery, parsePaginationFromQuery } from '@revealui/core/api/payload-optimization'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  // Parse ?fields=id,name,email
  const fields = parseFieldsFromQuery(url.search)

  // Parse ?page=2&limit=20
  const pagination = parsePaginationFromQuery(url.search)

  const users = await fetchUsers()
  return NextResponse.json(
    createOptimizedResponse(users, { fields, pagination })
  )
}
```

### Best Practices

1. **Default Fields**: Define sensible default fields for each resource
2. **Exclude Sensitive**: Always exclude passwords, tokens, secrets
3. **Cursor for Large Sets**: Use cursor pagination for >10k items
4. **Remove Empty**: Strip null/undefined to reduce payload
5. **Transform Dates**: Standardize on ISO 8601 format
6. **Document Fields**: Document available fields in API docs

## Rate Limiting

Location: `packages/core/src/api/rate-limit.ts`

### Features

- **Multiple Algorithms**: Fixed window, sliding window, token bucket
- **Flexible Keys**: By IP, user ID, API key, endpoint
- **Configurable Limits**: Presets for common scenarios
- **Standard Headers**: X-RateLimit-* headers
- **429 Responses**: Proper rate limit exceeded responses
- **Automatic Cleanup**: Remove expired entries

### Usage

#### Basic Rate Limiting

```typescript
import { createRateLimitMiddleware, RATE_LIMIT_PRESETS } from '@revealui/core/api/rate-limit'

// 100 requests per minute
const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMIT_PRESETS.standard)

export async function GET(request: NextRequest) {
  return rateLimitMiddleware(request, async () => {
    const data = await fetchData()
    return NextResponse.json(data)
  })
}
```

#### Custom Rate Limiting

```typescript
import { createRateLimitMiddleware } from '@revealui/core/api/rate-limit'

const rateLimitMiddleware = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50,
  keyGenerator: (request) => {
    // Rate limit by user ID
    const userId = request.headers.get('x-user-id') || 'anonymous'
    return `user:${userId}`
  },
})
```

#### Rate Limit by User

```typescript
import { createUserRateLimit } from '@revealui/core/api/rate-limit'

const rateLimitMiddleware = createUserRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 100,
})
```

#### Rate Limit by API Key

```typescript
import { createAPIKeyRateLimit } from '@revealui/core/api/rate-limit'

const rateLimitMiddleware = createAPIKeyRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 1000, // Higher limit for API keys
})
```

#### Sliding Window Rate Limiting

```typescript
import { checkSlidingWindowRateLimit } from '@revealui/core/api/rate-limit'

export async function POST(request: NextRequest) {
  const result = checkSlidingWindowRateLimit(request, {
    windowMs: 60 * 1000,
    maxRequests: 10,
  })

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // Process request
}
```

### Rate Limit Presets

```typescript
// 10 requests per minute
RATE_LIMIT_PRESETS.veryStrict

// 30 requests per minute
RATE_LIMIT_PRESETS.strict

// 100 requests per minute
RATE_LIMIT_PRESETS.standard

// 500 requests per minute
RATE_LIMIT_PRESETS.relaxed

// 1000 requests per hour
RATE_LIMIT_PRESETS.hourly

// 10000 requests per day
RATE_LIMIT_PRESETS.daily
```

### Rate Limit Headers

Responses include:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-15T10:30:00.000Z
```

429 responses include:

```http
Retry-After: 45
```

### Best Practices

1. **Different Tiers**: Use different limits for anonymous, authenticated, premium
2. **Endpoint-specific**: Apply stricter limits to expensive endpoints
3. **Sliding Window**: Use for smoother rate limiting experience
4. **Token Bucket**: Use for burst tolerance
5. **Monitor Abuse**: Track rate limit hits to identify abuse
6. **Graceful Degradation**: Return informative 429 responses

## Performance Monitoring

### API Response Metrics

Track these metrics for each endpoint:

```typescript
interface APIMetrics {
  endpoint: string
  method: string
  avgResponseTime: number
  p50: number
  p95: number
  p99: number
  requestCount: number
  errorRate: number
  cacheHitRate: number
  avgPayloadSize: number
  compressionRatio: number
}
```

### Monitoring Implementation

```typescript
import { monitorQuery } from '@revealui/core/monitoring/query-monitor'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const response = await monitorQuery('api:users:list', async () => {
      // Your API logic
      const data = await fetchUsers()
      return NextResponse.json(data)
    })

    // Track metrics
    const duration = Date.now() - startTime
    trackAPIMetric('/api/users', 'GET', duration, response.status)

    return response
  } catch (error) {
    trackAPIError('/api/users', 'GET', error)
    throw error
  }
}
```

### Key Performance Indicators

| Metric | Target | Critical |
|--------|--------|----------|
| Response Time (p95) | < 200ms | < 500ms |
| Response Time (p99) | < 500ms | < 1s |
| Cache Hit Rate | > 80% | > 60% |
| Error Rate | < 0.1% | < 1% |
| Compression Ratio | > 60% | > 40% |
| Rate Limit Hit Rate | < 1% | < 5% |

## Best Practices

### 1. Combine Optimizations

```typescript
import { createCompressionMiddleware } from '@revealui/core/api/compression'
import { createCacheMiddleware } from '@revealui/core/api/response-cache'
import { createRateLimitMiddleware } from '@revealui/core/api/rate-limit'
import { createOptimizedResponse } from '@revealui/core/api/payload-optimization'

export async function GET(request: NextRequest) {
  // Apply rate limiting first
  const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMIT_PRESETS.standard)

  return rateLimitMiddleware(request, async () => {
    // Then check cache
    const cacheMiddleware = createCacheMiddleware(CACHE_PRESETS.medium)

    return cacheMiddleware(request, async () => {
      // Generate optimized response
      const data = await fetchUsers()
      const optimized = createOptimizedResponse(data, {
        fields: { include: ['id', 'name', 'email'] },
        pagination: { page: 1, limit: 20 },
      })

      const response = NextResponse.json(optimized)

      // Finally compress
      const compressionMiddleware = createCompressionMiddleware(COMPRESSION_PRESETS.api)
      return compressionMiddleware(request, async () => response)
    })
  })
}
```

### 2. Cache Compressed Responses

Store both compressed and uncompressed versions in cache for maximum efficiency.

### 3. Monitor Everything

Track all optimization metrics to identify bottlenecks and measure improvements.

### 4. Test Under Load

Use benchmarking tools to verify optimizations work under realistic load.

### 5. Document Limits

Clearly document rate limits and optimization strategies in API documentation.

## Benchmarking

Location: `scripts/performance/benchmark-api.ts`

### Running Benchmarks

```bash
# Run all API benchmarks
pnpm benchmark:api

# Run specific benchmark
pnpm benchmark:api compression
pnpm benchmark:api caching
pnpm benchmark:api rate-limit
```

### Benchmark Suites

1. **Compression Benchmark**
   - Compare gzip vs brotli
   - Measure compression ratios at different levels
   - Test with various payload sizes

2. **Caching Benchmark**
   - Measure cache hit/miss performance
   - Test invalidation strategies
   - Compare in-memory vs Redis

3. **Payload Optimization Benchmark**
   - Measure field selection impact
   - Test pagination performance
   - Compare offset vs cursor pagination

4. **Rate Limiting Benchmark**
   - Compare fixed window vs sliding window
   - Test token bucket performance
   - Measure overhead of rate limiting

### Example Results

```
Compression Benchmark:
  Gzip Level 6:     65% reduction, 15ms
  Brotli Level 6:   72% reduction, 18ms
  Brotli Level 11:  78% reduction, 45ms (pre-compress only)

Caching Benchmark:
  Cache Hit:        2ms avg
  Cache Miss:       150ms avg
  Hit Rate:         85%

Payload Optimization:
  Full Payload:     125KB
  Optimized:        32KB (74% reduction)
  Field Selection:  5ms overhead

Rate Limiting:
  Fixed Window:     0.3ms overhead
  Sliding Window:   0.8ms overhead
  Token Bucket:     0.5ms overhead
```

## Production Recommendations

### Infrastructure

1. **Use Redis**: Replace in-memory stores with Redis in production
2. **CDN Integration**: Use CDN for static assets and cached responses
3. **Load Balancing**: Ensure rate limits work across multiple servers
4. **Monitoring**: Implement comprehensive API monitoring

### Configuration

```typescript
// Production configuration
const PRODUCTION_CONFIG = {
  compression: {
    threshold: 1024,
    level: 6,
    preferBrotli: true,
  },

  caching: {
    ttl: 300,
    staleWhileRevalidate: 60,
    tags: true,
  },

  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyGenerator: (req) => getUserId(req),
  },

  payload: {
    defaultLimit: 20,
    maxLimit: 100,
    removeEmpty: true,
    transformDates: true,
  },
}
```

### Monitoring Alerts

Set up alerts for:
- Response time > 500ms (p95)
- Error rate > 1%
- Cache hit rate < 60%
- Rate limit violations > 100/hour per IP

## Troubleshooting

### High Response Times

1. Check cache hit rate
2. Verify database query optimization
3. Review compression level (may be too high)
4. Check for N+1 queries

### Low Cache Hit Rate

1. Verify cache TTL isn't too short
2. Check cache invalidation strategy
3. Review cache key generation
4. Monitor cache storage limits

### Rate Limit Issues

1. Review rate limit configuration
2. Check for legitimate high-volume users
3. Verify key generation strategy
4. Consider implementing tiered limits

### Compression Problems

1. Verify Accept-Encoding header support
2. Check compression threshold
3. Review excluded content types
4. Monitor CPU usage

## Further Reading

- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Content Negotiation (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation)
- [Rate Limiting Algorithms](https://en.wikipedia.org/wiki/Rate_limiting)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
