/**
 * Batch Operations API Route Tests
 *
 * Covers batch endpoints:
 *   POST /batch/create  — Batch create items (admin-only)
 *   POST /batch/update  — Batch update items (admin-only)
 *   POST /batch/delete  — Batch delete items (admin-only)
 *
 * Critical focus: auth enforcement, input validation, collection whitelist
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPostQueries, mockSiteQueries, mockPageQueries, mockMediaQueries } = vi.hoisted(() => ({
  mockPostQueries: {
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
  },
  mockSiteQueries: {
    createSite: vi.fn(),
    updateSite: vi.fn(),
    deleteSite: vi.fn(),
  },
  mockPageQueries: {
    createPage: vi.fn(),
    updatePage: vi.fn(),
    deletePage: vi.fn(),
  },
  mockMediaQueries: {
    createMedia: vi.fn(),
    updateMedia: vi.fn(),
    deleteMedia: vi.fn(),
  },
}));

vi.mock('@revealui/db/queries/posts', () => mockPostQueries);
vi.mock('@revealui/db/queries/sites', () => mockSiteQueries);
vi.mock('@revealui/db/queries/pages', () => mockPageQueries);
vi.mock('@revealui/db/queries/media', () => mockMediaQueries);

// ─── Import under test ───────────────────────────────────────────────────────

import batchApp from '../content/batch.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserCtx {
  id: string;
  role: string;
}

function buildApp(user: UserCtx | null = null) {
  const app = new Hono();

  app.use('*', async (c, next) => {
    c.set('db' as never, {} as never);
    c.set('user' as never, user as never);
    await next();
  });

  app.route('/', batchApp);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  return app;
}

const adminUser: UserCtx = { id: 'admin-1', role: 'admin' };
const regularUser: UserCtx = { id: 'user-1', role: 'user' };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Batch Operations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /batch/create ──────────────────────────────────────────────────

  describe('POST /batch/create', () => {
    it('creates items as admin', async () => {
      mockPostQueries.createPost.mockResolvedValue({ id: 'p1' });

      const app = buildApp(adminUser);
      const res = await app.request('/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'posts',
          items: [{ title: 'Test Post', slug: 'test-post' }],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.results).toHaveLength(1);
      expect(body.results[0].status).toBe('created');
    });

    it('rejects unauthenticated users', async () => {
      const app = buildApp(null);
      const res = await app.request('/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'posts', items: [{ title: 'x' }] }),
      });

      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const app = buildApp(regularUser);
      const res = await app.request('/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'posts', items: [{ title: 'x' }] }),
      });

      expect(res.status).toBe(403);
    });

    it('rejects invalid collection names', async () => {
      const app = buildApp(adminUser);
      const res = await app.request('/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'users', items: [{ name: 'x' }] }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid collection');
    });

    it('reports per-item errors without failing the batch', async () => {
      mockPostQueries.createPost
        .mockResolvedValueOnce({ id: 'p1' })
        .mockRejectedValueOnce(new Error('duplicate slug'));

      const app = buildApp(adminUser);
      const res = await app.request('/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'posts',
          items: [
            { title: 'Good', slug: 'good' },
            { title: 'Dup', slug: 'dup' },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe('created');
      expect(body.results[1].status).toBe('error');
      expect(body.results[1].error).toContain('duplicate slug');
    });
  });

  // ─── POST /batch/update ──────────────────────────────────────────────────

  describe('POST /batch/update', () => {
    it('updates items as admin', async () => {
      mockPostQueries.updatePost.mockResolvedValue({ id: 'p1', title: 'Updated' });

      const app = buildApp(adminUser);
      const res = await app.request('/batch/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'posts',
          items: [{ id: 'p1', title: 'Updated' }],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe('updated');
    });

    it('rejects non-admin users', async () => {
      const app = buildApp(regularUser);
      const res = await app.request('/batch/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'posts',
          items: [{ id: 'p1', title: 'x' }],
        }),
      });

      expect(res.status).toBe(403);
    });

    it('reports not-found items as errors', async () => {
      mockPostQueries.updatePost.mockResolvedValue(null);

      const app = buildApp(adminUser);
      const res = await app.request('/batch/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'posts',
          items: [{ id: 'nonexistent', title: 'x' }],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe('error');
      expect(body.results[0].error).toContain('not found');
    });
  });

  // ─── POST /batch/delete ──────────────────────────────────────────────────

  describe('POST /batch/delete', () => {
    it('deletes items as admin', async () => {
      mockPostQueries.deletePost.mockResolvedValue(undefined);

      const app = buildApp(adminUser);
      const res = await app.request('/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'posts',
          items: [{ id: 'p1' }],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe('deleted');
    });

    it('rejects unauthenticated users', async () => {
      const app = buildApp(null);
      const res = await app.request('/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'posts', items: [{ id: 'p1' }] }),
      });

      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const app = buildApp(regularUser);
      const res = await app.request('/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'posts', items: [{ id: 'p1' }] }),
      });

      expect(res.status).toBe(403);
    });

    it('reports per-item errors on delete failure', async () => {
      mockPostQueries.deletePost.mockRejectedValueOnce(new Error('FK constraint'));

      const app = buildApp(adminUser);
      const res = await app.request('/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'posts',
          items: [{ id: 'p1' }],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe('error');
      expect(body.results[0].error).toContain('FK constraint');
    });
  });
});
