/**
 * Content API Route Tests
 *
 * Covers Posts, Media, and Sites CRUD endpoints.
 * Critical focus: authentication enforcement and IDOR prevention
 * (non-admin users must not access other users' resources).
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock() factories are hoisted to the top of the file by Vitest before any
// const/let declarations are initialized (temporal dead zone). Use vi.hoisted()
// so the mock objects are created in the same hoisted scope as the factories.

const { mockPostQueries, mockMediaQueries, mockSiteQueries, mockPageQueries } = vi.hoisted(() => ({
  mockPostQueries: {
    getAllPosts: vi.fn(),
    createPost: vi.fn(),
    getPostById: vi.fn(),
    getPostBySlug: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
  },
  mockMediaQueries: {
    getAllMedia: vi.fn(),
    getMediaById: vi.fn(),
    updateMedia: vi.fn(),
    deleteMedia: vi.fn(),
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
    updatePage: vi.fn(),
    deletePage: vi.fn(),
  },
}));

vi.mock('@revealui/db/queries/posts', () => mockPostQueries);
vi.mock('@revealui/db/queries/media', () => mockMediaQueries);
vi.mock('@revealui/db/queries/sites', () => mockSiteQueries);
vi.mock('@revealui/db/queries/pages', () => mockPageQueries);

// ─── Import under test ────────────────────────────────────────────────────────

import contentApp from '../content.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserCtx {
  id: string;
  role: string;
  email?: string;
}

const ADMIN: UserCtx = { id: 'admin-1', role: 'admin', email: 'admin@example.com' };
const USER_A: UserCtx = { id: 'user-a', role: 'user' };
const USER_B: UserCtx = { id: 'user-b', role: 'user' };

/** Build a test app that injects the given user into context and mounts contentApp. */
function createApp(user: UserCtx | null = ADMIN) {
  const app = new Hono<{ Variables: { user: UserCtx | undefined; db: unknown } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('db', {}); // content.ts passes db to query functions, which are mocked
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

function makeMedia(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'media-1',
    filename: 'image.png',
    mimeType: 'image/png',
    filesize: 1024,
    url: 'https://cdn.example.com/image.png',
    alt: null,
    width: 800,
    height: 600,
    focalPoint: null,
    sizes: null,
    uploadedBy: USER_A.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

// ─── Post Tests ───────────────────────────────────────────────────────────────

describe('GET /posts — list posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostQueries.getAllPosts.mockResolvedValue([]);
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/posts');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no posts', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/posts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('non-admin user is scoped to their own posts (effectiveAuthorId = user.id)', async () => {
    const app = createApp(USER_A);
    await app.request('/posts');
    expect(mockPostQueries.getAllPosts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authorId: USER_A.id }),
    );
  });

  it("admin can list any user's posts (no authorId filter when not specified)", async () => {
    const app = createApp(ADMIN);
    await app.request('/posts');
    expect(mockPostQueries.getAllPosts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authorId: undefined }),
    );
  });

  it('respects pagination params', async () => {
    const app = createApp(ADMIN);
    await app.request('/posts?limit=10&offset=20');
    expect(mockPostQueries.getAllPosts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });

  it('returns the posts returned by the query', async () => {
    const posts = [makePost(), makePost({ id: 'post-2', slug: 'hello-2' })];
    mockPostQueries.getAllPosts.mockResolvedValue(posts);
    const app = createApp(ADMIN);
    const res = await app.request('/posts');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('post-1');
  });
});

describe('POST /posts — create post', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Post', slug: 'new-post' }),
    });
    expect(res.status).toBe(401);
  });

  it('creates a post and returns 201', async () => {
    const created = makePost({ title: 'New Post', slug: 'new-post' });
    mockPostQueries.createPost.mockResolvedValue(created);
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Post', slug: 'new-post' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('post-1');
  });

  it('rejects missing title (validation)', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'no-title' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects title exceeding 500 chars', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'a'.repeat(501), slug: 'test' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('GET /posts/:id — get post by ID (IDOR)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    mockPostQueries.getPostById.mockResolvedValue(makePost());
    const res = await app.request('/posts/post-1');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent post', async () => {
    mockPostQueries.getPostById.mockResolvedValue(null);
    const app = createApp(USER_A);
    const res = await app.request('/posts/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns post to its author', async () => {
    mockPostQueries.getPostById.mockResolvedValue(makePost({ authorId: USER_A.id }));
    const app = createApp(USER_A);
    const res = await app.request('/posts/post-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('post-1');
  });

  it("returns 403 when non-admin accesses another user's post (IDOR)", async () => {
    mockPostQueries.getPostById.mockResolvedValue(makePost({ authorId: USER_B.id }));
    const app = createApp(USER_A); // USER_A tries to read USER_B's post
    const res = await app.request('/posts/post-1');
    expect(res.status).toBe(403);
  });

  it("admin can read any user's post", async () => {
    mockPostQueries.getPostById.mockResolvedValue(makePost({ authorId: USER_B.id }));
    const app = createApp(ADMIN);
    const res = await app.request('/posts/post-1');
    expect(res.status).toBe(200);
  });
});

describe('GET /posts/slug/:slug — get post by slug (IDOR)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/posts/slug/hello');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown slug', async () => {
    mockPostQueries.getPostBySlug.mockResolvedValue(null);
    const app = createApp(USER_A);
    const res = await app.request('/posts/slug/unknown');
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-admin accesses another user's post via slug (IDOR)", async () => {
    mockPostQueries.getPostBySlug.mockResolvedValue(makePost({ authorId: USER_B.id }));
    const app = createApp(USER_A);
    const res = await app.request('/posts/slug/hello');
    expect(res.status).toBe(403);
  });

  it('admin can read via slug regardless of author', async () => {
    mockPostQueries.getPostBySlug.mockResolvedValue(makePost({ authorId: USER_B.id }));
    const app = createApp(ADMIN);
    const res = await app.request('/posts/slug/hello');
    expect(res.status).toBe(200);
  });
});

describe('PATCH /posts/:id — update post (IDOR)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/posts/post-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 if post does not exist', async () => {
    mockPostQueries.getPostById.mockResolvedValue(null);
    const app = createApp(USER_A);
    const res = await app.request('/posts/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-admin tries to update another user's post (IDOR)", async () => {
    mockPostQueries.getPostById.mockResolvedValue(makePost({ authorId: USER_B.id }));
    const app = createApp(USER_A);
    const res = await app.request('/posts/post-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hijacked' }),
    });
    expect(res.status).toBe(403);
    expect(mockPostQueries.updatePost).not.toHaveBeenCalled();
  });

  it('allows author to update their own post', async () => {
    const post = makePost({ authorId: USER_A.id });
    mockPostQueries.getPostById.mockResolvedValue(post);
    mockPostQueries.updatePost.mockResolvedValue({ ...post, title: 'Updated' });
    const app = createApp(USER_A);
    const res = await app.request('/posts/post-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe('Updated');
  });

  it('admin can update any post', async () => {
    const post = makePost({ authorId: USER_B.id });
    mockPostQueries.getPostById.mockResolvedValue(post);
    mockPostQueries.updatePost.mockResolvedValue({ ...post, title: 'Admin Updated' });
    const app = createApp(ADMIN);
    const res = await app.request('/posts/post-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Admin Updated' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /posts/:id (IDOR)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/posts/post-1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 404 if post does not exist', async () => {
    mockPostQueries.getPostById.mockResolvedValue(null);
    const app = createApp(USER_A);
    const res = await app.request('/posts/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-admin tries to delete another user's post (IDOR)", async () => {
    mockPostQueries.getPostById.mockResolvedValue(makePost({ authorId: USER_B.id }));
    const app = createApp(USER_A);
    const res = await app.request('/posts/post-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
    expect(mockPostQueries.deletePost).not.toHaveBeenCalled();
  });

  it('allows author to delete their own post', async () => {
    mockPostQueries.getPostById.mockResolvedValue(makePost({ authorId: USER_A.id }));
    mockPostQueries.deletePost.mockResolvedValue(undefined);
    const app = createApp(USER_A);
    const res = await app.request('/posts/post-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockPostQueries.deletePost).toHaveBeenCalledWith(expect.anything(), 'post-1');
  });

  it('admin can delete any post', async () => {
    mockPostQueries.getPostById.mockResolvedValue(makePost({ authorId: USER_B.id }));
    mockPostQueries.deletePost.mockResolvedValue(undefined);
    const app = createApp(ADMIN);
    const res = await app.request('/posts/post-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});

// ─── Media Tests ──────────────────────────────────────────────────────────────

describe('GET /media — list media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaQueries.getAllMedia.mockResolvedValue([]);
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/media');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no media', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/media');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe('GET /media/:id — get media by ID (IDOR)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when non-admin accesses another user's media (IDOR)", async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMedia({ uploadedBy: USER_B.id }));
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1');
    expect(res.status).toBe(403);
  });

  it('returns media to its uploader', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMedia({ uploadedBy: USER_A.id }));
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1');
    expect(res.status).toBe(200);
  });

  it('admin can access any media', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMedia({ uploadedBy: USER_B.id }));
    const app = createApp(ADMIN);
    const res = await app.request('/media/media-1');
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent media', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(null);
    const app = createApp(USER_A);
    const res = await app.request('/media/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /media/:id — update media metadata (IDOR)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when non-admin updates another user's media (IDOR)", async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMedia({ uploadedBy: USER_B.id }));
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt: 'Hijacked alt text' }),
    });
    expect(res.status).toBe(403);
    expect(mockMediaQueries.updateMedia).not.toHaveBeenCalled();
  });

  it('allows uploader to update their own media', async () => {
    const item = makeMedia({ uploadedBy: USER_A.id });
    mockMediaQueries.getMediaById.mockResolvedValue(item);
    mockMediaQueries.updateMedia.mockResolvedValue({ ...item, alt: 'New alt' });
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt: 'New alt' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /media/:id (IDOR)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when non-admin deletes another user's media (IDOR)", async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMedia({ uploadedBy: USER_B.id }));
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
    expect(mockMediaQueries.deleteMedia).not.toHaveBeenCalled();
  });

  it('allows uploader to delete their own media', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMedia({ uploadedBy: USER_A.id }));
    mockMediaQueries.deleteMedia.mockResolvedValue(undefined);
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  it('admin can delete any media', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMedia({ uploadedBy: USER_B.id }));
    mockMediaQueries.deleteMedia.mockResolvedValue(undefined);
    const app = createApp(ADMIN);
    const res = await app.request('/media/media-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});

// ─── Site Tests ───────────────────────────────────────────────────────────────

describe('GET /sites — list sites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSiteQueries.getAllSites.mockResolvedValue([]);
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/sites');
    expect(res.status).toBe(401);
  });

  it("scopes results to the authenticated user's sites", async () => {
    const app = createApp(USER_A);
    await app.request('/sites');
    expect(mockSiteQueries.getAllSites).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerId: USER_A.id }),
    );
  });

  it('returns sites list', async () => {
    mockSiteQueries.getAllSites.mockResolvedValue([makeSite()]);
    const app = createApp(USER_A);
    const res = await app.request('/sites');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('site-1');
  });
});

describe('POST /sites — create site', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', slug: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('creates a site with the authenticated user as owner', async () => {
    const site = makeSite({ ownerId: USER_A.id });
    mockSiteQueries.createSite.mockResolvedValue(site);
    const app = createApp(USER_A);
    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Site', slug: 'my-site' }),
    });
    expect(res.status).toBe(201);
    expect(mockSiteQueries.createSite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerId: USER_A.id }),
    );
  });

  it('rejects missing name (validation)', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'no-name' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
