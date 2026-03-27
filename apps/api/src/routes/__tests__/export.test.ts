/**
 * Export API Route Tests
 *
 * Covers:
 *   GET /export/:collection — Export collection data as JSON or CSV
 *
 * Critical focus: auth enforcement, sensitive field stripping, format handling
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPostQueries, mockSiteQueries, mockUserQueries, mockMediaQueries } = vi.hoisted(() => ({
  mockPostQueries: {
    getAllPosts: vi.fn(),
  },
  mockSiteQueries: {
    getAllSites: vi.fn(),
  },
  mockUserQueries: {
    getAllUsers: vi.fn(),
  },
  mockMediaQueries: {
    getAllMedia: vi.fn(),
  },
}));

vi.mock('@revealui/db/queries/posts', () => mockPostQueries);
vi.mock('@revealui/db/queries/sites', () => mockSiteQueries);
vi.mock('@revealui/db/queries/users', () => mockUserQueries);
vi.mock('@revealui/db/queries/media', () => mockMediaQueries);

// Mock pages table + drizzle operators for the pages query
const { mockPages } = vi.hoisted(() => ({
  mockPages: { status: 'status', deletedAt: 'deletedAt' },
}));

vi.mock('@revealui/db/schema', () => ({
  pages: mockPages,
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (col: unknown, val: unknown) => ({ col, val }),
  isNull: (col: unknown) => ({ isNull: col }),
}));

// ─── Import under test ───────────────────────────────────────────────────────

import exportApp from '../content/export.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserCtx {
  id: string;
  role: string;
}

function buildApp(user: UserCtx | null = null) {
  const app = new Hono();

  // Mock DB that supports db.select().from().where().limit()
  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };

  app.use('*', async (c, next) => {
    c.set('db' as never, mockDb as never);
    c.set('user' as never, user as never);
    await next();
  });

  app.route('/', exportApp);

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

describe('Export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Auth ────────────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('rejects unauthenticated users', async () => {
      const app = buildApp(null);
      const res = await app.request('/export/posts');

      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const app = buildApp(regularUser);
      const res = await app.request('/export/posts');

      expect(res.status).toBe(403);
    });
  });

  // ─── JSON Export ─────────────────────────────────────────────────────────

  describe('JSON Export', () => {
    it('exports posts as JSON by default', async () => {
      mockPostQueries.getAllPosts.mockResolvedValue([
        { id: 'p1', title: 'Post 1', status: 'published' },
        { id: 'p2', title: 'Post 2', status: 'draft' },
      ]);

      const app = buildApp(adminUser);
      const res = await app.request('/export/posts');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.collection).toBe('posts');
      expect(body.count).toBe(2);
      expect(body.data).toHaveLength(2);
    });

    it('exports sites with status filter', async () => {
      mockSiteQueries.getAllSites.mockResolvedValue([
        { id: 's1', name: 'Site 1', status: 'active' },
      ]);

      const app = buildApp(adminUser);
      const res = await app.request('/export/sites?status=active');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.collection).toBe('sites');
      expect(body.count).toBe(1);
    });

    it('serializes Date objects to ISO strings', async () => {
      const date = new Date('2026-01-15T12:00:00Z');
      mockPostQueries.getAllPosts.mockResolvedValue([{ id: 'p1', title: 'Test', createdAt: date }]);

      const app = buildApp(adminUser);
      const res = await app.request('/export/posts');

      const body = await res.json();
      expect(body.data[0].createdAt).toBe('2026-01-15T12:00:00.000Z');
    });

    it('strips sensitive fields from user exports', async () => {
      mockUserQueries.getAllUsers.mockResolvedValue([
        {
          id: 'u1',
          email: 'user@test.com',
          password: '$2b$12$hashedpassword',
          mfaSecret: 'JBSWY3DPEHPK3PXP',
          mfaBackupCodes: '["code1","code2"]',
          emailVerificationToken: 'tok-123',
          sshKeyFingerprint: 'SHA256:abc',
          role: 'admin',
        },
      ]);

      const app = buildApp(adminUser);
      const res = await app.request('/export/users');

      const body = await res.json();
      const user = body.data[0];
      expect(user.email).toBe('user@test.com');
      expect(user.role).toBe('admin');
      expect(user.password).toBeUndefined();
      expect(user.mfaSecret).toBeUndefined();
      expect(user.mfaBackupCodes).toBeUndefined();
      expect(user.emailVerificationToken).toBeUndefined();
      expect(user.sshKeyFingerprint).toBeUndefined();
    });
  });

  // ─── CSV Export ──────────────────────────────────────────────────────────

  describe('CSV Export', () => {
    it('exports posts as CSV', async () => {
      mockPostQueries.getAllPosts.mockResolvedValue([
        { id: 'p1', title: 'Hello World', status: 'published' },
      ]);

      const app = buildApp(adminUser);
      const res = await app.request('/export/posts?format=csv');

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');
      expect(res.headers.get('Content-Disposition')).toContain('attachment');
      expect(res.headers.get('Content-Disposition')).toContain('.csv');

      const csv = await res.text();
      expect(csv).toContain('id,title,status');
      expect(csv).toContain('p1,Hello World,published');
    });

    it('returns empty string for empty collection CSV export', async () => {
      mockPostQueries.getAllPosts.mockResolvedValue([]);

      const app = buildApp(adminUser);
      const res = await app.request('/export/posts?format=csv');

      expect(res.status).toBe(200);
      const csv = await res.text();
      expect(csv).toBe('');
    });
  });

  // ─── Validation ──────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('rejects invalid collection names', async () => {
      const app = buildApp(adminUser);
      const res = await app.request('/export/tickets');

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid collection');
    });

    it('returns empty data for collection with no rows', async () => {
      mockMediaQueries.getAllMedia.mockResolvedValue([]);

      const app = buildApp(adminUser);
      const res = await app.request('/export/media');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(0);
      expect(body.data).toEqual([]);
    });
  });
});
