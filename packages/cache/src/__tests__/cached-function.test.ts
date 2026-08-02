import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCacheStore } from '../adapters/memory.js';
import {
  buildCachedFunctionKey,
  createCachedFunction,
  serializeCacheArgs,
} from '../cached-function.js';
import { resetDefaultCacheStore, setDefaultCacheStore } from '../default-store.js';
import { revalidatePath, revalidateTag } from '../revalidate.js';

describe('createCachedFunction', () => {
  let store: InMemoryCacheStore;

  beforeEach(() => {
    store = new InMemoryCacheStore();
    setDefaultCacheStore(store);
  });

  afterEach(async () => {
    await store.close();
    resetDefaultCacheStore();
  });

  it('rejects empty keyParts', () => {
    expect(() => createCachedFunction(async () => 1, { keyParts: [], store })).toThrow(
      /keyParts must be a non-empty array/,
    );
  });

  it('returns cached value on second call without re-invoking fn', async () => {
    const fn = vi.fn(async (n: number) => n * 2);
    const cached = createCachedFunction(fn, {
      keyParts: ['double'],
      tags: ['math'],
      store,
    });

    expect(await cached(21)).toBe(42);
    expect(await cached(21)).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not collide zero-arg functions with different keyParts', async () => {
    const a = createCachedFunction(async () => 'a', { keyParts: ['fn-a'], store });
    const b = createCachedFunction(async () => 'b', { keyParts: ['fn-b'], store });
    expect(await a()).toBe('a');
    expect(await b()).toBe('b');
    expect(await a()).toBe('a');
    expect(await b()).toBe('b');
  });

  it('revalidateTag forces recompute', async () => {
    let n = 0;
    const cached = createCachedFunction(
      async () => {
        n += 1;
        return n;
      },
      { keyParts: ['counter'], tags: ['t-counter'], store },
    );

    expect(await cached()).toBe(1);
    expect(await cached()).toBe(1);
    expect(await revalidateTag('t-counter', store)).toBe(1);
    expect(await cached()).toBe(2);
  });

  it('revalidatePath evicts path-tagged entries', async () => {
    const path = '/posts/hello';
    await store.set('path:/posts/hello:v', { ok: true }, 60, [`path:${path}`]);
    expect(await store.get('path:/posts/hello:v')).toEqual({ ok: true });
    expect(await revalidatePath(path, store)).toBeGreaterThan(0);
    expect(await store.get('path:/posts/hello:v')).toBeNull();
  });

  it('buildCachedFunctionKey is stable for object arg key order', () => {
    const k1 = buildCachedFunctionKey(['doc'], [{ b: 1, a: 2 }]);
    const k2 = buildCachedFunctionKey(['doc'], [{ a: 2, b: 1 }]);
    expect(k1).toBe(k2);
    expect(serializeCacheArgs([{ a: 1 }])).toContain('"a"');
  });
});
