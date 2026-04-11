import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDataloaderCacheKey, getDataLoader } from '../dataloader.js';
import type { RevealPaginatedResult } from '../index.js';
import type { RevealFindOptions, RevealRequest } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRevealUI(findImpl?: (...args: unknown[]) => unknown) {
  return {
    find: vi.fn(
      findImpl ??
        (async () => ({
          docs: [],
          totalDocs: 0,
          limit: 0,
          totalPages: 0,
          page: 1,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        })),
    ),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    db: null,
    collections: {},
    globals: {},
    config: {} as never,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function createMockRequest(overrides?: Partial<RevealRequest>): RevealRequest {
  const mockRevealUI = createMockRevealUI();
  return {
    revealui: mockRevealUI,
    transactionID: undefined,
    ...overrides,
  } as RevealRequest;
}

function emptyPaginatedResult(docs: Array<{ id: string | number }> = []): RevealPaginatedResult {
  return {
    docs,
    totalDocs: docs.length,
    limit: 0,
    totalPages: 1,
    page: 1,
    pagingCounter: 1,
    hasPrevPage: false,
    hasNextPage: false,
    prevPage: null,
    nextPage: null,
  } as RevealPaginatedResult;
}

// ---------------------------------------------------------------------------
// Tests  -  createDataloaderCacheKey
// ---------------------------------------------------------------------------
describe('createDataloaderCacheKey', () => {
  const baseArgs = {
    collectionSlug: 'posts',
    currentDepth: 1,
    depth: 2,
    docID: 'doc-1' as string | number,
    draft: false,
    fallbackLocale: 'en' as const,
    locale: 'en' as string | string[],
    overrideAccess: false,
    showHiddenFields: false,
    transactionID: undefined as string | number | undefined,
  };

  it('produces a JSON string', () => {
    const key = createDataloaderCacheKey(baseArgs);
    expect(() => JSON.parse(key)).not.toThrow();
  });

  it('includes all key components', () => {
    const key = createDataloaderCacheKey(baseArgs);
    const parsed = JSON.parse(key);

    expect(parsed).toContain('posts');
    expect(parsed).toContain('doc-1');
    expect(parsed).toContain('en');
  });

  it('produces different keys for different collections', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, collectionSlug: 'users' });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different doc IDs', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, docID: 'doc-2' });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different depth', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, depth: 3 });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for draft vs non-draft', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, draft: true });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different locales', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, locale: 'fr' });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for overrideAccess', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, overrideAccess: true });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys with select', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, select: { title: true } });

    expect(key1).not.toBe(key2);
  });

  it('produces same key for same inputs', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey(baseArgs);

    expect(key1).toBe(key2);
  });

  it('handles numeric doc IDs', () => {
    const key = createDataloaderCacheKey({ ...baseArgs, docID: 42 });
    const parsed = JSON.parse(key);

    expect(parsed).toContain(42);
  });

  it('handles transaction ID', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, transactionID: 'tx-1' });

    expect(key1).not.toBe(key2);
  });

  it('handles locale array', () => {
    const key = createDataloaderCacheKey({ ...baseArgs, locale: ['en', 'fr'] });
    const parsed = JSON.parse(key);

    // Locale array should be serialized
    expect(JSON.stringify(parsed)).toContain('en');
    expect(JSON.stringify(parsed)).toContain('fr');
  });

  it('produces different keys for different currentDepth', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, currentDepth: 5 });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different fallbackLocale', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, fallbackLocale: 'fr' });

    expect(key1).not.toBe(key2);
  });

  it('handles false fallbackLocale', () => {
    const key = createDataloaderCacheKey({ ...baseArgs, fallbackLocale: false });
    const parsed = JSON.parse(key);
    expect(parsed).toContain(false);
  });

  it('handles null fallbackLocale', () => {
    const key = createDataloaderCacheKey({ ...baseArgs, fallbackLocale: null });
    const parsed = JSON.parse(key);
    expect(parsed).toContain(null);
  });

  it('produces different keys for showHiddenFields', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, showHiddenFields: true });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different populate values', () => {
    const key1 = createDataloaderCacheKey(baseArgs);
    const key2 = createDataloaderCacheKey({ ...baseArgs, populate: { author: true } });

    expect(key1).not.toBe(key2);
  });

  it('handles numeric transactionID', () => {
    const key = createDataloaderCacheKey({ ...baseArgs, transactionID: 42 });
    const parsed = JSON.parse(key);
    expect(parsed[0]).toBe(42);
  });

  it('serialises key components in deterministic order', () => {
    // The tuple order is: transactionID, collectionSlug, docID, depth, currentDepth,
    // locale, fallbackLocale, overrideAccess, showHiddenFields, draft, select, populate
    const key = createDataloaderCacheKey({
      ...baseArgs,
      transactionID: 'tx-1',
      select: { title: true },
      populate: { author: true },
    });
    const parsed = JSON.parse(key);

    expect(parsed[0]).toBe('tx-1');
    expect(parsed[1]).toBe('posts');
    expect(parsed[2]).toBe('doc-1');
    expect(parsed[3]).toBe(2); // depth
    expect(parsed[4]).toBe(1); // currentDepth
    expect(parsed[5]).toBe('en'); // locale
    expect(parsed[6]).toBe('en'); // fallbackLocale
    expect(parsed[7]).toBe(false); // overrideAccess
    expect(parsed[8]).toBe(false); // showHiddenFields
    expect(parsed[9]).toBe(false); // draft
    expect(parsed[10]).toEqual({ title: true }); // select
    expect(parsed[11]).toEqual({ author: true }); // populate
  });
});

// ---------------------------------------------------------------------------
// Tests  -  getDataLoader
// ---------------------------------------------------------------------------
describe('getDataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an object with load and find methods', () => {
    const req = createMockRequest();
    const loader = getDataLoader(req);

    expect(typeof loader.load).toBe('function');
    expect(typeof loader.find).toBe('function');
  });

  // -----------------------------------------------------------------------
  // find()  -  caching
  // -----------------------------------------------------------------------
  describe('find()', () => {
    it('delegates to revealui.find', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const args = { collection: 'posts', where: { id: { equals: '1' } } } as RevealFindOptions & {
        collection: string;
      };
      await loader.find(args);

      expect(mockRevealUI.find).toHaveBeenCalledWith(args);
    });

    it('caches identical find calls', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const args = { collection: 'posts', depth: 1 } as RevealFindOptions & {
        collection: string;
      };
      const p1 = loader.find(args);
      const p2 = loader.find(args);

      // Same promise reference means dedup worked
      expect(p1).toBe(p2);
      // revealui.find should only be called once
      await p1;
      expect(mockRevealUI.find).toHaveBeenCalledTimes(1);
    });

    it('does not cache calls with different args', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const args1 = { collection: 'posts', depth: 1 } as RevealFindOptions & {
        collection: string;
      };
      const args2 = { collection: 'users', depth: 1 } as RevealFindOptions & {
        collection: string;
      };
      await loader.find(args1);
      await loader.find(args2);

      expect(mockRevealUI.find).toHaveBeenCalledTimes(2);
    });

    it('throws if revealui is not on request', () => {
      const req = createMockRequest({ revealui: undefined });
      const loader = getDataLoader(req);

      expect(() =>
        loader.find({ collection: 'posts' } as RevealFindOptions & { collection: string }),
      ).toThrow('RevealUI instance not available on request');
    });

    it('caches distinct where clauses separately', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      await loader.find({
        collection: 'posts',
        where: { status: { equals: 'draft' } },
      } as RevealFindOptions & { collection: string });
      await loader.find({
        collection: 'posts',
        where: { status: { equals: 'published' } },
      } as RevealFindOptions & { collection: string });

      expect(mockRevealUI.find).toHaveBeenCalledTimes(2);
    });

    it('differentiates cache keys by pagination params', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      await loader.find({ collection: 'posts', page: 1, limit: 10 } as RevealFindOptions & {
        collection: string;
      });
      await loader.find({ collection: 'posts', page: 2, limit: 10 } as RevealFindOptions & {
        collection: string;
      });

      expect(mockRevealUI.find).toHaveBeenCalledTimes(2);
    });

    it('differentiates cache keys by draft flag', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      await loader.find({ collection: 'posts', draft: false } as RevealFindOptions & {
        collection: string;
      });
      await loader.find({ collection: 'posts', draft: true } as RevealFindOptions & {
        collection: string;
      });

      expect(mockRevealUI.find).toHaveBeenCalledTimes(2);
    });

    it('differentiates cache keys by select', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      await loader.find({
        collection: 'posts',
        select: { title: true },
      } as unknown as RevealFindOptions & { collection: string });
      await loader.find({
        collection: 'posts',
        select: { body: true },
      } as unknown as RevealFindOptions & { collection: string });

      expect(mockRevealUI.find).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // load()  -  DataLoader batch loading
  // -----------------------------------------------------------------------
  describe('load()', () => {
    it('batches loads for the same collection into a single find call', async () => {
      const mockRevealUI = createMockRevealUI(async () =>
        emptyPaginatedResult([{ id: 'doc-1' }, { id: 'doc-2' }]),
      );
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key1 = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      const key2 = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-2',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      // Trigger both loads  -  DataLoader batches them on next microtask
      const [result1, result2] = await Promise.all([loader.load(key1), loader.load(key2)]);

      // Both should resolve
      expect(result1).toEqual({ id: 'doc-1' });
      expect(result2).toEqual({ id: 'doc-2' });

      // Only one find call for the batch
      expect(mockRevealUI.find).toHaveBeenCalledTimes(1);
      expect(mockRevealUI.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'posts',
          where: { id: { in: ['doc-1', 'doc-2'] } },
        }),
      );
    });

    it('makes separate find calls for different collections', async () => {
      const mockRevealUI = createMockRevealUI(async (opts: { collection: string }) => {
        if (opts.collection === 'posts') {
          return emptyPaginatedResult([{ id: 'post-1' }]);
        }
        return emptyPaginatedResult([{ id: 'user-1' }]);
      });
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const postKey = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'post-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      const userKey = createDataloaderCacheKey({
        collectionSlug: 'users',
        currentDepth: 0,
        depth: 1,
        docID: 'user-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      await Promise.all([loader.load(postKey), loader.load(userKey)]);

      // Two separate find calls  -  one per collection
      expect(mockRevealUI.find).toHaveBeenCalledTimes(2);
    });

    it('returns null for docs not found in the result', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult([{ id: 'doc-1' }]));
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key1 = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      const keyMissing = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-missing',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      const [found, missing] = await Promise.all([loader.load(key1), loader.load(keyMissing)]);

      expect(found).toEqual({ id: 'doc-1' });
      // Missing docs come back as null (the initial placeholder)
      expect(missing).toBeNull();
    });

    it('throws when revealui instance is not on the request', async () => {
      const req = createMockRequest({ revealui: undefined });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      await expect(loader.load(key)).rejects.toThrow('RevealUI instance not available on request');
    });

    it('passes correct options to revealui.find', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 2,
        depth: 3,
        docID: 'doc-1',
        draft: true,
        fallbackLocale: 'fr',
        locale: 'de',
        overrideAccess: true,
        showHiddenFields: true,
        transactionID: undefined,
      });

      await loader.load(key);

      expect(mockRevealUI.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'posts',
          currentDepth: 2,
          depth: 3,
          draft: true,
          fallbackLocale: 'fr',
          locale: 'de',
          overrideAccess: true,
          showHiddenFields: true,
          disableErrors: true,
          pagination: false,
        }),
      );
    });

    it('handles transactionID on the request correctly', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({
        revealui: mockRevealUI as never,
        transactionID: 'tx-original',
      });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: 'tx-new',
      });

      await loader.load(key);

      // transactionID on request should be set from the cache key
      expect(req.transactionID).toBe('tx-new');
    });

    it('handles numeric transactionID by converting to string', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: 42,
      });

      await loader.load(key);

      // Numeric transactionID should be converted to string
      expect(req.transactionID).toBe('42');
    });

    it('handles null transactionID by setting to undefined', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      await loader.load(key);

      // null transactionID in the parsed key => undefined on request
      expect(req.transactionID).toBeUndefined();
    });

    it('handles locale array by taking the first element', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: ['de', 'fr'],
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      await loader.load(key);

      expect(mockRevealUI.find).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'de', // first element of the array
        }),
      );
    });

    it('passes select and populate to find', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
        select: { title: true, body: true },
        populate: { author: true },
      });

      await loader.load(key);

      expect(mockRevealUI.find).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { title: true, body: true },
          populate: { author: true },
        }),
      );
    });

    it('makes separate find calls for different depths in the same collection', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const keyDepth1 = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      const keyDepth3 = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 3,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'en',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      await Promise.all([loader.load(keyDepth1), loader.load(keyDepth3)]);

      // Different depth = different batch key = separate find calls
      expect(mockRevealUI.find).toHaveBeenCalledTimes(2);
    });

    it('handles string fallbackLocale correctly', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: 'fr',
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      await loader.load(key);

      expect(mockRevealUI.find).toHaveBeenCalledWith(
        expect.objectContaining({
          fallbackLocale: 'fr',
        }),
      );
    });

    it('passes undefined for non-string fallbackLocale', async () => {
      const mockRevealUI = createMockRevealUI(async () => emptyPaginatedResult());
      const req = createMockRequest({ revealui: mockRevealUI as never });
      const loader = getDataLoader(req);

      const key = createDataloaderCacheKey({
        collectionSlug: 'posts',
        currentDepth: 0,
        depth: 1,
        docID: 'doc-1',
        draft: false,
        fallbackLocale: false,
        locale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
        transactionID: undefined,
      });

      await loader.load(key);

      expect(mockRevealUI.find).toHaveBeenCalledWith(
        expect.objectContaining({
          fallbackLocale: undefined,
        }),
      );
    });
  });
});
