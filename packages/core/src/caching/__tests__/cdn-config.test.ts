/**
 * CDN Configuration and Cache Management Tests
 */

import { describe, expect, it, vi } from 'vitest'
import {
  CDN_CACHE_PRESETS,
  DEFAULT_CDN_CONFIG,
  generateCacheControl,
  generateCacheTags,
  generateCloudflareConfig,
  generateVercelCacheConfig,
  getCacheTTL,
  purgeAllCache,
  purgeCacheByTag,
  purgeCDNCache,
  shouldCacheResponse,
  warmCDNCache,
} from '../cdn-config'

// ---------------------------------------------------------------------------
// DEFAULT_CDN_CONFIG
// ---------------------------------------------------------------------------

describe('DEFAULT_CDN_CONFIG', () => {
  it('should use vercel as default provider', () => {
    expect(DEFAULT_CDN_CONFIG.provider).toBe('vercel')
  })

  it('should have a 1-year TTL for static assets', () => {
    expect(DEFAULT_CDN_CONFIG.ttl).toBe(31536000)
  })

  it('should have a 1-day stale-while-revalidate window', () => {
    expect(DEFAULT_CDN_CONFIG.staleWhileRevalidate).toBe(86400)
  })

  it('should have a 1-week stale-if-error window', () => {
    expect(DEFAULT_CDN_CONFIG.staleIfError).toBe(604800)
  })

  it('should not bypass cache by default', () => {
    expect(DEFAULT_CDN_CONFIG.bypassCache).toBe(false)
  })

  it('should include standard cache key components', () => {
    expect(DEFAULT_CDN_CONFIG.cacheKey).toEqual([
      'url',
      'headers.accept',
      'headers.accept-encoding',
    ])
  })

  it('should include standard vary headers', () => {
    expect(DEFAULT_CDN_CONFIG.varyHeaders).toEqual(['Accept', 'Accept-Encoding'])
  })
})

// ---------------------------------------------------------------------------
// generateCacheControl
// ---------------------------------------------------------------------------

describe('generateCacheControl', () => {
  it('should return empty string for empty config', () => {
    expect(generateCacheControl({})).toBe('')
  })

  it('should generate no-store directive and return early', () => {
    const result = generateCacheControl({ noStore: true, public: true, maxAge: 3600 })
    expect(result).toBe('no-store')
  })

  it('should generate no-cache directive and return early', () => {
    const result = generateCacheControl({ noCache: true, public: true, maxAge: 3600 })
    expect(result).toBe('no-cache')
  })

  it('should generate public directive', () => {
    const result = generateCacheControl({ public: true })
    expect(result).toBe('public')
  })

  it('should generate private directive', () => {
    const result = generateCacheControl({ private: true })
    expect(result).toBe('private')
  })

  it('should prefer public over private when both are set', () => {
    const result = generateCacheControl({ public: true, private: true })
    expect(result).toBe('public')
  })

  it('should generate max-age directive', () => {
    const result = generateCacheControl({ maxAge: 3600 })
    expect(result).toBe('max-age=3600')
  })

  it('should generate max-age=0', () => {
    const result = generateCacheControl({ maxAge: 0 })
    expect(result).toBe('max-age=0')
  })

  it('should generate s-maxage directive', () => {
    const result = generateCacheControl({ sMaxAge: 86400 })
    expect(result).toBe('s-maxage=86400')
  })

  it('should generate stale-while-revalidate directive', () => {
    const result = generateCacheControl({ staleWhileRevalidate: 60 })
    expect(result).toBe('stale-while-revalidate=60')
  })

  it('should generate stale-if-error directive', () => {
    const result = generateCacheControl({ staleIfError: 300 })
    expect(result).toBe('stale-if-error=300')
  })

  it('should generate immutable directive', () => {
    const result = generateCacheControl({ public: true, immutable: true })
    expect(result).toBe('public, immutable')
  })

  it('should combine multiple directives in correct order', () => {
    const result = generateCacheControl({
      public: true,
      maxAge: 31536000,
      sMaxAge: 31536000,
      staleWhileRevalidate: 86400,
      staleIfError: 604800,
      immutable: true,
    })
    expect(result).toBe(
      'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, stale-if-error=604800, immutable',
    )
  })

  it('should generate private with max-age and stale-while-revalidate', () => {
    const result = generateCacheControl({
      private: true,
      maxAge: 300,
      staleWhileRevalidate: 60,
    })
    expect(result).toBe('private, max-age=300, stale-while-revalidate=60')
  })
})

// ---------------------------------------------------------------------------
// CDN_CACHE_PRESETS
// ---------------------------------------------------------------------------

describe('CDN_CACHE_PRESETS', () => {
  it('should have immutable preset with 1-year TTL', () => {
    expect(CDN_CACHE_PRESETS.immutable.maxAge).toBe(31536000)
    expect(CDN_CACHE_PRESETS.immutable.sMaxAge).toBe(31536000)
    expect(CDN_CACHE_PRESETS.immutable.public).toBe(true)
    expect(CDN_CACHE_PRESETS.immutable.immutable).toBe(true)
  })

  it('should have static preset with 30-day browser TTL and 1-year CDN TTL', () => {
    expect(CDN_CACHE_PRESETS.static.maxAge).toBe(2592000)
    expect(CDN_CACHE_PRESETS.static.sMaxAge).toBe(31536000)
    expect(CDN_CACHE_PRESETS.static.staleWhileRevalidate).toBe(86400)
    expect(CDN_CACHE_PRESETS.static.public).toBe(true)
  })

  it('should have api preset with zero browser TTL and 1-minute CDN TTL', () => {
    expect(CDN_CACHE_PRESETS.api.maxAge).toBe(0)
    expect(CDN_CACHE_PRESETS.api.sMaxAge).toBe(60)
    expect(CDN_CACHE_PRESETS.api.staleWhileRevalidate).toBe(30)
    expect(CDN_CACHE_PRESETS.api.public).toBe(true)
  })

  it('should have page preset with zero browser TTL and 5-minute CDN TTL', () => {
    expect(CDN_CACHE_PRESETS.page.maxAge).toBe(0)
    expect(CDN_CACHE_PRESETS.page.sMaxAge).toBe(300)
    expect(CDN_CACHE_PRESETS.page.staleWhileRevalidate).toBe(60)
    expect(CDN_CACHE_PRESETS.page.public).toBe(true)
  })

  it('should have private preset with 5-minute TTL', () => {
    expect(CDN_CACHE_PRESETS.private.maxAge).toBe(300)
    expect(CDN_CACHE_PRESETS.private.private).toBe(true)
    expect(CDN_CACHE_PRESETS.private.staleWhileRevalidate).toBe(60)
  })

  it('should have noCache preset with no-store', () => {
    expect(CDN_CACHE_PRESETS.noCache.noStore).toBe(true)
  })

  it('should have revalidate preset with no-cache', () => {
    expect(CDN_CACHE_PRESETS.revalidate.noCache).toBe(true)
    expect(CDN_CACHE_PRESETS.revalidate.maxAge).toBe(0)
    expect(CDN_CACHE_PRESETS.revalidate.sMaxAge).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// generateCacheControl with presets (integration)
// ---------------------------------------------------------------------------

describe('generateCacheControl with presets', () => {
  it('should generate correct header for immutable preset', () => {
    const result = generateCacheControl(CDN_CACHE_PRESETS.immutable)
    expect(result).toBe('public, max-age=31536000, s-maxage=31536000, immutable')
  })

  it('should generate correct header for static preset', () => {
    const result = generateCacheControl(CDN_CACHE_PRESETS.static)
    expect(result).toBe('public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=86400')
  })

  it('should generate correct header for api preset', () => {
    const result = generateCacheControl(CDN_CACHE_PRESETS.api)
    expect(result).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=30')
  })

  it('should generate correct header for noCache preset', () => {
    const result = generateCacheControl(CDN_CACHE_PRESETS.noCache)
    expect(result).toBe('no-store')
  })

  it('should generate correct header for revalidate preset', () => {
    // noCache takes priority and returns early
    const result = generateCacheControl(CDN_CACHE_PRESETS.revalidate)
    expect(result).toBe('no-cache')
  })

  it('should generate correct header for private preset', () => {
    const result = generateCacheControl(CDN_CACHE_PRESETS.private)
    expect(result).toBe('private, max-age=300, stale-while-revalidate=60')
  })
})

// ---------------------------------------------------------------------------
// generateCacheTags
// ---------------------------------------------------------------------------

describe('generateCacheTags', () => {
  it('should generate a type tag', () => {
    const tags = generateCacheTags({ type: 'post' })
    expect(tags).toEqual(['post'])
  })

  it('should generate type and id tags', () => {
    const tags = generateCacheTags({ type: 'post', id: '123' })
    expect(tags).toEqual(['post', 'post:123'])
  })

  it('should generate type and numeric id tags', () => {
    const tags = generateCacheTags({ type: 'product', id: 42 })
    expect(tags).toEqual(['product', 'product:42'])
  })

  it('should include related tags', () => {
    const tags = generateCacheTags({
      type: 'post',
      id: '123',
      related: ['category:tech', 'author:1'],
    })
    expect(tags).toEqual(['post', 'post:123', 'category:tech', 'author:1'])
  })

  it('should generate only type tag when id is undefined', () => {
    const tags = generateCacheTags({ type: 'page', related: ['site:main'] })
    expect(tags).toEqual(['page', 'site:main'])
  })

  it('should handle empty related array', () => {
    const tags = generateCacheTags({ type: 'post', id: '1', related: [] })
    expect(tags).toEqual(['post', 'post:1'])
  })
})

// ---------------------------------------------------------------------------
// generateVercelCacheConfig
// ---------------------------------------------------------------------------

describe('generateVercelCacheConfig', () => {
  it('should generate headers for immutable preset', () => {
    const config = generateVercelCacheConfig('immutable')
    const expected = 'public, max-age=31536000, s-maxage=31536000, immutable'
    expect(config.headers['Cache-Control']).toBe(expected)
    expect(config.headers['CDN-Cache-Control']).toBe(expected)
    expect(config.headers['Vercel-CDN-Cache-Control']).toBe(expected)
  })

  it('should generate headers for api preset', () => {
    const config = generateVercelCacheConfig('api')
    const expected = 'public, max-age=0, s-maxage=60, stale-while-revalidate=30'
    expect(config.headers['Cache-Control']).toBe(expected)
    expect(config.headers['CDN-Cache-Control']).toBe(expected)
    expect(config.headers['Vercel-CDN-Cache-Control']).toBe(expected)
  })

  it('should generate headers for noCache preset', () => {
    const config = generateVercelCacheConfig('noCache')
    expect(config.headers['Cache-Control']).toBe('no-store')
  })
})

// ---------------------------------------------------------------------------
// generateCloudflareConfig
// ---------------------------------------------------------------------------

describe('generateCloudflareConfig', () => {
  it('should generate Cache-Control header from preset', () => {
    const config = generateCloudflareConfig('static')
    expect(config.headers['Cache-Control']).toBe(
      'public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=86400',
    )
  })

  it('should include Cache-Tag header when cacheTags are provided', () => {
    const config = generateCloudflareConfig('page', {
      cacheTags: ['post', 'post:123'],
    })
    expect(config.headers['Cache-Tag']).toBe('post,post:123')
  })

  it('should not include Cache-Tag header when cacheTags is empty', () => {
    const config = generateCloudflareConfig('page', { cacheTags: [] })
    expect(config.headers['Cache-Tag']).toBeUndefined()
  })

  it('should append bypass directive when bypassOnCookie is set', () => {
    const config = generateCloudflareConfig('page', {
      bypassOnCookie: 'session_token',
    })
    expect(config.headers['Cache-Control']).toContain('bypass=session_token')
  })

  it('should handle both cacheTags and bypassOnCookie', () => {
    const config = generateCloudflareConfig('api', {
      cacheTags: ['api-v1'],
      bypassOnCookie: 'auth',
    })
    expect(config.headers['Cache-Tag']).toBe('api-v1')
    expect(config.headers['Cache-Control']).toContain('bypass=auth')
  })
})

// ---------------------------------------------------------------------------
// shouldCacheResponse
// ---------------------------------------------------------------------------

describe('shouldCacheResponse', () => {
  it('should return true for 200 with cacheable headers', () => {
    const headers = new Headers({ 'cache-control': 'public, max-age=3600' })
    expect(shouldCacheResponse(200, headers)).toBe(true)
  })

  it('should return true for 200 with no cache-control header', () => {
    const headers = new Headers()
    expect(shouldCacheResponse(200, headers)).toBe(true)
  })

  it('should return false for 4xx status codes', () => {
    const headers = new Headers({ 'cache-control': 'public, max-age=3600' })
    expect(shouldCacheResponse(404, headers)).toBe(false)
  })

  it('should return false for 5xx status codes', () => {
    const headers = new Headers()
    expect(shouldCacheResponse(500, headers)).toBe(false)
  })

  it('should return false when cache-control contains no-store', () => {
    const headers = new Headers({ 'cache-control': 'no-store' })
    expect(shouldCacheResponse(200, headers)).toBe(false)
  })

  it('should return false when cache-control contains no-cache', () => {
    const headers = new Headers({ 'cache-control': 'no-cache' })
    expect(shouldCacheResponse(200, headers)).toBe(false)
  })

  it('should return false when cache-control contains private', () => {
    const headers = new Headers({ 'cache-control': 'private, max-age=300' })
    expect(shouldCacheResponse(200, headers)).toBe(false)
  })

  it('should return true for 301 redirect with public cache', () => {
    const headers = new Headers({ 'cache-control': 'public, max-age=86400' })
    expect(shouldCacheResponse(301, headers)).toBe(true)
  })

  it('should return false for status 400 (boundary)', () => {
    const headers = new Headers()
    expect(shouldCacheResponse(400, headers)).toBe(false)
  })

  it('should return true for status 399 (boundary)', () => {
    const headers = new Headers()
    expect(shouldCacheResponse(399, headers)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getCacheTTL
// ---------------------------------------------------------------------------

describe('getCacheTTL', () => {
  it('should return s-maxage when present', () => {
    const headers = new Headers({
      'cache-control': 'public, max-age=300, s-maxage=3600',
    })
    expect(getCacheTTL(headers)).toBe(3600)
  })

  it('should return max-age when s-maxage is absent', () => {
    const headers = new Headers({ 'cache-control': 'public, max-age=300' })
    expect(getCacheTTL(headers)).toBe(300)
  })

  it('should prefer s-maxage over max-age', () => {
    const headers = new Headers({
      'cache-control': 'max-age=60, s-maxage=600',
    })
    expect(getCacheTTL(headers)).toBe(600)
  })

  it('should return 0 when no cache headers are present', () => {
    const headers = new Headers()
    expect(getCacheTTL(headers)).toBe(0)
  })

  it('should parse Expires header when no cache-control is present', () => {
    const futureDate = new Date(Date.now() + 3600 * 1000)
    const headers = new Headers({ expires: futureDate.toUTCString() })
    const ttl = getCacheTTL(headers)
    // Allow 2-second tolerance for test execution time
    expect(ttl).toBeGreaterThanOrEqual(3598)
    expect(ttl).toBeLessThanOrEqual(3600)
  })

  it('should return 0 for expired Expires header', () => {
    const pastDate = new Date(Date.now() - 3600 * 1000)
    const headers = new Headers({ expires: pastDate.toUTCString() })
    expect(getCacheTTL(headers)).toBe(0)
  })

  it('should return 0 for max-age=0', () => {
    const headers = new Headers({ 'cache-control': 'max-age=0' })
    expect(getCacheTTL(headers)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// purgeCDNCache
// ---------------------------------------------------------------------------

describe('purgeCDNCache', () => {
  it('should throw for unsupported provider', async () => {
    const config = { provider: 'unknown' as 'cloudflare' } as Parameters<typeof purgeCDNCache>[1]
    await expect(purgeCDNCache(['https://example.com'], config)).rejects.toThrow(
      'Unsupported CDN provider',
    )
  })

  it('should throw when cloudflare config is missing apiKey', async () => {
    await expect(
      purgeCDNCache(['https://example.com'], {
        provider: 'cloudflare',
        zoneId: 'zone-123',
      }),
    ).rejects.toThrow('Cloudflare API key and zone ID required')
  })

  it('should throw when cloudflare config is missing zoneId', async () => {
    await expect(
      purgeCDNCache(['https://example.com'], {
        provider: 'cloudflare',
        apiKey: 'key-123',
      }),
    ).rejects.toThrow('Cloudflare API key and zone ID required')
  })

  it('should throw when vercel config is missing apiKey', async () => {
    await expect(purgeCDNCache(['https://example.com'], { provider: 'vercel' })).rejects.toThrow(
      'Vercel API token required',
    )
  })

  it('should throw when fastly config is missing apiKey', async () => {
    await expect(purgeCDNCache(['https://example.com'], { provider: 'fastly' })).rejects.toThrow(
      'Fastly API key required',
    )
  })

  describe('cloudflare purge', () => {
    it('should call cloudflare API and return success', async () => {
      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true, errors: [] }), { status: 200 }),
        )

      const result = await purgeCDNCache(['https://example.com/page'], {
        provider: 'cloudflare',
        apiKey: 'cf-key',
        zoneId: 'zone-1',
      })

      expect(result).toEqual({ success: true, purged: 1, errors: [] })
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ files: ['https://example.com/page'] }),
        }),
      )

      mockFetch.mockRestore()
    })

    it('should handle cloudflare fetch failure gracefully', async () => {
      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('Network timeout'))

      const result = await purgeCDNCache(['https://example.com'], {
        provider: 'cloudflare',
        apiKey: 'cf-key',
        zoneId: 'zone-1',
      })

      expect(result).toEqual({
        success: false,
        purged: 0,
        errors: ['Network timeout'],
      })

      mockFetch.mockRestore()
    })
  })

  describe('vercel purge', () => {
    it('should call vercel API and return success', async () => {
      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))

      const result = await purgeCDNCache(['https://example.com/page'], {
        provider: 'vercel',
        apiKey: 'vercel-token',
      })

      expect(result).toEqual({ success: true, purged: 1, errors: undefined })
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.vercel.com/v1/purge',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ urls: ['https://example.com/page'] }),
        }),
      )

      mockFetch.mockRestore()
    })

    it('should handle vercel API error response', async () => {
      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 }),
        )

      const result = await purgeCDNCache(['https://example.com'], {
        provider: 'vercel',
        apiKey: 'bad-token',
      })

      expect(result).toEqual({
        success: false,
        purged: 1,
        errors: ['Unauthorized'],
      })

      mockFetch.mockRestore()
    })

    it('should handle vercel fetch failure gracefully', async () => {
      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('Connection refused'))

      const result = await purgeCDNCache(['https://example.com'], {
        provider: 'vercel',
        apiKey: 'vercel-token',
      })

      expect(result).toEqual({
        success: false,
        purged: 0,
        errors: ['Connection refused'],
      })

      mockFetch.mockRestore()
    })
  })

  describe('fastly purge', () => {
    it('should purge each URL individually', async () => {
      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('', { status: 200 }))
        .mockResolvedValueOnce(new Response('', { status: 200 }))

      const result = await purgeCDNCache(['https://example.com/a', 'https://example.com/b'], {
        provider: 'fastly',
        apiKey: 'fastly-key',
      })

      expect(result).toEqual({ success: true, purged: 2 })
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/a',
        expect.objectContaining({ method: 'PURGE' }),
      )

      mockFetch.mockRestore()
    })

    it('should report partial failures', async () => {
      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('', { status: 200 }))
        .mockResolvedValueOnce(new Response('', { status: 500 }))

      const result = await purgeCDNCache(['https://example.com/a', 'https://example.com/b'], {
        provider: 'fastly',
        apiKey: 'fastly-key',
      })

      expect(result.success).toBe(false)
      expect(result.purged).toBe(1)

      mockFetch.mockRestore()
    })

    it('should handle fastly fetch failure gracefully', async () => {
      const mockFetch = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('DNS failure'))

      const result = await purgeCDNCache(['https://example.com'], {
        provider: 'fastly',
        apiKey: 'fastly-key',
      })

      expect(result).toEqual({
        success: false,
        purged: 0,
        errors: ['DNS failure'],
      })

      mockFetch.mockRestore()
    })
  })
})

// ---------------------------------------------------------------------------
// purgeCacheByTag
// ---------------------------------------------------------------------------

describe('purgeCacheByTag', () => {
  it('should purge cloudflare cache by tags', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, errors: [] }), { status: 200 }),
      )

    const result = await purgeCacheByTag(['post', 'post:123'], {
      provider: 'cloudflare',
      apiKey: 'cf-key',
      zoneId: 'zone-1',
    })

    expect(result).toEqual({ success: true, purged: 2, errors: [] })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache',
      expect.objectContaining({
        body: JSON.stringify({ tags: ['post', 'post:123'] }),
      }),
    )

    mockFetch.mockRestore()
  })

  it('should throw for missing cloudflare credentials', async () => {
    await expect(purgeCacheByTag(['post'], { provider: 'cloudflare' })).rejects.toThrow(
      'Cloudflare API key and zone ID required',
    )
  })

  it('should throw for unsupported providers', async () => {
    await expect(purgeCacheByTag(['post'], { provider: 'vercel', apiKey: 'key' })).rejects.toThrow(
      'Cache tag purging not supported for vercel',
    )
  })

  it('should throw for fastly provider', async () => {
    await expect(purgeCacheByTag(['post'], { provider: 'fastly', apiKey: 'key' })).rejects.toThrow(
      'Cache tag purging not supported for fastly',
    )
  })

  it('should handle cloudflare tag purge fetch failure', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Timeout'))

    const result = await purgeCacheByTag(['post'], {
      provider: 'cloudflare',
      apiKey: 'cf-key',
      zoneId: 'zone-1',
    })

    expect(result).toEqual({
      success: false,
      purged: 0,
      errors: ['Timeout'],
    })

    mockFetch.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// purgeAllCache
// ---------------------------------------------------------------------------

describe('purgeAllCache', () => {
  it('should purge everything on cloudflare', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, errors: [] }), { status: 200 }),
      )

    const result = await purgeAllCache({
      provider: 'cloudflare',
      apiKey: 'cf-key',
      zoneId: 'zone-1',
    })

    expect(result).toEqual({ success: true, errors: [] })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache',
      expect.objectContaining({
        body: JSON.stringify({ purge_everything: true }),
      }),
    )

    mockFetch.mockRestore()
  })

  it('should throw for missing cloudflare credentials', async () => {
    await expect(purgeAllCache({ provider: 'cloudflare' })).rejects.toThrow(
      'Cloudflare API key and zone ID required',
    )
  })

  it('should throw for unsupported providers', async () => {
    await expect(purgeAllCache({ provider: 'vercel', apiKey: 'key' })).rejects.toThrow(
      'Purge all not supported for vercel',
    )
  })

  it('should handle fetch failure gracefully', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Server error'))

    const result = await purgeAllCache({
      provider: 'cloudflare',
      apiKey: 'cf-key',
      zoneId: 'zone-1',
    })

    expect(result).toEqual({
      success: false,
      errors: ['Server error'],
    })

    mockFetch.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// warmCDNCache
// ---------------------------------------------------------------------------

describe('warmCDNCache', () => {
  it('should warm cache for all URLs', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }))

    const result = await warmCDNCache(['https://example.com/a', 'https://example.com/b'])

    expect(result.warmed).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.errors).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(2)

    mockFetch.mockRestore()
  })

  it('should report failed URL warming', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Internal Server Error' }))

    const result = await warmCDNCache(['https://example.com/a', 'https://example.com/b'])

    expect(result.warmed).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.errors).toEqual(['500 Internal Server Error'])

    mockFetch.mockRestore()
  })

  it('should handle fetch errors during warming', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Connection failed'))

    const result = await warmCDNCache(['https://example.com/a'])

    expect(result.warmed).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.errors).toEqual(['Connection failed'])

    mockFetch.mockRestore()
  })

  it('should respect concurrency option', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      // Simulate a tiny delay so concurrent requests overlap
      await new Promise((resolve) => setTimeout(resolve, 10))
      concurrent--
      return new Response('', { status: 200 })
    })

    // 6 URLs with concurrency 2 should process in 3 batches
    await warmCDNCache(
      Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`),
      { concurrency: 2 },
    )

    expect(maxConcurrent).toBeLessThanOrEqual(2)

    mockFetch.mockRestore()
  })

  it('should pass custom headers during warming', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }))

    await warmCDNCache(['https://example.com/a'], {
      headers: { 'X-Custom': 'test-value' },
    })

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/a', {
      headers: { 'X-Custom': 'test-value' },
    })

    mockFetch.mockRestore()
  })

  it('should handle empty URL list', async () => {
    const result = await warmCDNCache([])
    expect(result).toEqual({ warmed: 0, failed: 0, errors: [] })
  })

  it('should use default concurrency of 5', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((resolve) => setTimeout(resolve, 10))
      concurrent--
      return new Response('', { status: 200 })
    })

    await warmCDNCache(Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`))

    expect(maxConcurrent).toBeLessThanOrEqual(5)

    mockFetch.mockRestore()
  })
})
