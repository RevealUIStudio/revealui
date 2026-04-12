/**
 * Supplemental edge-cache tests covering branches not reached by the primary
 * edge-cache.test.ts suite.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../logger.js', () => ({
  getCacheLogger: () => mockLogger,
  configureCacheLogger: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  createCachedFunction,
  getABTestVariant,
  revalidatePaths,
  revalidateTags,
  warmISRCache,
} from '../edge-cache.js';

// ---------------------------------------------------------------------------
// createCachedFunction  -  edge cases
// ---------------------------------------------------------------------------

describe('createCachedFunction  -  complex argument keys', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('distinguishes cache entries for object arguments', async () => {
    const fn = vi.fn().mockImplementation(async (opts: { id: number }) => `item-${opts.id}`);
    const cached = createCachedFunction(fn, { revalidate: 60 });

    const a = await cached({ id: 1 });
    const b = await cached({ id: 2 });
    const c = await cached({ id: 1 });

    expect(a).toBe('item-1');
    expect(b).toBe('item-2');
    expect(c).toBe('item-1');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('returns cached value exactly at boundary (1 ms before expiry)', async () => {
    const fn = vi.fn().mockResolvedValue('v');
    const cached = createCachedFunction(fn, { revalidate: 10 });

    await cached('k');
    vi.advanceTimersByTime(9_999);
    await cached('k');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-fetches on the millisecond the cache expires', async () => {
    const fn = vi.fn().mockResolvedValue('v');
    const cached = createCachedFunction(fn, { revalidate: 10 });

    await cached('k');
    vi.advanceTimersByTime(10_001);
    await cached('k');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('caches zero as a valid value (falsy edge case)', async () => {
    const fn = vi.fn().mockResolvedValue(0);
    const cached = createCachedFunction(fn, { revalidate: 60 });

    const first = await cached('key');
    const second = await cached('key');

    expect(first).toBe(0);
    expect(second).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('caches null as a valid value', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const cached = createCachedFunction(fn, { revalidate: 60 });

    const first = await cached('key');
    const second = await cached('key');

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('each cached function has its own independent cache', async () => {
    const fn = vi.fn().mockResolvedValue('shared');
    const cacheA = createCachedFunction(fn, { revalidate: 60 });
    const cacheB = createCachedFunction(fn, { revalidate: 60 });

    await cacheA('x');
    await cacheB('x');

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getABTestVariant  -  empty variants throws
// ---------------------------------------------------------------------------

describe('getABTestVariant  -  error path', () => {
  it('throws when the variants array is empty', () => {
    const request = {
      headers: { get: (_name: string) => '1.2.3.4' },
      cookies: { get: (_name: string) => undefined },
    } as unknown as Parameters<typeof getABTestVariant>[0];

    expect(() => getABTestVariant(request, 'test', [])).toThrow('No variant found for A/B test');
  });
});

// ---------------------------------------------------------------------------
// revalidatePaths / revalidateTags  -  rejected (non-Error) promise in allSettled
// ---------------------------------------------------------------------------

describe('revalidatePaths  -  error normalization', () => {
  const savedEnv = process.env.NEXT_PUBLIC_URL;

  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
  });

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.NEXT_PUBLIC_URL = savedEnv;
    } else {
      delete process.env.NEXT_PUBLIC_URL;
    }
  });

  it('normalizes non-Error fetch rejection to "Unknown error"', async () => {
    // revalidatePath catches all exceptions; non-Error values become 'Unknown error'
    mockFetch.mockRejectedValueOnce('plain string error');

    const result = await revalidatePaths(['/page']);

    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toBe('Unknown error');
  });

  it('handles path revalidation where server returns ok:false and no error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });

    const result = await revalidatePaths(['/down']);

    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toBe('Unknown error');
  });

  it('collects path-level error details for each failure', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ revalidated: true }),
      })
      .mockRejectedValueOnce(new Error('Connection timeout'))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal error' }),
      });

    const result = await revalidatePaths(['/ok', '/timeout', '/broken']);

    expect(result.revalidated).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors.find((e) => e.path === '/timeout')?.error).toBe('Connection timeout');
    expect(result.errors.find((e) => e.path === '/broken')?.error).toBe('Internal error');
  });
});

describe('revalidateTags  -  error normalization', () => {
  const savedEnv = process.env.NEXT_PUBLIC_URL;

  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_URL = 'https://example.com';
  });

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.NEXT_PUBLIC_URL = savedEnv;
    } else {
      delete process.env.NEXT_PUBLIC_URL;
    }
  });

  it('normalizes non-Error fetch rejection to "Unknown error"', async () => {
    // revalidateTag catches all exceptions; non-Error values become 'Unknown error'
    mockFetch.mockRejectedValueOnce('raw rejection');

    const result = await revalidateTags(['events']);

    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toBe('Unknown error');
  });

  it('handles tag revalidation where server returns ok:false and no error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });

    const result = await revalidateTags(['products']);

    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toBe('Unknown error');
  });

  it('collects tag-level error details for each failure', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ revalidated: true }),
      })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

    const result = await revalidateTags(['posts', 'users', 'products']);

    expect(result.revalidated).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors.find((e) => e.tag === 'users')?.error).toBe('ECONNREFUSED');
    expect(result.errors.find((e) => e.tag === 'products')?.error).toBe('Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// warmISRCache  -  non-Error rejection reason
// ---------------------------------------------------------------------------

describe('warmISRCache  -  non-Error rejection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('converts a non-Error rejection to a string error', async () => {
    mockFetch.mockRejectedValueOnce('string failure');

    const result = await warmISRCache(['/page'], 'https://example.com');

    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toBe('string failure');
  });

  it('reports "Unknown error" for empty string rejection', async () => {
    mockFetch.mockRejectedValueOnce('');

    const result = await warmISRCache(['/page'], 'https://example.com');

    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toBe('Unknown error');
  });
});
