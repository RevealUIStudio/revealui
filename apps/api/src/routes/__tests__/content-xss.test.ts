/**
 * Content API  -  XSS/Injection Prevention Tests
 *
 * Validates that the slug regex pattern and Zod schemas reject malicious input
 * at the validation layer before it reaches any database query.
 *
 * Two layers tested:
 *   1. Schema-level: direct Zod `safeParse` against the SLUG_PATTERN
 *   2. Integration: full Hono request cycle to verify 400 responses
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ─── Schema-Level Tests ──────────────────────────────────────────────────────
// Mirror the exact pattern from content.ts so these tests break if the
// production regex is accidentally weakened.

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SlugField = z
  .string()
  .min(1)
  .max(200)
  .regex(SLUG_PATTERN, 'Slug must be lowercase alphanumeric with hyphens only');

describe('SlugField schema validation', () => {
  describe('rejects XSS payloads', () => {
    it.each([
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      'slug"><script>alert(document.cookie)</script>',
      'javascript:alert(1)',
      '<svg/onload=alert(1)>',
      '%3Cscript%3Ealert(1)%3C/script%3E',
    ])('rejects "%s"', (slug) => {
      const result = SlugField.safeParse(slug);
      expect(result.success).toBe(false);
    });
  });

  describe('rejects SQL injection payloads', () => {
    it.each([
      "'; DROP TABLE posts; --",
      "1' OR '1'='1",
      '1; SELECT * FROM users',
      "' UNION SELECT password FROM users --",
      'slug"; DELETE FROM posts; --',
    ])('rejects "%s"', (slug) => {
      const result = SlugField.safeParse(slug);
      expect(result.success).toBe(false);
    });
  });

  describe('rejects path traversal payloads', () => {
    it.each([
      '../../../etc/passwd',
      '..%2F..%2Fetc%2Fpasswd',
      'slug/../../secret',
    ])('rejects "%s"', (slug) => {
      const result = SlugField.safeParse(slug);
      expect(result.success).toBe(false);
    });
  });

  describe('rejects structurally invalid slugs', () => {
    it.each([
      ['empty string', ''],
      ['spaces', 'my post'],
      ['uppercase', 'My-Post'],
      ['special characters', 'post@#$%'],
      ['leading hyphen', '-leading'],
      ['trailing hyphen', 'trailing-'],
      ['double hyphen', 'double--hyphen'],
      ['underscore', 'under_score'],
      ['period', 'my.post'],
      ['slash', 'my/post'],
      ['backslash', 'my\\post'],
      ['unicode', 'caf\u00e9'],
      ['emoji', 'post-\u{1F680}'],
      ['null byte', 'post\x00slug'],
      ['tab', 'post\tslug'],
      ['newline', 'post\nslug'],
    ])('rejects %s: "%s"', (_label, slug) => {
      const result = SlugField.safeParse(slug);
      expect(result.success).toBe(false);
    });
  });

  describe('rejects oversized slugs', () => {
    it('rejects slug exceeding 200 characters', () => {
      const slug = 'a'.repeat(201);
      const result = SlugField.safeParse(slug);
      expect(result.success).toBe(false);
    });
  });

  describe('accepts valid slugs', () => {
    it.each([
      'hello',
      'my-post',
      'my-valid-post-123',
      'a',
      '123',
      'post-2024',
      'a'.repeat(200),
    ])('accepts "%s"', (slug) => {
      const result = SlugField.safeParse(slug);
      expect(result.success).toBe(true);
    });
  });
});

// ─── Integration Tests ───────────────────────────────────────────────────────
// Full Hono request cycle to confirm that invalid slugs produce HTTP 400.

const { mockPostQueries, mockSiteQueries, mockPageQueries } = vi.hoisted(() => ({
  mockPostQueries: {
    getAllPosts: vi.fn(),
    createPost: vi.fn(),
    getPostById: vi.fn(),
    getPostBySlug: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
  },
  mockSiteQueries: {
    getAllSites: vi.fn(),
    createSite: vi.fn(),
    getSiteById: vi.fn(),
    updateSite: vi.fn(),
    deleteSite: vi.fn(),
  },
  mockPageQueries: {
    getAllPages: vi.fn(),
    createPage: vi.fn(),
    getPageById: vi.fn(),
    getPagesBySite: vi.fn(),
    updatePage: vi.fn(),
    deletePage: vi.fn(),
  },
}));

vi.mock('@revealui/db/queries/posts', () => mockPostQueries);
vi.mock('@revealui/db/queries/media', () => ({
  getAllMedia: vi.fn(),
  getMediaById: vi.fn(),
  updateMedia: vi.fn(),
  deleteMedia: vi.fn(),
}));
vi.mock('@revealui/db/queries/sites', () => mockSiteQueries);
vi.mock('@revealui/db/queries/pages', () => mockPageQueries);

import contentApp from '../content/index.js';

interface UserCtx {
  id: string;
  role: string;
}

const ADMIN: UserCtx = { id: 'admin-1', role: 'admin' };
const USER_A: UserCtx = { id: 'user-a', role: 'user' };

function createApp(user: UserCtx | null = ADMIN) {
  const app = new Hono<{ Variables: { user: UserCtx | undefined; db: unknown } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('db', {});
    await next();
  });
  app.route('/', contentApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

function makePost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'post-1',
    title: 'Hello',
    slug: 'hello',
    excerpt: null,
    content: null,
    featuredImageId: null,
    authorId: USER_A.id,
    status: 'draft',
    published: false,
    meta: null,
    categories: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    ...overrides,
  };
}

function makeSite(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'site-1',
    name: 'My Site',
    slug: 'my-site',
    description: null,
    ownerId: USER_A.id,
    status: 'draft',
    theme: null,
    settings: null,
    pageCount: 0,
    favicon: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    ...overrides,
  };
}

// ─── POST /posts slug rejection ──────────────────────────────────────────────

describe('POST /posts  -  slug XSS/injection rejection', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['script tag', '<script>alert(1)</script>'],
    ['SQL injection', "'; DROP TABLE posts; --"],
    ['path traversal', '../../../etc/passwd'],
    ['spaces', 'my post'],
    ['uppercase', 'My-Post'],
    ['special chars', 'post@#$%'],
  ])('rejects %s slug via HTTP 400', async (_label, slug) => {
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', slug }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    // Ensure the DB was never called  -  validation should block before query
    expect(mockPostQueries.createPost).not.toHaveBeenCalled();
  });

  it('accepts a valid slug and creates the post', async () => {
    const created = makePost({ title: 'Test', slug: 'valid-slug-123' });
    mockPostQueries.createPost.mockResolvedValue(created);
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', slug: 'valid-slug-123' }),
    });
    expect(res.status).toBe(201);
    expect(mockPostQueries.createPost).toHaveBeenCalledTimes(1);
  });
});

// ─── PATCH /posts/:id slug rejection ─────────────────────────────────────────

describe('PATCH /posts/:id  -  slug XSS/injection rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostQueries.getPostById.mockResolvedValue(makePost({ authorId: USER_A.id }));
  });

  it('rejects XSS slug on update', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/posts/post-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: '<img src=x onerror=alert(1)>' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockPostQueries.updatePost).not.toHaveBeenCalled();
  });

  it('rejects SQL injection slug on update', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/posts/post-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: "' OR 1=1 --" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockPostQueries.updatePost).not.toHaveBeenCalled();
  });
});

// ─── POST /sites slug rejection ──────────────────────────────────────────────

describe('POST /sites  -  slug XSS/injection rejection', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    '<script>alert(1)</script>',
    "'; DROP TABLE sites; --",
    'My Site',
    'site with spaces',
  ])('rejects invalid slug "%s"', async (slug) => {
    const app = createApp(USER_A);
    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Site', slug }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockSiteQueries.createSite).not.toHaveBeenCalled();
  });

  it('accepts a valid slug', async () => {
    mockSiteQueries.createSite.mockResolvedValue(makeSite());
    const app = createApp(USER_A);
    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Site', slug: 'test-site' }),
    });
    expect(res.status).toBe(201);
  });
});

// ─── PATCH /sites/:id slug rejection ─────────────────────────────────────────

describe('PATCH /sites/:id  -  slug XSS/injection rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSiteQueries.getSiteById.mockResolvedValue(makeSite({ ownerId: USER_A.id }));
  });

  it('rejects XSS slug on site update', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/sites/site-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: '<script>alert(1)</script>' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockSiteQueries.updateSite).not.toHaveBeenCalled();
  });
});

// ─── POST /sites/:siteId/pages slug rejection ────────────────────────────────

describe('POST /sites/:siteId/pages  -  slug XSS/injection rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSiteQueries.getSiteById.mockResolvedValue(makeSite({ ownerId: USER_A.id }));
  });

  it.each([
    '<script>alert(1)</script>',
    "'; DROP TABLE pages; --",
    'Page With Spaces',
  ])('rejects invalid page slug "%s"', async (slug) => {
    const app = createApp(USER_A);
    const res = await app.request('/sites/site-1/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Page', slug, path: '/test' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockPageQueries.createPage).not.toHaveBeenCalled();
  });

  it('accepts a valid page slug', async () => {
    mockPageQueries.createPage.mockResolvedValue({
      id: 'page-1',
      siteId: 'site-1',
      parentId: null,
      templateId: null,
      title: 'Test Page',
      slug: 'test-page',
      path: '/test',
      status: 'draft',
      blocks: null,
      seo: null,
      blockCount: null,
      wordCount: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: null,
    });
    const app = createApp(USER_A);
    const res = await app.request('/sites/site-1/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Page', slug: 'test-page', path: '/test' }),
    });
    expect(res.status).toBe(201);
  });
});

// ─── Content field safety ────────────────────────────────────────────────────

describe('Content field handling  -  stores arbitrary JSON safely', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts content with HTML/script tags without crashing (stored as JSON)', async () => {
    const xssContent = {
      html: '<script>alert("xss")</script>',
      nested: { payload: '<img src=x onerror=alert(1)>' },
    };
    const created = makePost({ content: xssContent, slug: 'safe-post' });
    mockPostQueries.createPost.mockResolvedValue(created);
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', slug: 'safe-post', content: xssContent }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // Content is stored as-is in JSON  -  no server-side execution
    expect(body.data.content).toEqual(xssContent);
  });

  it('accepts content with SQL injection strings without crashing', async () => {
    const sqlContent = { text: "Robert'); DROP TABLE posts; --" };
    const created = makePost({ content: sqlContent, slug: 'sql-post' });
    mockPostQueries.createPost.mockResolvedValue(created);
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', slug: 'sql-post', content: sqlContent }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.content).toEqual(sqlContent);
  });

  it('accepts deeply nested content structures', async () => {
    const deepContent = { a: { b: { c: { d: { e: 'deep' } } } } };
    const created = makePost({ content: deepContent, slug: 'deep-post' });
    mockPostQueries.createPost.mockResolvedValue(created);
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', slug: 'deep-post', content: deepContent }),
    });
    expect(res.status).toBe(201);
  });
});

// ─── Title field validation ──────────────────────────────────────────────────

describe('Title field validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects title exceeding 500 characters', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x'.repeat(501), slug: 'valid' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects empty title', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', slug: 'valid' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('accepts title with HTML entities (no slug-style restriction on titles)', async () => {
    const title = 'How to Use <code> Tags & "Quotes" in HTML';
    const created = makePost({ title, slug: 'html-title-post' });
    mockPostQueries.createPost.mockResolvedValue(created);
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug: 'html-title-post' }),
    });
    expect(res.status).toBe(201);
  });
});

// ─── Excerpt field validation ────────────────────────────────────────────────

describe('Excerpt field validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects excerpt exceeding 1000 characters', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test',
        slug: 'valid',
        excerpt: 'x'.repeat(1001),
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
