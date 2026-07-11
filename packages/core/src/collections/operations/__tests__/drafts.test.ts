/**
 * Draft read/write + snapshot enforcement tests
 *
 * Proves the draft boundary that keeps unpublished content from leaking:
 *   - find()/findByID() honor the `draft` param, but ONLY relax the
 *     published-only default — never the access.read clause.
 *   - THE CRITICAL INVARIANT: an unauthenticated read with `draft=true` still
 *     returns published content only.
 *   - update() persists `_status` transitions, gated by access.update.
 *   - createSnapshot()/restoreSnapshot() are gated by access.update and
 *     delegate to the typed storage seam.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealRequest,
} from '../../../types/index.js';
import { find } from '../find.js';
import { findByID } from '../findById.js';
import { createSnapshot, restoreSnapshot } from '../snapshot.js';
import { update } from '../update.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRequest(overrides: Partial<RevealRequest> = {}): RevealRequest {
  return {
    transactionID: 'test-tx',
    context: {},
    user: { id: 'user-1', email: 'test@example.com', roles: ['editor'] },
    ...overrides,
  };
}

/** Minimal in-memory WhereClause matcher (and/or + equals/not_equals/in). */
function matchesWhere(doc: Record<string, unknown>, where: unknown): boolean {
  if (!where || typeof where !== 'object') return true;
  const w = where as Record<string, unknown>;
  if (Array.isArray(w.and)) return w.and.every((sub) => matchesWhere(doc, sub));
  if (Array.isArray(w.or)) return w.or.some((sub) => matchesWhere(doc, sub));
  return Object.entries(w).every(([field, cond]) => {
    if (field === 'and' || field === 'or') return true;
    if (!cond || typeof cond !== 'object') return true;
    const c = cond as Record<string, unknown>;
    const actual = doc[field];
    if ('equals' in c) return actual === c.equals;
    if ('not_equals' in c) return actual !== c.not_equals;
    if ('in' in c && Array.isArray(c.in)) return c.in.includes(actual);
    return true;
  });
}

/**
 * Mock storage whose find() scopes by the merged where, and whose findByID()
 * returns the raw row UNSCOPED. The unscoped findByID is deliberate: if the
 * operation layer fails to apply the draft/access filter, an unpublished row
 * leaks through — and the test catches it.
 */
function mockDb(docs: Record<string, unknown>[] = []) {
  return {
    query: vi.fn(),
    collectionStorage: {
      find: vi
        .fn()
        .mockImplementation((_c: RevealCollectionConfig, opts: { where?: unknown } = {}) => {
          const filtered = docs.filter((d) => matchesWhere(d, opts.where));
          return Promise.resolve({
            docs: filtered,
            totalDocs: filtered.length,
            limit: 10,
            totalPages: filtered.length > 0 ? 1 : 0,
            page: 1,
            pagingCounter: filtered.length > 0 ? 1 : 0,
            hasPrevPage: false,
            hasNextPage: false,
            prevPage: null,
            nextPage: null,
          });
        }),
      findByID: vi
        .fn()
        .mockImplementation((_c: RevealCollectionConfig, opts: { id: string | number }) =>
          Promise.resolve(docs.find((d) => d.id === String(opts.id)) ?? null),
        ),
    },
  };
}

const draftDocs = [
  { id: '1', title: 'Published Page', _status: 'published' },
  { id: '2', title: 'Draft Page', _status: 'draft' },
];

/** Drafts-enabled collection (mirrors the admin Pages `versions.drafts` config). */
const draftConfig: RevealCollectionConfig = {
  slug: 'pages',
  fields: [{ name: 'title', type: 'text' }],
  versions: { drafts: { autosave: { interval: 100 } }, maxPerDoc: 50 },
} as RevealCollectionConfig;

/** Public/anon access rule: a user-bearing req is admin (allow all); a
 *  user-less req is scoped to published (mirrors authenticatedOrPublished). */
const publicOrPublished = ({ req }: { req: RevealRequest }) =>
  req.user ? true : { _status: { equals: 'published' } };

// ---------------------------------------------------------------------------
// find() — draft read semantics
// ---------------------------------------------------------------------------

describe('find() draft semantics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drafts-enabled + no draft param + admin access.read=true → published only', async () => {
    const config = { ...draftConfig, access: { read: () => true } };
    const result = await find(config, mockDb(draftDocs) as never, { req: mockRequest() });
    expect(result.docs.map((d) => d.id)).toEqual(['1']);
  });

  it('drafts-enabled + draft=true + admin access.read=true → includes drafts', async () => {
    const config = { ...draftConfig, access: { read: () => true } };
    const result = await find(config, mockDb(draftDocs) as never, {
      req: mockRequest(),
      draft: true,
    });
    expect(result.docs.map((d) => d.id).sort()).toEqual(['1', '2']);
  });

  // THE INVARIANT: draft=true must NOT override access.read for a public reader.
  it('INVARIANT: drafts-enabled + draft=true + public (user-less req) → published only', async () => {
    const config = { ...draftConfig, access: { read: publicOrPublished } };
    const result = await find(config, mockDb(draftDocs) as never, {
      req: mockRequest({ user: undefined }),
      draft: true,
    });
    expect(result.docs.map((d) => d.id)).toEqual(['1']);
    expect(result.docs.some((d) => d._status === 'draft')).toBe(false);
  });

  it('non-drafts collection + draft=true → no _status filtering (backward compatible)', async () => {
    const config: RevealCollectionConfig = {
      slug: 'posts',
      fields: [{ name: 'title', type: 'text' }],
      access: { read: () => true },
    };
    const result = await find(config, mockDb(draftDocs) as never, {
      req: mockRequest(),
      draft: true,
    });
    expect(result.docs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// findByID() — draft read semantics
// ---------------------------------------------------------------------------

describe('findByID() draft semantics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drafts-enabled + draft=false + admin access.read=true → draft doc returns null', async () => {
    const config = { ...draftConfig, access: { read: () => true } };
    const doc = await findByID(config, mockDb(draftDocs) as never, { id: '2', req: mockRequest() });
    expect(doc).toBeNull();
  });

  it('drafts-enabled + draft=true + admin access.read=true → draft doc returned', async () => {
    const config = { ...draftConfig, access: { read: () => true } };
    const doc = await findByID(config, mockDb(draftDocs) as never, {
      id: '2',
      req: mockRequest(),
      draft: true,
    });
    expect(doc?.id).toBe('2');
  });

  // THE INVARIANT (single-doc): a public reader cannot fetch a draft by id
  // even with draft=true.
  it('INVARIANT: drafts-enabled + draft=true + public → draft doc returns null', async () => {
    const config = { ...draftConfig, access: { read: publicOrPublished } };
    const doc = await findByID(config, mockDb(draftDocs) as never, {
      id: '2',
      req: mockRequest({ user: undefined }),
      draft: true,
    });
    expect(doc).toBeNull();
  });

  it('drafts-enabled + draft=true + public → published doc still returned', async () => {
    const config = { ...draftConfig, access: { read: publicOrPublished } };
    const doc = await findByID(config, mockDb(draftDocs) as never, {
      id: '1',
      req: mockRequest({ user: undefined }),
      draft: true,
    });
    expect(doc?.id).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// update() — _status writes
// ---------------------------------------------------------------------------

describe('update() _status writes', () => {
  beforeEach(() => vi.clearAllMocks());

  const writeConfig: RevealCollectionConfig = {
    slug: 'pages',
    fields: [{ name: 'title', type: 'text' }],
  };

  it('persists an _status transition to the dynamic-SQL UPDATE', async () => {
    const db = {
      query: vi
        .fn()
        // checkExistsByIdQuery
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] } as DatabaseResult)
        // UPDATE
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as DatabaseResult)
        // findByID read-back (dynamic path)
        .mockResolvedValueOnce({
          rows: [{ id: 'p1', title: 'T', _status: 'published' }],
        } as DatabaseResult),
    };

    await update(writeConfig, db as never, {
      id: 'p1',
      data: { title: 'T', _status: 'published' },
    });

    const updateCall = db.query.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE');
    expect(updateCall[0]).toContain('_status');
    expect(updateCall[1]).toContain('published');
  });

  it('rejects an _status transition when access.update denies', async () => {
    const config: RevealCollectionConfig = {
      ...writeConfig,
      access: { update: () => false },
    };
    const db = { query: vi.fn() };

    await expect(
      update(config, db as never, {
        id: 'p1',
        data: { _status: 'published' },
        req: mockRequest(),
      }),
    ).rejects.toThrow('Access denied');
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// snapshot / restore
// ---------------------------------------------------------------------------

describe('createSnapshot() / restoreSnapshot()', () => {
  beforeEach(() => vi.clearAllMocks());

  function snapshotDb() {
    return {
      query: vi.fn(),
      collectionStorage: {
        snapshot: vi.fn().mockResolvedValue({ id: 'rev-1', revisionNumber: 1, pageId: 'p1' }),
        restore: vi.fn().mockResolvedValue({ id: 'p1', title: 'restored' }),
      },
    };
  }

  it('createSnapshot delegates to the storage seam when access.update allows', async () => {
    const config: RevealCollectionConfig = {
      slug: 'pages',
      fields: [],
      access: { update: () => true },
    };
    const db = snapshotDb();
    const rev = await createSnapshot(config, db as never, {
      id: 'p1',
      req: mockRequest(),
      changeDescription: 'edit',
    });
    expect(rev.id).toBe('rev-1');
    expect(db.collectionStorage.snapshot).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ id: 'p1', changeDescription: 'edit' }),
    );
  });

  it('createSnapshot is denied when access.update returns false', async () => {
    const config: RevealCollectionConfig = {
      slug: 'pages',
      fields: [],
      access: { update: () => false },
    };
    const db = snapshotDb();
    await expect(
      createSnapshot(config, db as never, { id: 'p1', req: mockRequest() }),
    ).rejects.toThrow('Access denied');
    expect(db.collectionStorage.snapshot).not.toHaveBeenCalled();
  });

  it('createSnapshot throws when no typed storage seam is registered', async () => {
    const config: RevealCollectionConfig = { slug: 'pages', fields: [] };
    const db = { query: vi.fn(), collectionStorage: {} };
    await expect(createSnapshot(config, db as never, { id: 'p1' })).rejects.toThrow(
      'Snapshots are not supported',
    );
  });

  it('restoreSnapshot delegates to the storage seam when access.update allows', async () => {
    const config: RevealCollectionConfig = {
      slug: 'pages',
      fields: [],
      access: { update: () => true },
    };
    const db = snapshotDb();
    const doc = await restoreSnapshot(config, db as never, {
      id: 'p1',
      revisionId: 'rev-1',
      req: mockRequest(),
    });
    expect(doc.title).toBe('restored');
    expect(db.collectionStorage.restore).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ id: 'p1', revisionId: 'rev-1' }),
    );
  });

  it('restoreSnapshot is denied when access.update returns false', async () => {
    const config: RevealCollectionConfig = {
      slug: 'pages',
      fields: [],
      access: { update: () => false },
    };
    const db = snapshotDb();
    await expect(
      restoreSnapshot(config, db as never, { id: 'p1', revisionId: 'rev-1', req: mockRequest() }),
    ).rejects.toThrow('Access denied');
    expect(db.collectionStorage.restore).not.toHaveBeenCalled();
  });
});
