/**
 * Content Search API Route Tests
 *
 * Covers GET /search with all input validation branches, query type routing
 * (posts / pages / all), limit/offset defaults, and response shape.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────
// vi.hoisted() so these objects exist before vi.mock() factories are evaluated.

const { mockDb, mockSelectChain } = vi.hoisted(() => {
  const mockSelectChain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };
  const mockDb = { select: vi.fn() };
  return { mockDb, mockSelectChain };
});

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

// ─── Import under test ────────────────────────────────────────────────────────

import searchApp from '../content/search.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono();
  app.route('/', searchApp);
  return app;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

interface SearchRow {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  createdAt: Date | null;
  rank: number;
}

function makeRows(count: number, overrides: Partial<SearchRow> = {}): SearchRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    title: `Title ${i}`,
    slug: `slug-${i}`,
    status: 'published',
    createdAt: new Date('2025-01-01'),
    rank: 1 - i * 0.1,
    ...overrides,
  }));
}

/** Wire up the select chain so offset() resolves to the given rows. */
function setupChain(rows: SearchRow[]) {
  mockSelectChain.from.mockReturnValue(mockSelectChain);
  mockSelectChain.where.mockReturnValue(mockSelectChain);
  mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
  mockSelectChain.limit.mockReturnValue(mockSelectChain);
  mockSelectChain.offset.mockResolvedValue(rows);
  mockDb.select.mockReturnValue(mockSelectChain);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('GET /search  -  input validation', () => {
  it('returns 400 when q is missing', async () => {
    const res = await createApp().request('/search');
    expect(res.status).toBe(400);
  });

  it('returns 400 when q is a single character', async () => {
    const res = await createApp().request('/search?q=a');
    expect(res.status).toBe(400);
  });

  it('returns 400 when q exceeds 200 characters', async () => {
    const long = 'a'.repeat(201);
    const res = await createApp().request(`/search?q=${long}`);
    expect(res.status).toBe(400);
  });

  it('accepts q at exactly 200 characters', async () => {
    setupChain([]);
    const exact = 'a'.repeat(200);
    const res = await createApp().request(`/search?q=${exact}&type=posts`);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid type value', async () => {
    const res = await createApp().request('/search?q=hello&type=invalid');
    expect(res.status).toBe(400);
  });

  it('accepts type=posts', async () => {
    setupChain([]);
    const res = await createApp().request('/search?q=hello&type=posts');
    expect(res.status).toBe(200);
  });

  it('accepts type=pages', async () => {
    setupChain([]);
    const res = await createApp().request('/search?q=hello&type=pages');
    expect(res.status).toBe(200);
  });

  it('accepts type=all', async () => {
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockReturnValue(mockSelectChain);
    mockSelectChain.offset.mockResolvedValue([]);
    mockDb.select.mockReturnValue(mockSelectChain);
    const res = await createApp().request('/search?q=hello&type=all');
    expect(res.status).toBe(200);
  });

  it('defaults to type=all when type is omitted', async () => {
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockReturnValue(mockSelectChain);
    mockSelectChain.offset.mockResolvedValue([]);
    mockDb.select.mockReturnValue(mockSelectChain);
    const res = await createApp().request('/search?q=hello');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.type).toBe('all');
  });
});

// ── type=posts ────────────────────────────────────────────────────────────────

describe('GET /search  -  type=posts', () => {
  it('returns results tagged as post', async () => {
    setupChain(makeRows(2));
    const res = await createApp().request('/search?q=hello&type=posts');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.results).toHaveLength(2);
    for (const r of body.results) {
      expect(r.type).toBe('post');
    }
  });

  it('queries only the posts table (one select call)', async () => {
    setupChain([]);
    await createApp().request('/search?q=hello&type=posts');
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });
});

// ── type=pages ────────────────────────────────────────────────────────────────

describe('GET /search  -  type=pages', () => {
  it('returns results tagged as page', async () => {
    setupChain(makeRows(3));
    const res = await createApp().request('/search?q=hello&type=pages');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.results).toHaveLength(3);
    for (const r of body.results) {
      expect(r.type).toBe('page');
    }
  });

  it('queries only the pages table (one select call)', async () => {
    setupChain([]);
    await createApp().request('/search?q=hello&type=pages');
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });
});

// ── type=all ──────────────────────────────────────────────────────────────────

describe('GET /search  -  type=all', () => {
  function setupDualChain(postRows: SearchRow[], pageRows: SearchRow[]) {
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockReturnValue(mockSelectChain);
    // First call → posts, second call → pages
    mockSelectChain.offset.mockResolvedValueOnce(postRows).mockResolvedValueOnce(pageRows);
    mockDb.select.mockReturnValue(mockSelectChain);
  }

  it('queries both posts and pages tables', async () => {
    setupDualChain([], []);
    await createApp().request('/search?q=hello&type=all');
    expect(mockDb.select).toHaveBeenCalledTimes(4);
  });

  it('merges results from both tables', async () => {
    const postRows = makeRows(2);
    const pageRows = makeRows(1, { rank: 0.99 });
    setupDualChain(postRows, pageRows);
    const res = await createApp().request('/search?q=hello&type=all');
    const body = await parseBody(res);
    expect(body.results).toHaveLength(3);
  });

  it('sorts merged results by rank descending', async () => {
    const postRows: SearchRow[] = [
      {
        id: 'p1',
        title: 'Post low',
        slug: 'p-low',
        status: 'published',
        createdAt: new Date(),
        rank: 0.3,
      },
    ];
    const pageRows: SearchRow[] = [
      {
        id: 'g1',
        title: 'Page high',
        slug: 'g-high',
        status: 'published',
        createdAt: new Date(),
        rank: 0.9,
      },
    ];
    setupDualChain(postRows, pageRows);
    const res = await createApp().request('/search?q=hello&type=all');
    const body = await parseBody(res);
    expect(body.results[0].type).toBe('page');
    expect(body.results[1].type).toBe('post');
  });
});

// ── Limit / offset ────────────────────────────────────────────────────────────

describe('GET /search  -  limit and offset', () => {
  it('defaults limit to 20 and offset to 0', async () => {
    setupChain([]);
    await createApp().request('/search?q=hello&type=posts');
    expect(mockSelectChain.limit).toHaveBeenCalledWith(20);
    expect(mockSelectChain.offset).toHaveBeenCalledWith(0);
  });

  it('accepts a custom limit', async () => {
    setupChain([]);
    await createApp().request('/search?q=hello&type=posts&limit=5');
    expect(mockSelectChain.limit).toHaveBeenCalledWith(5);
  });

  it('rejects limit above 100 with 400', async () => {
    const res = await createApp().request('/search?q=hello&type=posts&limit=999');
    expect(res.status).toBe(400);
  });

  it('rejects limit=0 with 400 (min is 1)', async () => {
    const res = await createApp().request('/search?q=hello&type=posts&limit=0');
    expect(res.status).toBe(400);
  });

  it('accepts a valid offset', async () => {
    setupChain([]);
    await createApp().request('/search?q=hello&type=posts&offset=40');
    expect(mockSelectChain.offset).toHaveBeenCalledWith(40);
  });

  it('rejects negative offset with 400', async () => {
    const res = await createApp().request('/search?q=hello&type=posts&offset=-10');
    expect(res.status).toBe(400);
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe('GET /search  -  response shape', () => {
  it('includes all required fields', async () => {
    setupChain(makeRows(1));
    const res = await createApp().request('/search?q=test&type=posts');
    const body = await parseBody(res);
    expect(body).toMatchObject({
      query: 'test',
      type: 'posts',
      results: expect.any(Array),
      totalDocs: expect.any(Number),
      totalPages: expect.any(Number),
      limit: expect.any(Number),
      offset: expect.any(Number),
    });
  });

  it('echoes back the query string', async () => {
    setupChain([]);
    const res = await createApp().request('/search?q=typescript&type=posts');
    const body = await parseBody(res);
    expect(body.query).toBe('typescript');
  });

  it('returns empty results with count 0 when no matches', async () => {
    setupChain([]);
    const res = await createApp().request('/search?q=notfound&type=posts');
    const body = await parseBody(res);
    expect(body.results).toHaveLength(0);
    expect(body.totalDocs).toBe(0);
  });

  it('result items include id, title, slug, status, type, rank fields', async () => {
    setupChain(makeRows(1));
    const res = await createApp().request('/search?q=hello&type=posts');
    const body = await parseBody(res);
    const item = body.results[0];
    expect(item).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      slug: expect.any(String),
      status: expect.any(String),
      type: 'post',
      rank: expect.any(Number),
    });
  });

  it('serializes createdAt as ISO string', async () => {
    setupChain(makeRows(1));
    const res = await createApp().request('/search?q=hello&type=posts');
    const body = await parseBody(res);
    expect(body.results[0].createdAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('serializes null title and slug as null in result items', async () => {
    setupChain(makeRows(1, { title: null, slug: null }));
    const res = await createApp().request('/search?q=hello&type=posts');
    const body = await parseBody(res);
    expect(body.results[0].title).toBeNull();
    expect(body.results[0].slug).toBeNull();
  });

  it('serializes null createdAt as null in result items', async () => {
    setupChain(makeRows(1, { createdAt: null }));
    const res = await createApp().request('/search?q=hello&type=posts');
    const body = await parseBody(res);
    expect(body.results[0].createdAt).toBeNull();
  });
});

// ── Boundary values ───────────────────────────────────────────────────────────

describe('GET /search  -  boundary values', () => {
  it('accepts q at exactly 2 characters (min boundary)', async () => {
    setupChain([]);
    const res = await createApp().request('/search?q=ab&type=posts');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.query).toBe('ab');
  });

  it('accepts limit=1 (min boundary)', async () => {
    setupChain([]);
    const res = await createApp().request('/search?q=hello&type=posts&limit=1');
    expect(res.status).toBe(200);
    expect(mockSelectChain.limit).toHaveBeenCalledWith(1);
  });

  it('accepts limit=100 (max boundary)', async () => {
    setupChain([]);
    const res = await createApp().request('/search?q=hello&type=posts&limit=100');
    expect(res.status).toBe(200);
    expect(mockSelectChain.limit).toHaveBeenCalledWith(100);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('GET /search  -  DB error propagation', () => {
  it('propagates as 500 when the posts query rejects', async () => {
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockReturnValue(mockSelectChain);
    mockSelectChain.offset.mockRejectedValue(new Error('connection timeout'));
    mockDb.select.mockReturnValue(mockSelectChain);

    const res = await createApp().request('/search?q=hello&type=posts');
    expect(res.status).toBe(500);
  });

  it('propagates as 500 when the pages query rejects', async () => {
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockReturnValue(mockSelectChain);
    mockSelectChain.offset.mockRejectedValue(new Error('connection timeout'));
    mockDb.select.mockReturnValue(mockSelectChain);

    const res = await createApp().request('/search?q=hello&type=pages');
    expect(res.status).toBe(500);
  });
});
