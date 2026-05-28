/**
 * Media Upload & Blob Lifecycle Tests
 *
 * Covers POST /media (upload), media list scoping (non-admin sees only own),
 * and blob cleanup on DELETE.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockMediaQueries, mockStorage } = vi.hoisted(() => ({
  mockMediaQueries: {
    getAllMedia: vi.fn(),
    createMedia: vi.fn(),
    getMediaById: vi.fn(),
    updateMedia: vi.fn(),
    deleteMedia: vi.fn(),
  },
  // Stand-in StorageProvider. media.ts depends only on the provider interface
  // (via getMediaStorage), so the concrete backend (R2 / Vercel Blob) is
  // irrelevant to these route tests.
  mockStorage: {
    provider: 'mock' as const,
    put: vi.fn(),
    del: vi.fn(),
    list: vi.fn(),
  },
}));

vi.mock('@revealui/db/queries/media', () => mockMediaQueries);
vi.mock('../../lib/storage.js', () => ({ getMediaStorage: () => mockStorage }));
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// Sites/pages/posts queries are pulled in transitively by contentApp  -  mock them too
vi.mock('@revealui/db/queries/posts', () => ({
  getAllPosts: vi.fn(),
  createPost: vi.fn(),
  getPostById: vi.fn(),
  getPostBySlug: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
}));
vi.mock('@revealui/db/queries/sites', () => ({
  getAllSites: vi.fn(),
  createSite: vi.fn(),
  getSiteById: vi.fn(),
  updateSite: vi.fn(),
  deleteSite: vi.fn(),
}));
vi.mock('@revealui/db/queries/pages', () => ({
  getAllPages: vi.fn(),
  getPagesBySite: vi.fn(),
  createPage: vi.fn(),
  getPageById: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
}));

// ─── Import under test ──────────────────────────────────────────────────────

import contentApp from '../content/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function makeUploadRequest(file: File, alt?: string): { method: string; body: FormData } {
  const form = new FormData();
  form.append('file', file);
  if (alt) form.append('alt', alt);
  return { method: 'POST', body: form };
}

function makeMediaRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'media-1',
    filename: 'image.png',
    mimeType: 'image/png',
    filesize: 1024,
    url: 'https://abc.blob.vercel-storage.com/media/uuid.png',
    alt: null,
    width: 800,
    height: 600,
    focalPoint: null,
    sizes: null,
    uploadedBy: USER_A.id,
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

// Magic-byte signatures the upload route validates (verifyMagicBytes). The route
// reads the first 16 bytes and rejects (400) any file whose leading bytes don't
// match its declared MIME type — so success-path fixtures must lead with a real
// signature, not arbitrary string content.
const MAGIC_BYTES: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // "%PDF-"
};

/** Build an upload File whose leading bytes are a valid signature for `type`. */
function makeFile(name: string, type: string): File {
  const sig = MAGIC_BYTES[type] ?? [];
  const bytes = new Uint8Array([...sig, 0x00, 0x00, 0x00, 0x00]);
  return new File([bytes], name, { type });
}

// ─── POST /media  -  Upload ────────────────────────────────────────────────────

describe('POST /media  -  upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.put.mockResolvedValue({
      key: 'media/uuid.png',
      url: 'https://abc.blob.vercel-storage.com/media/uuid.png',
      size: 12,
      provider: 'mock',
    });
    mockMediaQueries.createMedia.mockResolvedValue(makeMediaRecord());
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const res = await app.request('/media', makeUploadRequest(file));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is provided', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/media', {
      method: 'POST',
      body: new FormData(),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no file/i);
  });

  it('returns 400 for unsupported MIME type', async () => {
    const app = createApp(USER_A);
    const file = new File(['data'], 'malware.exe', { type: 'application/x-msdownload' });
    const res = await app.request('/media', makeUploadRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported file type/i);
  });

  it('accepts valid image MIME types', async () => {
    const app = createApp(USER_A);
    const file = makeFile('photo.jpeg', 'image/jpeg');
    const res = await app.request('/media', makeUploadRequest(file));
    expect(res.status).toBe(201);
  });

  it('accepts valid document MIME types', async () => {
    const app = createApp(USER_A);
    const file = makeFile('report.pdf', 'application/pdf');
    const res = await app.request('/media', makeUploadRequest(file));
    expect(res.status).toBe(201);
  });

  it('returns 413 when file exceeds size limit', async () => {
    const app = createApp(USER_A);
    // Image limit is 10MB = 10_485_760 bytes
    const bigData = new Uint8Array(10_485_761);
    const file = new File([bigData], 'huge.png', { type: 'image/png' });
    const res = await app.request('/media', makeUploadRequest(file));
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/file too large/i);
  });

  it('uploads to object storage with a unique media key', async () => {
    const app = createApp(USER_A);
    const file = makeFile('photo.png', 'image/png');
    await app.request('/media', makeUploadRequest(file));
    expect(mockStorage.put).toHaveBeenCalledWith(
      expect.stringMatching(/^media\/[a-f0-9-]+\.png$/),
      expect.any(File),
      expect.objectContaining({ access: 'public', contentType: 'image/png' }),
    );
  });

  it('creates DB record with user as uploader', async () => {
    const app = createApp(USER_A);
    const file = makeFile('photo.png', 'image/png');
    await app.request('/media', makeUploadRequest(file));
    expect(mockMediaQueries.createMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uploadedBy: USER_A.id }),
    );
  });

  it('passes alt text to DB record', async () => {
    const app = createApp(USER_A);
    const file = makeFile('photo.png', 'image/png');
    await app.request('/media', makeUploadRequest(file, 'A sunset'));
    expect(mockMediaQueries.createMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ alt: 'A sunset' }),
    );
  });

  it('returns 502 when the storage upload fails', async () => {
    mockStorage.put.mockRejectedValue(new Error('storage unavailable'));
    const app = createApp(USER_A);
    const file = makeFile('photo.png', 'image/png');
    const res = await app.request('/media', makeUploadRequest(file));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/failed to upload/i);
  });

  it('returns 201 with media data on success', async () => {
    const app = createApp(USER_A);
    const file = makeFile('photo.png', 'image/png');
    const res = await app.request('/media', makeUploadRequest(file));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('media-1');
  });
});

// ─── GET /media  -  List scoping ───────────────────────────────────────────────

describe('GET /media  -  list scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaQueries.getAllMedia.mockResolvedValue([]);
  });

  it('non-admin is scoped to own uploads (uploadedBy = user.id)', async () => {
    const app = createApp(USER_A);
    await app.request('/media');
    expect(mockMediaQueries.getAllMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uploadedBy: USER_A.id }),
    );
  });

  it('admin sees all uploads (uploadedBy = undefined)', async () => {
    const app = createApp(ADMIN);
    await app.request('/media');
    expect(mockMediaQueries.getAllMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uploadedBy: undefined }),
    );
  });

  it('passes mimeType filter to query', async () => {
    const app = createApp(USER_A);
    await app.request('/media?mimeType=image');
    expect(mockMediaQueries.getAllMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mimeType: 'image' }),
    );
  });

  it('passes pagination params', async () => {
    const app = createApp(USER_A);
    await app.request('/media?limit=10&offset=20');
    expect(mockMediaQueries.getAllMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });
});

// ─── DELETE /media  -  Blob cleanup ────────────────────────────────────────────

describe('DELETE /media/:id  -  object cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaQueries.deleteMedia.mockResolvedValue(undefined);
    mockStorage.del.mockResolvedValue(undefined);
  });

  it('deletes the stored object via the provider', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMediaRecord({ uploadedBy: USER_A.id }));
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockStorage.del).toHaveBeenCalledWith(
      'https://abc.blob.vercel-storage.com/media/uuid.png',
    );
  });

  it('delegates key extraction to the provider regardless of URL host', async () => {
    // The provider owns mapping a stored URL back to its key, so the route no
    // longer special-cases Vercel Blob hostnames (unlike the pre-R2 code).
    mockMediaQueries.getMediaById.mockResolvedValue(
      makeMediaRecord({ url: 'https://media.revealui.com/media/uuid.png', uploadedBy: USER_A.id }),
    );
    const app = createApp(USER_A);
    await app.request('/media/media-1', { method: 'DELETE' });
    expect(mockStorage.del).toHaveBeenCalledWith('https://media.revealui.com/media/uuid.png');
  });

  it('still deletes the DB record even if the storage delete fails', async () => {
    mockStorage.del.mockRejectedValue(new Error('storage error'));
    mockMediaQueries.getMediaById.mockResolvedValue(makeMediaRecord({ uploadedBy: USER_A.id }));
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockMediaQueries.deleteMedia).toHaveBeenCalledWith(expect.anything(), 'media-1');
  });
});

// ─── GET /media  -  auth ────────────────────────────────────────────────────────

describe('GET /media  -  auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaQueries.getAllMedia.mockResolvedValue([]);
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/media');
    expect(res.status).toBe(401);
  });
});

// ─── GET /media/:id  -  Single item retrieval ──────────────────────────────────

describe('GET /media/:id  -  single item', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/media/media-1');
    expect(res.status).toBe(401);
  });

  it('returns 200 with media data for own item', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMediaRecord({ uploadedBy: USER_A.id }));
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('media-1');
  });

  it('returns 404 when media not found', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(null);
    const app = createApp(USER_A);
    const res = await app.request('/media/nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 403 when non-admin accesses another user's media", async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(
      makeMediaRecord({ uploadedBy: 'other-user-id' }),
    );
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1');
    expect(res.status).toBe(403);
  });

  it("admin can read any user's media", async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMediaRecord({ uploadedBy: USER_A.id }));
    const app = createApp(ADMIN);
    const res = await app.request('/media/media-1');
    expect(res.status).toBe(200);
  });
});

// ─── PATCH /media/:id  -  Metadata update ──────────────────────────────────────

describe('PATCH /media/:id  -  metadata update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaQueries.getMediaById.mockResolvedValue(makeMediaRecord({ uploadedBy: USER_A.id }));
    mockMediaQueries.updateMedia.mockResolvedValue(makeMediaRecord({ alt: 'Updated alt' }));
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/media/media-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt: 'New alt' }),
    });
    expect(res.status).toBe(401);
  });

  it('updates alt text and returns 200', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt: 'Updated alt' }),
    });
    expect(res.status).toBe(200);
    expect(mockMediaQueries.updateMedia).toHaveBeenCalledWith(
      expect.anything(),
      'media-1',
      expect.objectContaining({ alt: 'Updated alt' }),
    );
  });

  it('updates focal point', async () => {
    mockMediaQueries.updateMedia.mockResolvedValue(
      makeMediaRecord({ focalPoint: { x: 0.5, y: 0.3 } }),
    );
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focalPoint: { x: 0.5, y: 0.3 } }),
    });
    expect(res.status).toBe(200);
    expect(mockMediaQueries.updateMedia).toHaveBeenCalledWith(
      expect.anything(),
      'media-1',
      expect.objectContaining({ focalPoint: { x: 0.5, y: 0.3 } }),
    );
  });

  it('returns 404 when media not found', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(null);
    const app = createApp(USER_A);
    const res = await app.request('/media/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt: 'test' }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-admin updates another user's media", async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(
      makeMediaRecord({ uploadedBy: 'other-user-id' }),
    );
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt: 'test' }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /media/:id  -  auth and access control ─────────────────────────────

describe('DELETE /media/:id  -  auth and access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaQueries.deleteMedia.mockResolvedValue(undefined);
    mockStorage.del.mockResolvedValue(undefined);
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/media/media-1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when media not found', async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(null);
    const app = createApp(USER_A);
    const res = await app.request('/media/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-admin deletes another user's media", async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(
      makeMediaRecord({ uploadedBy: 'other-user-id' }),
    );
    const app = createApp(USER_A);
    const res = await app.request('/media/media-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it("admin can delete any user's media", async () => {
    mockMediaQueries.getMediaById.mockResolvedValue(makeMediaRecord({ uploadedBy: USER_A.id }));
    const app = createApp(ADMIN);
    const res = await app.request('/media/media-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockMediaQueries.deleteMedia).toHaveBeenCalledWith(expect.anything(), 'media-1');
  });
});
