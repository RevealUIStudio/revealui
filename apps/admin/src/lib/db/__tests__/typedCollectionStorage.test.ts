import type { RevealFindOptions } from '@revealui/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypedCollectionStorage } from '../typedCollectionStorage';

const { getRestClient } = vi.hoisted(() => ({
  getRestClient: vi.fn(),
}));

vi.mock('@revealui/db/client', () => ({
  getRestClient,
}));

describe('typedCollectionStorage', () => {
  const originalPostgresUrl = process.env.POSTGRES_URL;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();

    if (originalPostgresUrl === undefined) {
      delete process.env.POSTGRES_URL;
    } else {
      process.env.POSTGRES_URL = originalPostgresUrl;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('returns undefined when no Postgres connection is configured', () => {
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;

    expect(createTypedCollectionStorage()).toBeUndefined();
  });

  it('maps users through Drizzle for findByID', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    getRestClient.mockReturnValue({
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'user_1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            password: 'hashed',
            role: 'admin',
            status: 'active',
            type: 'human',
            stripeCustomerId: 'cus_123',
            avatarUrl: null,
            emailVerified: true,
            emailVerifiedAt: null,
            tosAcceptedAt: null,
            tosVersion: null,
            lastActiveAt: null,
            createdAt: new Date('2026-03-12T00:00:00Z'),
            updatedAt: new Date('2026-03-12T00:00:00Z'),
            _json: {
              roles: ['admin'],
            },
          }),
        },
      },
    });

    const storage = createTypedCollectionStorage();
    const doc = await storage?.findByID?.(
      {
        slug: 'users',
        fields: [],
      },
      { id: 'user_1' },
    );

    expect(doc).toMatchObject({
      id: 'user_1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      roles: ['admin'],
    });
  });

  it('opts out for unsupported collections', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(
      {
        slug: 'media',
        fields: [],
      },
      {},
    );

    expect(result).toBeUndefined();
    expect(getRestClient).not.toHaveBeenCalled();
  });

  it('maps users through Drizzle for paginated find', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'user_1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'hashed',
        role: 'admin',
        status: 'active',
        type: 'human',
        stripeCustomerId: 'cus_123',
        avatarUrl: null,
        emailVerified: true,
        emailVerifiedAt: null,
        tosAcceptedAt: null,
        tosVersion: null,
        lastActiveAt: null,
        createdAt: new Date('2026-03-12T00:00:00Z'),
        updatedAt: new Date('2026-03-12T00:00:00Z'),
        _json: {
          roles: ['admin'],
        },
      },
    ]);
    const where = vi.fn().mockResolvedValue([{ value: 1 }]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    getRestClient.mockReturnValue({
      query: {
        users: {
          findMany,
        },
      },
      select,
    });

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(
      {
        slug: 'users',
        fields: [],
      },
      {
        page: 1,
        limit: 10,
        where: {
          status: { equals: 'active' },
        },
        sort: {
          createdAt: '-1',
        } as unknown as RevealFindOptions['sort'],
      },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 0,
      }),
    );
    expect(result).toMatchObject({
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      docs: [
        expect.objectContaining({
          id: 'user_1',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }),
      ],
    });
  });

  it('maps tenants through Drizzle for findByID', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    getRestClient.mockReturnValue({
      query: {
        tenants: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'tenant_1',
            name: 'Example Tenant',
            email: 'tenant@example.com',
            password: 'hashed',
            roles: ['tenant-admin'],
            domains: [{ domain: 'tenant.example.com' }],
            _json: {},
            createdAt: new Date('2026-03-12T00:00:00Z'),
            updatedAt: new Date('2026-03-12T00:00:00Z'),
          }),
        },
      },
    });

    const storage = createTypedCollectionStorage();
    const doc = await storage?.findByID?.(
      {
        slug: 'tenants',
        fields: [],
      },
      { id: 'tenant_1' },
    );

    expect(doc).toMatchObject({
      id: 'tenant_1',
      email: 'tenant@example.com',
      roles: ['tenant-admin'],
      domains: [{ domain: 'tenant.example.com' }],
    });
  });

  it('maps tenants through Drizzle for domain-based find', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    const tenantsFindMany = vi.fn().mockResolvedValue([
      {
        id: 'tenant_1',
        name: 'Example Tenant',
        email: 'tenant@example.com',
        password: 'hashed',
        roles: ['tenant-admin'],
        domains: [{ domain: 'tenant.example.com' }],
        _json: {},
        createdAt: new Date('2026-03-12T00:00:00Z'),
        updatedAt: new Date('2026-03-12T00:00:00Z'),
      },
    ]);
    const where = vi.fn().mockResolvedValue([{ value: 1 }]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    getRestClient.mockReturnValue({
      query: {
        tenants: {
          findMany: tenantsFindMany,
        },
      },
      select,
    });

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(
      {
        slug: 'tenants',
        fields: [],
      },
      {
        where: {
          'domains.domain': {
            equals: 'tenant.example.com',
          },
        },
        limit: 1,
        page: 1,
      },
    );

    expect(tenantsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 1,
        offset: 0,
      }),
    );
    expect(result).toMatchObject({
      totalDocs: 1,
      docs: [
        expect.objectContaining({
          id: 'tenant_1',
          email: 'tenant@example.com',
        }),
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Pages — canonical site-scoped read + write bridge
// ---------------------------------------------------------------------------

/**
 * Thenable query-chain stub: every builder method returns the chain; each
 * `await` of the chain consumes the next queued result. This matches how the
 * pages queries terminate at different depths (`.limit()`, `.offset()`,
 * `.returning()`, bare `.where()` for count/soft-delete).
 */
function createPagesChain(results: unknown[]) {
  let cursor = 0;
  const calls = { values: [] as unknown[], set: [] as unknown[] };
  // biome-ignore lint/suspicious/noExplicitAny: structural test stub
  const chain: any = {};
  for (const method of ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'returning']) {
    chain[method] = () => chain;
  }
  chain.insert = () => chain;
  chain.update = () => chain;
  chain.values = (value: unknown) => {
    calls.values.push(value);
    return chain;
  };
  chain.set = (value: unknown) => {
    calls.set.push(value);
    return chain;
  };
  chain.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ): Promise<unknown> => {
    const next = results[cursor];
    cursor += 1;
    return Promise.resolve(next ?? []).then(resolve, reject);
  };
  return { chain, calls };
}

const pageRow = {
  id: 'page_1',
  schemaVersion: '1',
  version: 1,
  siteId: 'fleet-marketing',
  parentId: null,
  templateId: null,
  title: 'Home',
  slug: 'home',
  path: '/',
  status: 'published',
  blocks: [{ blockType: 'hero', type: 'lowImpact' }],
  seo: { title: 'Home' },
  blockCount: 1,
  wordCount: 0,
  lock: null,
  scheduledAt: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-02T00:00:00Z'),
  publishedAt: new Date('2026-07-02T00:00:00Z'),
  deletedAt: null,
};

const pagesCollection = { slug: 'pages', fields: [] };

describe('typedCollectionStorage pages bridge', () => {
  beforeEach(() => {
    process.env.POSTGRES_URL = 'postgresql://example';
  });

  it('maps a page row for findByID (canonical columns + _status mirror)', async () => {
    const { chain } = createPagesChain([[pageRow]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const doc = await storage?.findByID?.(pagesCollection, { id: 'page_1' });

    expect(doc).toMatchObject({
      id: 'page_1',
      title: 'Home',
      slug: 'home',
      path: '/',
      siteId: 'fleet-marketing',
      blocks: [{ blockType: 'hero', type: 'lowImpact' }],
      seo: { title: 'Home' },
      status: 'published',
      _status: 'published',
    });
  });

  it('handles the access-merged and-where (slug + _status -> status column)', async () => {
    const { chain } = createPagesChain([[pageRow], [{ value: 1 }]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(pagesCollection, {
      where: {
        and: [{ slug: { equals: 'home' } }, { _status: { equals: 'published' } }],
      },
      limit: 1,
      page: 1,
    });

    expect(result).toMatchObject({
      totalDocs: 1,
      docs: [expect.objectContaining({ id: 'page_1', _status: 'published' })],
    });
  });

  it('signals not-handled for where shapes it cannot express (or)', async () => {
    const { chain } = createPagesChain([]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(pagesCollection, {
      where: { or: [{ slug: { equals: 'home' } }] },
      limit: 1,
      page: 1,
    });

    expect(result).toBeUndefined();
  });

  it('creates a page with site/path defaults derived server-side', async () => {
    const inserted = {
      ...pageRow,
      id: 'page_new',
      title: 'About',
      slug: 'about',
      path: '/about',
      status: 'draft',
      publishedAt: null,
    };
    const { chain, calls } = createPagesChain([[inserted]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const doc = await storage?.create?.(pagesCollection, {
      data: {
        title: 'About',
        slug: 'about',
        blocks: [{ blockType: 'hero', type: 'lowImpact' }],
        seo: { title: 'About' },
        _status: 'draft',
      },
    });

    expect(calls.values[0]).toMatchObject({
      siteId: 'fleet-marketing',
      title: 'About',
      slug: 'about',
      path: '/about',
      status: 'draft',
      blockCount: 1,
    });
    expect(doc).toMatchObject({ id: 'page_new', slug: 'about', path: '/about', _status: 'draft' });
  });

  it('throws (handled-but-invalid) when create is missing a slug', async () => {
    const { chain } = createPagesChain([]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    await expect(
      storage?.create?.(pagesCollection, { data: { title: 'No Slug' } }),
    ).rejects.toThrow('pages create requires');
  });

  it('updates a page, keeping path in lockstep with a slug change', async () => {
    const updated = { ...pageRow, slug: 'landing', path: '/landing', status: 'published' };
    const { chain, calls } = createPagesChain([[pageRow], [updated]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const doc = await storage?.update?.(pagesCollection, {
      id: 'page_1',
      data: { slug: 'landing', _status: 'published' },
    });

    expect(calls.set[0]).toMatchObject({ slug: 'landing', path: '/landing', status: 'published' });
    expect(doc).toMatchObject({ slug: 'landing', path: '/landing', _status: 'published' });
  });

  it('throws handled-but-not-found on update of a missing (or soft-deleted) page', async () => {
    const { chain } = createPagesChain([[]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    await expect(
      storage?.update?.(pagesCollection, { id: 'ghost', data: { title: 'X' } }),
    ).rejects.toThrow('not found');
  });

  it('soft-deletes and returns the deleted document', async () => {
    // deleteTypedPage awaits: own getPageById, deletePage's inner getPageById,
    // then the soft-delete update itself.
    const { chain, calls } = createPagesChain([[pageRow], [pageRow], []]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const doc = await storage?.delete?.(pagesCollection, { id: 'page_1' });

    expect(doc).toMatchObject({ id: 'page_1', slug: 'home' });
    expect(calls.set[0]).toMatchObject({ deletedAt: expect.any(Date) });
  });

  it('returns undefined (not handled) for write calls on other collections', async () => {
    const { chain } = createPagesChain([]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    await expect(
      storage?.create?.({ slug: 'media', fields: [] }, { data: { title: 'x' } }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Posts — blog read + write bridge (twin of the pages bridge)
// ---------------------------------------------------------------------------

const postRow = {
  id: 'post_1',
  schemaVersion: '1',
  version: 1,
  title: 'Hello World',
  slug: 'hello-world',
  excerpt: 'An intro',
  content: { root: { children: [] } },
  featuredImageId: 'media_1',
  authorId: 'user_1',
  status: 'published',
  published: true,
  meta: { title: 'Hello World' },
  categories: ['cat_1'],
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-02T00:00:00Z'),
  publishedAt: new Date('2026-07-02T00:00:00Z'),
  deletedAt: null,
};

const postsCollection = { slug: 'posts', fields: [] };

describe('typedCollectionStorage posts bridge', () => {
  beforeEach(() => {
    process.env.POSTGRES_URL = 'postgresql://example';
  });

  it('maps a post row for findByID (single authorId -> authors[], _status mirror)', async () => {
    const { chain } = createPagesChain([[postRow]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const doc = await storage?.findByID?.(postsCollection, { id: 'post_1' });

    expect(doc).toMatchObject({
      id: 'post_1',
      title: 'Hello World',
      slug: 'hello-world',
      excerpt: 'An intro',
      featuredImageId: 'media_1',
      authorId: 'user_1',
      authors: ['user_1'],
      categories: ['cat_1'],
      meta: { title: 'Hello World' },
      status: 'published',
      _status: 'published',
    });
  });

  it('handles the access-merged and-where (slug + _status -> status column)', async () => {
    const { chain } = createPagesChain([[postRow], [{ value: 1 }]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(postsCollection, {
      where: {
        and: [{ slug: { equals: 'hello-world' } }, { _status: { equals: 'published' } }],
      },
      limit: 1,
      page: 1,
    });

    expect(result).toMatchObject({
      totalDocs: 1,
      docs: [expect.objectContaining({ id: 'post_1', _status: 'published' })],
    });
  });

  it('signals not-handled for where shapes it cannot express (or)', async () => {
    const { chain } = createPagesChain([]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(postsCollection, {
      where: { or: [{ slug: { equals: 'hello-world' } }] },
      limit: 1,
      page: 1,
    });

    expect(result).toBeUndefined();
  });

  /**
   * Prove-red: the camelCase-column round-trip. The dynamic-SQL write path
   * emits `publishedAt` / `featuredImageId` / `authors` verbatim as SQL column
   * identifiers, which do not exist on the snake_case `posts` table (the
   * camelCase-column trap). The typed bridge maps each to its Drizzle column:
   * camelCase Drizzle fields (`publishedAt`, `featuredImageId`, `authorId`)
   * that Drizzle renders as the correct snake_case columns, `authors[]`
   * collapsed to the single `author_id`, and `_status` to `status`.
   */
  it('creates a post, mapping camelCase/hasMany fields onto real columns', async () => {
    const inserted = {
      ...postRow,
      id: 'post_new',
      title: 'Second Post',
      slug: 'second-post',
      status: 'draft',
      published: false,
      publishedAt: null,
    };
    const { chain, calls } = createPagesChain([[inserted]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const doc = await storage?.create?.(postsCollection, {
      data: {
        title: 'Second Post',
        slug: 'second-post',
        content: { root: { children: [] } },
        featuredImageId: 'media_9',
        authors: ['user_7', 'user_8'],
        categories: [{ id: 'cat_2' }, 'cat_3'],
        publishedAt: '2026-07-05T00:00:00Z',
        _status: 'draft',
      },
    });

    expect(calls.values[0]).toMatchObject({
      title: 'Second Post',
      slug: 'second-post',
      featuredImageId: 'media_9',
      authorId: 'user_7',
      categories: ['cat_2', 'cat_3'],
      status: 'draft',
      published: false,
    });
    // publishedAt is coerced to a Date, never passed through as a camelCase string column.
    expect((calls.values[0] as { publishedAt: unknown }).publishedAt).toBeInstanceOf(Date);
    expect(doc).toMatchObject({ id: 'post_new', slug: 'second-post', _status: 'draft' });
  });

  it('throws (handled-but-invalid) when create is missing a slug', async () => {
    const { chain } = createPagesChain([]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    await expect(
      storage?.create?.(postsCollection, { data: { title: 'No Slug' } }),
    ).rejects.toThrow('posts create requires');
  });

  it('updates a post, mirroring _status -> status/published and authors -> authorId', async () => {
    const updated = { ...postRow, status: 'published', published: true, authorId: 'user_2' };
    const { chain, calls } = createPagesChain([[postRow], [updated]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const doc = await storage?.update?.(postsCollection, {
      id: 'post_1',
      data: { authors: ['user_2'], _status: 'published' },
    });

    expect(calls.set[0]).toMatchObject({
      authorId: 'user_2',
      status: 'published',
      published: true,
    });
    expect(doc).toMatchObject({ authorId: 'user_2', authors: ['user_2'], _status: 'published' });
  });

  it('throws handled-but-not-found on update of a missing (or soft-deleted) post', async () => {
    const { chain } = createPagesChain([[]]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    await expect(
      storage?.update?.(postsCollection, { id: 'ghost', data: { title: 'X' } }),
    ).rejects.toThrow('not found');
  });

  it('soft-deletes and returns the deleted document', async () => {
    // deleteTypedPost awaits: own getPostById, then deletePost's soft-delete
    // update (deletePost has no inner read, unlike deletePage).
    const { chain, calls } = createPagesChain([[postRow], []]);
    getRestClient.mockReturnValue(chain);

    const storage = createTypedCollectionStorage();
    const doc = await storage?.delete?.(postsCollection, { id: 'post_1' });

    expect(doc).toMatchObject({ id: 'post_1', slug: 'hello-world' });
    expect(calls.set[0]).toMatchObject({ deletedAt: expect.any(Date) });
  });
});
