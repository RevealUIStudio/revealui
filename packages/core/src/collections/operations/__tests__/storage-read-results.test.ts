import { beforeEach, describe, expect, it, vi } from 'vitest';
import { afterRead } from '../../../fields/hooks/afterRead/index.js';
import type { RevealCollectionConfig, RevealDocument } from '../../../types/index.js';
import { find } from '../find.js';
import { findByID } from '../findById.js';

vi.mock('../../../fields/hooks/afterRead/index.js', () => ({ afterRead: vi.fn() }));
const config: RevealCollectionConfig = { slug: 'documents', fields: [] };
const pagination = {
  totalDocs: 1,
  limit: 10,
  totalPages: 1,
  page: 1,
  pagingCounter: 1,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(['find', 'findByID'])('%s public storage result', (operation) => {
  const malformed = [
    {},
    { id: '' },
    { id: Number.NaN },
    { id: Number.POSITIVE_INFINITY },
    { id: 'doc', nested: { constructor: 'reserved' } },
    { id: 'doc', nested: [{ prototype: 'reserved' }] },
    { id: 'doc', nested: { ['__proto__']: { flag: true } } },
    { id: 'doc', nested: () => 'invalid' },
    { id: 'doc', nested: new Map() },
    { id: 'doc', nested: { value: undefined } },
    false,
    0,
    '',
    [],
  ];
  it.each(malformed)('rejects malformed handled document %# before hooks or SQL', async (doc) => {
    const query = vi.fn();
    const db = {
      query,
      collectionStorage: {
        find: vi.fn().mockResolvedValue({ ...pagination, docs: [{ id: 'valid' }, doc] }),
        findByID: vi.fn().mockResolvedValue(doc),
      },
    };
    const result =
      operation === 'find'
        ? find(config, db, { req: {}, depth: 1 })
        : findByID(config, db, { id: 'doc', req: {}, depth: 1 });
    await expect(result).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    expect(afterRead).not.toHaveBeenCalled();
  });

  it.each(['[123]', '{"id":"literal"}', 0])(
    'preserves typed values and identity %s',
    async (id) => {
      const doc = {
        id,
        value: '{"literal":true}',
        _json: '{"literal":true}',
        date: new Date('2026-01-01T00:00:00Z'),
        nested: [null, { text: '[1]' }],
        optional: undefined,
      };
      const db = {
        query: vi.fn(),
        collectionStorage: {
          find: vi.fn().mockResolvedValue({ ...pagination, docs: [doc] }),
          findByID: vi.fn().mockResolvedValue(doc),
        },
      };
      const result =
        operation === 'find'
          ? (await find(config, db, {})).docs[0]
          : await findByID(config, db, { id });
      expect(result).toEqual(doc);
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  it('retains undefined opt-out and SQL fallback', async () => {
    const query = vi.fn();
    if (operation === 'find') query.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'sql' }] });
    const db = {
      query,
      collectionStorage: {
        find: vi.fn().mockResolvedValue(undefined),
        findByID: vi.fn().mockResolvedValue(undefined),
      },
    };
    const result =
      operation === 'find'
        ? (await find(config, db, {})).docs[0]
        : await findByID(config, db, { id: 'sql' });
    expect(result).toEqual({ id: 'sql' });
    expect(query).toHaveBeenCalled();
  });

  it('retains afterRead for valid handled documents', async () => {
    const doc: RevealDocument = { id: 'doc', title: 'stored' };
    vi.mocked(afterRead).mockResolvedValue({ ...doc, title: 'processed' });
    const db = {
      query: vi.fn(),
      collectionStorage: {
        find: vi.fn().mockResolvedValue({ ...pagination, docs: [doc] }),
        findByID: vi.fn().mockResolvedValue(doc),
      },
    };
    const result =
      operation === 'find'
        ? (await find(config, db, { req: {}, depth: 1 })).docs[0]
        : await findByID(config, db, { id: 'doc', req: {}, depth: 1 });
    expect(result?.title).toBe('processed');
    expect(afterRead).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ doc, depth: 1 }));
  });
});

it('preserves null as handled findByID not-found', async () => {
  const db = { query: vi.fn(), collectionStorage: { findByID: vi.fn().mockResolvedValue(null) } };
  expect(await findByID(config, db, { id: 'missing' })).toBeNull();
  expect(db.query).not.toHaveBeenCalled();
});

it.each([null, false, {}, { ...pagination, docs: null }, { ...pagination, docs: 'bad' }])(
  'rejects malformed list envelope %#',
  async (result) => {
    const db = { query: vi.fn(), collectionStorage: { find: vi.fn().mockResolvedValue(result) } };
    await expect(find(config, db, {})).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
  },
);

it('preserves access-scoped findByID routing and validates the list document', async () => {
  const scoped: RevealCollectionConfig = {
    ...config,
    access: { read: () => ({ owner: { equals: 'user' } }) },
  };
  const db = {
    query: vi.fn(),
    collectionStorage: {
      find: vi.fn().mockResolvedValue({ ...pagination, docs: [{ id: '' }] }),
      findByID: vi.fn(),
    },
  };
  await expect(findByID(scoped, db, { id: 'doc', req: {} })).rejects.toThrow();
  expect(db.collectionStorage.findByID).not.toHaveBeenCalled();
  expect(db.collectionStorage.find).toHaveBeenCalledWith(
    scoped,
    expect.objectContaining({
      where: { and: [{ id: { equals: 'doc' } }, { owner: { equals: 'user' } }] },
    }),
  );
});

it.each([
  { totalDocs: '1' },
  { totalDocs: -1 },
  { totalPages: Number.POSITIVE_INFINITY },
  { limit: 1.5 },
  { page: 0 },
  { pagingCounter: -1 },
  { hasNextPage: 'false' },
  { prevPage: 0 },
])('rejects malformed pagination metadata %#', async (metadata) => {
  const db = {
    query: vi.fn(),
    collectionStorage: {
      find: vi.fn().mockResolvedValue({ ...pagination, ...metadata, docs: [{ id: 'doc' }] }),
    },
  };
  await expect(find(config, db, { req: {}, depth: 1 })).rejects.toThrow();
  expect(afterRead).not.toHaveBeenCalled();
  expect(db.query).not.toHaveBeenCalled();
});

it('returns a valid scoped result through find without calling the unscoped adapter', async () => {
  const scoped: RevealCollectionConfig = {
    ...config,
    access: { read: () => ({ owner: { equals: 'user' } }) },
  };
  const doc = { id: 'doc', owner: 'user', text: '[1]' };
  const db = {
    query: vi.fn(),
    collectionStorage: {
      find: vi.fn().mockResolvedValue({ ...pagination, docs: [doc] }),
      findByID: vi.fn(),
    },
  };
  expect(await findByID(scoped, db, { id: 'doc', req: {} })).toEqual(doc);
  expect(db.collectionStorage.findByID).not.toHaveBeenCalled();
  expect(db.query).not.toHaveBeenCalled();
});
