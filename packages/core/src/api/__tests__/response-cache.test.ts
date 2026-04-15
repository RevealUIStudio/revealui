import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('../../observability/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  CACHE_PRESETS,
  cacheAPIResponse,
  checkETag,
  clearCache,
  generateCacheKey,
  getCachedResponse,
  getCacheStats,
  invalidateCacheKey,
  invalidateCachePattern,
  invalidateCacheTags,
  purgeExpiredCache,
  setCachedResponse,
  setCacheHeaders,
  withETag,
} from '../response-cache.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRequest(
  url = 'http://localhost/api/test',
  headers?: Record<string, string>,
  method = 'GET',
) {
  return new Request(url, { method, headers });
}

function createResponse(body = '{"ok":true}', status = 200, headers?: Record<string, string>) {
  return new Response(body, { status, headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('response-cache module', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    clearCache();
  });

  describe('generateCacheKey', () => {
    it('generates key from method + path', () => {
      const req = createRequest('http://localhost/api/users');
      const key = generateCacheKey(req);

      expect(key).toContain('GET');
      expect(key).toContain('/api/users');
    });

    it('includes query string', () => {
      const req = createRequest('http://localhost/api/users?page=2&limit=10');
      const key = generateCacheKey(req);

      expect(key).toContain('page=2');
      expect(key).toContain('limit=10');
    });

    it('includes auth hash when authorization header present', () => {
      const req = createRequest('http://localhost/api/users', {
        authorization: 'Bearer token123',
      });
      const key = generateCacheKey(req);

      // Key should be longer (includes auth hash)
      const keyWithoutAuth = generateCacheKey(createRequest('http://localhost/api/users'));
      expect(key.length).toBeGreaterThan(keyWithoutAuth.length);
    });

    it('produces different keys for different paths', () => {
      const k1 = generateCacheKey(createRequest('http://localhost/api/users'));
      const k2 = generateCacheKey(createRequest('http://localhost/api/posts'));

      expect(k1).not.toBe(k2);
    });
  });

  describe('setCachedResponse + getCachedResponse', () => {
    it('caches and retrieves GET responses', async () => {
      const req = createRequest();
      const res = createResponse('{"data":"hello"}');

      await setCachedResponse(req, res);
      const cached = await getCachedResponse(req);

      expect(cached).not.toBeNull();
      expect(cached?.status).toBe(200);
      expect(cached?.headers.get('X-Cache')).toBe('HIT');
    });

    it('returns null for cache miss', async () => {
      const req = createRequest();
      const cached = await getCachedResponse(req);

      expect(cached).toBeNull();
    });

    it('does not cache POST requests', async () => {
      const req = createRequest('http://localhost/api/test', undefined, 'POST');
      const res = createResponse();

      await setCachedResponse(req, res);
      const cached = await getCachedResponse(req);

      expect(cached).toBeNull();
    });

    it('does not cache error responses', async () => {
      const req = createRequest();
      const res = createResponse('{"error":"not found"}', 404);

      await setCachedResponse(req, res);
      const cached = await getCachedResponse(req);

      expect(cached).toBeNull();
    });

    it('does not cache when response has no-store', async () => {
      const req = createRequest();
      const res = createResponse('{}', 200, { 'cache-control': 'no-store' });

      await setCachedResponse(req, res);
      const cached = await getCachedResponse(req);

      expect(cached).toBeNull();
    });

    it('expires entries after TTL', async () => {
      vi.useFakeTimers();
      try {
        const req = createRequest();
        const res = createResponse();

        await setCachedResponse(req, res, { ttl: 60 });

        // Advance past TTL
        vi.advanceTimersByTime(61_000);

        const cached = await getCachedResponse(req);
        expect(cached).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('includes Age header', async () => {
      const req = createRequest();
      const res = createResponse();

      await setCachedResponse(req, res, { ttl: 300 });
      const cached = await getCachedResponse(req);

      expect(cached?.headers.get('Age')).toBeDefined();
    });
  });

  describe('invalidation', () => {
    it('invalidateCacheKey removes specific key', async () => {
      const req = createRequest();
      const res = createResponse();

      await setCachedResponse(req, res);
      const key = generateCacheKey(req);
      invalidateCacheKey(key);

      const cached = await getCachedResponse(req);
      expect(cached).toBeNull();
    });

    it('invalidateCachePattern removes matching keys', async () => {
      const req1 = createRequest('http://localhost/api/users');
      const req2 = createRequest('http://localhost/api/users/123');
      const req3 = createRequest('http://localhost/api/posts');

      await setCachedResponse(req1, createResponse());
      await setCachedResponse(req2, createResponse());
      await setCachedResponse(req3, createResponse());

      const removed = invalidateCachePattern('*/api/users*');
      expect(removed).toBe(2);

      expect(await getCachedResponse(req3)).not.toBeNull();
    });

    it('invalidateCacheTags removes entries with matching tags', async () => {
      const req1 = createRequest('http://localhost/api/users');
      const req2 = createRequest('http://localhost/api/posts');

      await setCachedResponse(req1, createResponse(), { tags: ['users'] });
      await setCachedResponse(req2, createResponse(), { tags: ['posts'] });

      const removed = invalidateCacheTags(['users']);
      expect(removed).toBe(1);

      expect(await getCachedResponse(req1)).toBeNull();
      expect(await getCachedResponse(req2)).not.toBeNull();
    });

    it('clearCache removes everything', async () => {
      const req1 = createRequest('http://localhost/api/a');
      const req2 = createRequest('http://localhost/api/b');

      await setCachedResponse(req1, createResponse());
      await setCachedResponse(req2, createResponse());

      clearCache();

      expect(await getCachedResponse(req1)).toBeNull();
      expect(await getCachedResponse(req2)).toBeNull();
    });
  });

  describe('purgeExpiredCache', () => {
    it('removes expired entries', async () => {
      vi.useFakeTimers();
      try {
        const req = createRequest();
        const res = createResponse();

        await setCachedResponse(req, res, { ttl: 60 });

        vi.advanceTimersByTime(61_000);

        const purged = purgeExpiredCache();
        expect(purged).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns 0 when nothing expired', () => {
      const purged = purgeExpiredCache();
      expect(purged).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('returns zeros when empty', () => {
      const stats = getCacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.validEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
    });

    it('counts valid entries', async () => {
      await setCachedResponse(createRequest('http://localhost/a'), createResponse(), { ttl: 300 });
      await setCachedResponse(createRequest('http://localhost/b'), createResponse(), { ttl: 300 });

      const stats = getCacheStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.validEntries).toBe(2);
    });
  });

  describe('setCacheHeaders', () => {
    it('sets public max-age by default', () => {
      const res = createResponse();
      setCacheHeaders(res, { ttl: 600 });

      const cc = res.headers.get('Cache-Control');
      expect(cc).toContain('public');
      expect(cc).toContain('max-age=600');
    });

    it('sets private when specified', () => {
      const res = createResponse();
      setCacheHeaders(res, { ttl: 300, private: true });

      expect(res.headers.get('Cache-Control')).toContain('private');
    });

    it('sets no-store when noStore is true', () => {
      const res = createResponse();
      setCacheHeaders(res, { noStore: true });

      expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('includes stale-while-revalidate', () => {
      const res = createResponse();
      setCacheHeaders(res, { ttl: 300, staleWhileRevalidate: 60 });

      expect(res.headers.get('Cache-Control')).toContain('stale-while-revalidate=60');
    });

    it('sets Vary header', () => {
      const res = createResponse();
      setCacheHeaders(res, { ttl: 300, vary: ['Accept-Encoding', 'Authorization'] });

      expect(res.headers.get('Vary')).toBe('Accept-Encoding, Authorization');
    });
  });

  describe('ETag support', () => {
    it('withETag sets ETag header', () => {
      const res = createResponse();
      withETag(res, 'some content');

      expect(res.headers.get('ETag')).toBeTruthy();
      expect(res.headers.get('ETag')).toMatch(/^".*"$/);
    });

    it('checkETag returns true for matching tags', () => {
      const req = createRequest('http://localhost/api/test', {
        'if-none-match': '"abc123"',
      });

      expect(checkETag(req, '"abc123"')).toBe(true);
    });

    it('checkETag returns false for non-matching tags', () => {
      const req = createRequest('http://localhost/api/test', {
        'if-none-match': '"abc123"',
      });

      expect(checkETag(req, '"different"')).toBe(false);
    });
  });

  describe('cacheAPIResponse', () => {
    it('returns fresh data on first call', async () => {
      const result = await cacheAPIResponse('test', async () => ({ items: [1, 2, 3] }));

      expect(result.cached).toBe(false);
      expect(result.data.items).toEqual([1, 2, 3]);
    });

    it('returns cached data on second call', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return { count: callCount };
      };

      const r1 = await cacheAPIResponse('same-key', fn, { ttl: 300 });
      const r2 = await cacheAPIResponse('same-key', fn, { ttl: 300 });

      expect(r1.cached).toBe(false);
      expect(r2.cached).toBe(true);
      expect(r2.data.count).toBe(1); // Same data as first call
      expect(callCount).toBe(1); // Only called once
    });

    it('refreshes after TTL expires', async () => {
      vi.useFakeTimers();
      try {
        let callCount = 0;
        const fn = async () => {
          callCount++;
          return { count: callCount };
        };

        await cacheAPIResponse('expire-key', fn, { ttl: 60 });

        vi.advanceTimersByTime(61_000);

        const r2 = await cacheAPIResponse('expire-key', fn, { ttl: 60 });

        expect(r2.cached).toBe(false);
        expect(callCount).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('CACHE_PRESETS', () => {
    it('has expected presets', () => {
      expect(CACHE_PRESETS.noCache.noStore).toBe(true);
      expect(CACHE_PRESETS.short.ttl).toBe(60);
      expect(CACHE_PRESETS.medium.ttl).toBe(300);
      expect(CACHE_PRESETS.long.ttl).toBe(3600);
      expect(CACHE_PRESETS.immutable.ttl).toBe(31536000);
    });
  });
});
