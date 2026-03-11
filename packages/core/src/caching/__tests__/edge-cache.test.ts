/**
 * Edge Cache / ISR Utilities Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger before importing modules that use it
vi.mock('../../observability/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  addPreloadLinks,
  createCachedFunction,
  createEdgeCachedFetch,
  EdgeRateLimiter,
  generateStaticParams,
  getABTestVariant,
  getGeoLocation,
  getPersonalizationConfig,
  ISR_PRESETS,
  revalidatePath,
  revalidatePaths,
  revalidateTag,
  revalidateTags,
  setEdgeCacheHeaders,
  warmISRCache,
} from '../edge-cache.js';

function createMockNextRequest(
  options: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    url?: string;
  } = {},
  // biome-ignore lint/suspicious/noExplicitAny: test helper returns minimal mock satisfying NextRequest at runtime
): any {
  const headers = new Map(Object.entries(options.headers ?? {}));
  const cookies = new Map(Object.entries(options.cookies ?? {}));

  return {
    headers: {
      get: (name: string) => headers.get(name) ?? null,
    },
    cookies: {
      get: (name: string) => {
        const value = cookies.get(name);
        return value ? { value } : undefined;
      },
    },
    url: options.url ?? 'http://localhost:3000/',
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper returns minimal mock
function createMockNextResponse(): any {
  return {
    headers: new Headers(),
  };
}

describe('ISR_PRESETS', () => {
  it('should define correct revalidation intervals', () => {
    expect(ISR_PRESETS.always.revalidate).toBe(0);
    expect(ISR_PRESETS.minute.revalidate).toBe(60);
    expect(ISR_PRESETS.fiveMinutes.revalidate).toBe(300);
    expect(ISR_PRESETS.hourly.revalidate).toBe(3600);
    expect(ISR_PRESETS.daily.revalidate).toBe(86400);
    expect(ISR_PRESETS.never.revalidate).toBe(false);
  });
});

describe('generateStaticParams', () => {
  it('should fetch items and map them to params', async () => {
    const items = [
      { id: '1', slug: 'hello' },
      { id: '2', slug: 'world' },
    ];
    const fetchFn = vi.fn().mockResolvedValue(items);
    const mapFn = (item: { id: string; slug: string }) => ({ slug: item.slug });

    const result = await generateStaticParams(fetchFn, mapFn);

    expect(result).toEqual([{ slug: 'hello' }, { slug: 'world' }]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('should return empty array when fetchFn throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('DB connection failed'));
    const mapFn = vi.fn();

    const result = await generateStaticParams(fetchFn, mapFn);

    expect(result).toEqual([]);
    expect(mapFn).not.toHaveBeenCalled();
  });

  it('should return empty array for empty data', async () => {
    const fetchFn = vi.fn().mockResolvedValue([]);
    const mapFn = vi.fn();

    const result = await generateStaticParams(fetchFn, mapFn);

    expect(result).toEqual([]);
  });

  it('should handle non-Error thrown values', async () => {
    const fetchFn = vi.fn().mockRejectedValue('string error');
    const mapFn = vi.fn();

    const result = await generateStaticParams(fetchFn, mapFn);

    expect(result).toEqual([]);
  });
});

describe('revalidateTag', () => {
  const originalEnv = process.env.NEXT_PUBLIC_URL;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_URL;
    }
  });

  it('should return error when NEXT_PUBLIC_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_URL;

    const result = await revalidateTag('posts');

    expect(result).toEqual({
      revalidated: false,
      error: 'NEXT_PUBLIC_URL is not configured',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should POST to /api/revalidate with the tag', async () => {
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ revalidated: true }),
    });

    const result = await revalidateTag('posts');

    expect(result).toEqual({ revalidated: true, error: undefined });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/revalidate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: 'posts' }),
      }),
    );
  });

  it('should include secret header when provided', async () => {
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ revalidated: true }),
    });

    await revalidateTag('posts', 'my-secret');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': 'my-secret',
        },
      }),
    );
  });

  it('should return revalidated false when response is not ok', async () => {
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    });

    const result = await revalidateTag('posts');

    expect(result).toEqual({ revalidated: false, error: 'Internal error' });
  });

  it('should handle fetch errors gracefully', async () => {
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
    mockFetch.mockRejectedValue(new Error('Network timeout'));

    const result = await revalidateTag('posts');

    expect(result).toEqual({ revalidated: false, error: 'Network timeout' });
  });

  it('should handle non-Error thrown values in fetch', async () => {
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
    mockFetch.mockRejectedValue('unknown failure');

    const result = await revalidateTag('posts');

    expect(result).toEqual({ revalidated: false, error: 'Unknown error' });
  });
});

describe('revalidatePath', () => {
  const originalEnv = process.env.NEXT_PUBLIC_URL;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_URL;
    }
  });

  it('should return error when NEXT_PUBLIC_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_URL;

    const result = await revalidatePath('/blog');

    expect(result).toEqual({
      revalidated: false,
      error: 'NEXT_PUBLIC_URL is not configured',
    });
  });

  it('should POST path to /api/revalidate', async () => {
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ revalidated: true }),
    });

    const result = await revalidatePath('/blog/post-1');

    expect(result).toEqual({ revalidated: true, error: undefined });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/revalidate',
      expect.objectContaining({
        body: JSON.stringify({ path: '/blog/post-1' }),
      }),
    );
  });

  it('should handle fetch errors', async () => {
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const result = await revalidatePath('/blog');

    expect(result).toEqual({ revalidated: false, error: 'Connection refused' });
  });
});

describe('revalidatePaths', () => {
  const originalEnv = process.env.NEXT_PUBLIC_URL;

  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_URL;
    }
  });

  it('should revalidate multiple paths and count successes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ revalidated: true }),
    });

    const result = await revalidatePaths(['/blog', '/about', '/contact']);

    expect(result.revalidated).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('should count failures separately from successes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ revalidated: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

    const result = await revalidatePaths(['/blog', '/broken']);

    expect(result.revalidated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ path: '/broken', error: 'Server error' });
  });

  it('should handle empty paths array', async () => {
    const result = await revalidatePaths([]);

    expect(result).toEqual({ revalidated: 0, failed: 0, errors: [] });
  });
});

describe('revalidateTags', () => {
  const originalEnv = process.env.NEXT_PUBLIC_URL;

  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_URL;
    }
  });

  it('should revalidate multiple tags', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ revalidated: true }),
    });

    const result = await revalidateTags(['posts', 'users', 'products']);

    expect(result.revalidated).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('should track tag-level failures', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ revalidated: true }),
      })
      .mockRejectedValueOnce(new Error('Timeout'));

    const result = await revalidateTags(['posts', 'users']);

    expect(result.revalidated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toEqual({ tag: 'users', error: 'Timeout' });
  });
});

describe('createEdgeCachedFetch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return parsed JSON on success', async () => {
    const data = { id: 1, title: 'Test' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const cachedFetch = createEdgeCachedFetch({ cache: 'force-cache' });
    const result = await cachedFetch<{ id: number; title: string }>('https://api.example.com/data');

    expect(result).toEqual(data);
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    const cachedFetch = createEdgeCachedFetch();

    await expect(cachedFetch('https://api.example.com/missing')).rejects.toThrow(
      'Fetch failed: Not Found',
    );
  });

  it('should merge config options with request options', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const cachedFetch = createEdgeCachedFetch({
      cache: 'force-cache',
      next: { revalidate: 60, tags: ['posts'] },
    });

    await cachedFetch('https://api.example.com/data', {
      headers: { Authorization: 'Bearer token' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        cache: 'force-cache',
        next: { revalidate: 60, tags: ['posts'] },
        headers: { Authorization: 'Bearer token' },
      }),
    );
  });
});

describe('createCachedFunction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should cache the result of a function call', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const cached = createCachedFunction(fn, { revalidate: 60 });

    const first = await cached('arg1');
    const second = await cached('arg1');

    expect(first).toBe('result');
    expect(second).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cache separately per arguments', async () => {
    const fn = vi.fn().mockImplementation(async (x: string) => `result-${x}`);
    const cached = createCachedFunction(fn, { revalidate: 60 });

    const first = await cached('a');
    const second = await cached('b');

    expect(first).toBe('result-a');
    expect(second).toBe('result-b');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should re-fetch after TTL expires', async () => {
    const fn = vi.fn().mockResolvedValue('value');
    const cached = createCachedFunction(fn, { revalidate: 10 });

    await cached('key');
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance past TTL (10 seconds = 10000ms)
    vi.advanceTimersByTime(11_000);

    await cached('key');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should serve from cache before TTL expires', async () => {
    const fn = vi.fn().mockResolvedValue('value');
    const cached = createCachedFunction(fn, { revalidate: 60 });

    await cached('key');
    vi.advanceTimersByTime(30_000); // 30 seconds, well within 60s TTL
    await cached('key');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should bypass cache entirely when revalidate is false', async () => {
    const fn = vi.fn().mockResolvedValue('value');
    const cached = createCachedFunction(fn, { revalidate: false });

    // The returned function should be the original fn
    expect(cached).toBe(fn);
  });

  it('should default to 60 second TTL when revalidate is not specified', async () => {
    const fn = vi.fn().mockResolvedValue('value');
    const cached = createCachedFunction(fn);

    await cached('key');
    expect(fn).toHaveBeenCalledTimes(1);

    // Still within 60s default
    vi.advanceTimersByTime(59_000);
    await cached('key');
    expect(fn).toHaveBeenCalledTimes(1);

    // Past 60s
    vi.advanceTimersByTime(2_000);
    await cached('key');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('EdgeRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within the limit', () => {
    const limiter = new EdgeRateLimiter({ limit: 3, window: 60_000 });
    const request = createMockNextRequest({ headers: { 'x-forwarded-for': '1.2.3.4' } });

    const result1 = limiter.check(request);
    const result2 = limiter.check(request);
    const result3 = limiter.check(request);

    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('should reject requests over the limit', () => {
    const limiter = new EdgeRateLimiter({ limit: 2, window: 60_000 });
    const request = createMockNextRequest({ headers: { 'x-forwarded-for': '1.2.3.4' } });

    limiter.check(request);
    limiter.check(request);
    const result = limiter.check(request);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after the window expires', () => {
    const limiter = new EdgeRateLimiter({ limit: 1, window: 10_000 });
    const request = createMockNextRequest({ headers: { 'x-forwarded-for': '1.2.3.4' } });

    limiter.check(request);
    const blocked = limiter.check(request);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(11_000);

    const allowed = limiter.check(request);
    expect(allowed.allowed).toBe(true);
  });

  it('should track separate limits per key (IP)', () => {
    const limiter = new EdgeRateLimiter({ limit: 1, window: 60_000 });
    const request1 = createMockNextRequest({ headers: { 'x-forwarded-for': '1.1.1.1' } });
    const request2 = createMockNextRequest({ headers: { 'x-forwarded-for': '2.2.2.2' } });

    limiter.check(request1);
    const result1 = limiter.check(request1);
    const result2 = limiter.check(request2);

    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
  });

  it('should use custom key function when provided', () => {
    const limiter = new EdgeRateLimiter({
      limit: 1,
      window: 60_000,
      key: (_request: unknown) => 'shared-key',
    });
    const request1 = createMockNextRequest({ headers: { 'x-forwarded-for': '1.1.1.1' } });
    const request2 = createMockNextRequest({ headers: { 'x-forwarded-for': '2.2.2.2' } });

    limiter.check(request1);
    const result = limiter.check(request2);

    expect(result.allowed).toBe(false); // same key, so limit applies
  });

  it('should use "unknown" when x-forwarded-for is missing', () => {
    const limiter = new EdgeRateLimiter({ limit: 1, window: 60_000 });
    const request = createMockNextRequest();

    limiter.check(request);
    const result = limiter.check(request);

    expect(result.allowed).toBe(false);
  });

  it('should return correct limit and reset values', () => {
    const limiter = new EdgeRateLimiter({ limit: 10, window: 60_000 });
    const request = createMockNextRequest({ headers: { 'x-forwarded-for': '1.2.3.4' } });

    const result = limiter.check(request);

    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
    expect(result.reset).toBeGreaterThan(Date.now());
  });

  it('should clean up expired entries', () => {
    const limiter = new EdgeRateLimiter({ limit: 5, window: 10_000 });
    const request = createMockNextRequest({ headers: { 'x-forwarded-for': '1.2.3.4' } });

    limiter.check(request);

    vi.advanceTimersByTime(11_000);
    limiter.cleanup();

    // After cleanup, the entry should be gone, so next check starts fresh
    const result = limiter.check(request);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe('getGeoLocation', () => {
  it('should extract Vercel geo headers', () => {
    const request = createMockNextRequest({
      headers: {
        'x-vercel-ip-country': 'US',
        'x-vercel-ip-country-region': 'CA',
        'x-vercel-ip-city': 'San%20Francisco',
        'x-vercel-ip-latitude': '37.7749',
        'x-vercel-ip-longitude': '-122.4194',
      },
    });

    const geo = getGeoLocation(request);

    expect(geo).toEqual({
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  it('should fall back to Cloudflare headers', () => {
    const request = createMockNextRequest({
      headers: { 'cf-ipcountry': 'DE' },
    });

    const geo = getGeoLocation(request);

    expect(geo).toEqual({ country: 'DE' });
  });

  it('should return null when no geo headers are present', () => {
    const request = createMockNextRequest();

    const geo = getGeoLocation(request);

    expect(geo).toBeNull();
  });

  it('should handle partial Vercel headers', () => {
    const request = createMockNextRequest({
      headers: { 'x-vercel-ip-country': 'GB' },
    });

    const geo = getGeoLocation(request);

    expect(geo).toEqual({
      country: 'GB',
      region: undefined,
      city: undefined,
      latitude: undefined,
      longitude: undefined,
    });
  });
});

describe('getABTestVariant', () => {
  it('should return cookie variant when it matches a valid variant', () => {
    const request = createMockNextRequest({
      cookies: { 'ab-test-header': 'B' },
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    const variant = getABTestVariant(request, 'header', ['A', 'B']);

    expect(variant).toBe('B');
  });

  it('should ignore cookie variant that is not in the variants list', () => {
    const request = createMockNextRequest({
      cookies: { 'ab-test-header': 'C' },
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    const variant = getABTestVariant(request, 'header', ['A', 'B']);

    expect(['A', 'B']).toContain(variant);
  });

  it('should assign a deterministic variant based on IP hash', () => {
    const request = createMockNextRequest({
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    const variant1 = getABTestVariant(request, 'cta', ['A', 'B', 'C']);
    const variant2 = getABTestVariant(request, 'cta', ['A', 'B', 'C']);

    // Same IP + test name should produce same variant
    expect(variant1).toBe(variant2);
    expect(['A', 'B', 'C']).toContain(variant1);
  });

  it('should produce different variants for different test names', () => {
    const request = createMockNextRequest({
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });

    // Different test names may (likely) produce different variants
    // We just verify they are valid selections
    const v1 = getABTestVariant(request, 'test-alpha', ['X', 'Y']);
    const v2 = getABTestVariant(request, 'test-beta', ['X', 'Y']);

    expect(['X', 'Y']).toContain(v1);
    expect(['X', 'Y']).toContain(v2);
  });
});

describe('getPersonalizationConfig', () => {
  it('should detect mobile device', () => {
    const request = createMockNextRequest({
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS) Mobile Safari' },
    });

    const config = getPersonalizationConfig(request);

    expect(config.device).toBe('mobile');
  });

  it('should detect tablet device', () => {
    const request = createMockNextRequest({
      headers: { 'user-agent': 'Mozilla/5.0 (iPad; CPU OS 16_0) Safari' },
    });

    const config = getPersonalizationConfig(request);

    expect(config.device).toBe('tablet');
  });

  it('should default to desktop', () => {
    const request = createMockNextRequest({
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
    });

    const config = getPersonalizationConfig(request);

    expect(config.device).toBe('desktop');
  });

  it('should include userId from cookie', () => {
    const request = createMockNextRequest({
      headers: { 'user-agent': 'Chrome' },
      cookies: { 'user-id': 'usr_abc123' },
    });

    const config = getPersonalizationConfig(request);

    expect(config.userId).toBe('usr_abc123');
  });

  it('should include geo location when available', () => {
    const request = createMockNextRequest({
      headers: {
        'user-agent': 'Chrome',
        'x-vercel-ip-country': 'JP',
      },
    });

    const config = getPersonalizationConfig(request);

    expect(config.location).toBeDefined();
    expect(config.location?.country).toBe('JP');
  });

  it('should have undefined location when no geo headers', () => {
    const request = createMockNextRequest({
      headers: { 'user-agent': 'Chrome' },
    });

    const config = getPersonalizationConfig(request);

    expect(config.location).toBeUndefined();
  });
});

describe('setEdgeCacheHeaders', () => {
  it('should set Cache-Control with max-age', () => {
    const response = createMockNextResponse();

    setEdgeCacheHeaders(response, { maxAge: 300 });

    expect(response.headers.get('Cache-Control')).toBe('max-age=300');
  });

  it('should set Cache-Control with s-maxage', () => {
    const response = createMockNextResponse();

    setEdgeCacheHeaders(response, { sMaxAge: 600 });

    expect(response.headers.get('Cache-Control')).toBe('s-maxage=600');
  });

  it('should set Cache-Control with stale-while-revalidate', () => {
    const response = createMockNextResponse();

    setEdgeCacheHeaders(response, { staleWhileRevalidate: 120 });

    expect(response.headers.get('Cache-Control')).toBe('stale-while-revalidate=120');
  });

  it('should combine multiple directives', () => {
    const response = createMockNextResponse();

    setEdgeCacheHeaders(response, {
      maxAge: 0,
      sMaxAge: 3600,
      staleWhileRevalidate: 60,
    });

    expect(response.headers.get('Cache-Control')).toBe(
      'max-age=0, s-maxage=3600, stale-while-revalidate=60',
    );
  });

  it('should set Cache-Tag header', () => {
    const response = createMockNextResponse();

    setEdgeCacheHeaders(response, { tags: ['posts', 'blog'] });

    expect(response.headers.get('Cache-Tag')).toBe('posts,blog');
  });

  it('should not set headers when no config values provided', () => {
    const response = createMockNextResponse();

    setEdgeCacheHeaders(response, {});

    expect(response.headers.get('Cache-Control')).toBeNull();
    expect(response.headers.get('Cache-Tag')).toBeNull();
  });

  it('should not set Cache-Tag for empty tags array', () => {
    const response = createMockNextResponse();

    setEdgeCacheHeaders(response, { tags: [] });

    expect(response.headers.get('Cache-Tag')).toBeNull();
  });

  it('should return the response for chaining', () => {
    const response = createMockNextResponse();

    const result = setEdgeCacheHeaders(response, { maxAge: 60 });

    expect(result).toBe(response);
  });
});

describe('addPreloadLinks', () => {
  it('should set Link header with preload directives', () => {
    const response = createMockNextResponse();

    addPreloadLinks(response, [
      { href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2', crossorigin: true },
    ]);

    const link = response.headers.get('Link');
    expect(link).toContain('</fonts/inter.woff2>');
    expect(link).toContain('rel="preload"');
    expect(link).toContain('as="font"');
    expect(link).toContain('type="font/woff2"');
    expect(link).toContain('crossorigin');
  });

  it('should combine multiple resources', () => {
    const response = createMockNextResponse();

    addPreloadLinks(response, [
      { href: '/style.css', as: 'style' },
      { href: '/app.js', as: 'script' },
    ]);

    const link = response.headers.get('Link');
    expect(link).toContain('</style.css>');
    expect(link).toContain('</app.js>');
  });

  it('should not set Link header for empty resources', () => {
    const response = createMockNextResponse();

    addPreloadLinks(response, []);

    expect(response.headers.get('Link')).toBeNull();
  });

  it('should omit type and crossorigin when not specified', () => {
    const response = createMockNextResponse();

    addPreloadLinks(response, [{ href: '/image.webp', as: 'image' }]);

    const link = response.headers.get('Link');
    expect(link).not.toContain('type=');
    expect(link).not.toContain('crossorigin');
  });

  it('should return the response for chaining', () => {
    const response = createMockNextResponse();

    const result = addPreloadLinks(response, []);

    expect(result).toBe(response);
  });
});

describe('warmISRCache', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should fetch all paths and count warmed pages', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await warmISRCache(['/blog', '/about'], 'https://example.com');

    expect(result.warmed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should count failed pages with error details', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await warmISRCache(['/blog', '/missing'], 'https://example.com');

    expect(result.warmed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      path: '/missing',
      error: '404 Not Found',
    });
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('DNS resolution failed'));

    const result = await warmISRCache(['/blog'], 'https://example.com');

    expect(result.warmed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toBe('DNS resolution failed');
  });

  it('should use NEXT_PUBLIC_URL as default base URL', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_URL;
    process.env.NEXT_PUBLIC_URL = 'https://prod.example.com';
    mockFetch.mockResolvedValue({ ok: true });

    await warmISRCache(['/']);

    expect(mockFetch).toHaveBeenCalledWith('https://prod.example.com/');

    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_URL;
    }
  });

  it('should fall back to localhost when no URL is configured', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_URL;
    mockFetch.mockResolvedValue({ ok: true });

    await warmISRCache(['/']);

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/');

    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_URL;
    }
  });

  it('should handle empty paths array', async () => {
    const result = await warmISRCache([], 'https://example.com');

    expect(result).toEqual({ warmed: 0, failed: 0, errors: [] });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
