/**
 * Content Globals Route Tests
 *
 * Covers GET /globals/:slug (public, published read) and PATCH /globals/:slug
 * (RBAC content:update). The PATCH gate is the production `/api/content/*`
 * mount middleware (requirePermission('content','update')), replicated here so
 * the unauthenticated + under-privileged rejections are proven, not assumed.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockGlobalQueries } = vi.hoisted(() => ({
  mockGlobalQueries: {
    getGlobalHeader: vi.fn(),
    getGlobalFooter: vi.fn(),
    getGlobalSettings: vi.fn(),
    updateGlobalHeader: vi.fn(),
    updateGlobalFooter: vi.fn(),
    updateGlobalSettings: vi.fn(),
    isGlobalSlug: (v: string) => v === 'header' || v === 'footer' || v === 'settings',
    GLOBAL_SLUGS: ['header', 'footer', 'settings'] as const,
  },
}));

vi.mock('@revealui/db/queries/globals', () => mockGlobalQueries);

// ─── Import under test ────────────────────────────────────────────────────────

import { requirePermission } from '../../middleware/authorization.js';
import contentApp from '../content/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserCtx {
  id: string;
  role: string;
}

const EDITOR: UserCtx = { id: 'editor-1', role: 'editor' };
const AGENT: UserCtx = { id: 'agent-1', role: 'agent' };

/**
 * Mount contentApp behind the same content-mutation RBAC middleware the server
 * applies at `/api/content/*`, so PATCH auth is exercised end to end.
 */
function createApp(user: UserCtx | null) {
  const app = new Hono<{ Variables: { user: UserCtx | undefined; db: unknown } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('db', {});
    await next();
  });
  app.patch('*', requirePermission('content', 'update'));
  app.route('/', contentApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

function makeHeader(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    schemaVersion: '1',
    navItems: [{ label: 'Home', url: '/' }],
    logoId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    schemaVersion: '1',
    siteName: 'RevealUI',
    siteDescription: null,
    defaultMeta: null,
    contactEmail: null,
    contactPhone: null,
    socialProfiles: null,
    analyticsId: null,
    features: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function patch(app: ReturnType<typeof createApp>, slug: string, body: unknown) {
  return app.request(`/globals/${slug}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => vi.clearAllMocks());

// ─── GET (public, published) ────────────────────────────────────────────────

describe('GET /globals/:slug', () => {
  it('returns the header global to an unauthenticated caller', async () => {
    mockGlobalQueries.getGlobalHeader.mockResolvedValue(makeHeader());
    const res = await createApp(null).request('/globals/header');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('1');
    expect(body.data.navItems).toEqual([{ label: 'Home', url: '/' }]);
    expect(body.data.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('404s for an unknown slug', async () => {
    const res = await createApp(null).request('/globals/nope');
    expect(res.status).toBe(404);
    expect(mockGlobalQueries.getGlobalHeader).not.toHaveBeenCalled();
  });

  it('404s when the singleton row does not exist yet', async () => {
    mockGlobalQueries.getGlobalSettings.mockResolvedValue(undefined);
    const res = await createApp(null).request('/globals/settings');
    expect(res.status).toBe(404);
  });
});

// ─── PATCH (RBAC content:update) ────────────────────────────────────────────

describe('PATCH /globals/:slug', () => {
  it('rejects an unauthenticated PATCH with 401 and never writes', async () => {
    const res = await patch(createApp(null), 'header', { logoId: 'logo-1' });
    expect(res.status).toBe(401);
    expect(mockGlobalQueries.updateGlobalHeader).not.toHaveBeenCalled();
  });

  it('rejects a read-only agent role with 403 and never writes', async () => {
    const res = await patch(createApp(AGENT), 'header', { logoId: 'logo-1' });
    expect(res.status).toBe(403);
    expect(mockGlobalQueries.updateGlobalHeader).not.toHaveBeenCalled();
  });

  it('lets an editor update the header and returns the serialized row', async () => {
    mockGlobalQueries.updateGlobalHeader.mockResolvedValue(makeHeader({ logoId: 'logo-1' }));
    const res = await patch(createApp(EDITOR), 'header', { logoId: 'logo-1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.logoId).toBe('logo-1');
    expect(mockGlobalQueries.updateGlobalHeader).toHaveBeenCalledWith(expect.anything(), {
      logoId: 'logo-1',
    });
  });

  it('lets an editor update settings', async () => {
    mockGlobalQueries.updateGlobalSettings.mockResolvedValue(makeSettings({ siteName: 'Renamed' }));
    const res = await patch(createApp(EDITOR), 'settings', { siteName: 'Renamed' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.siteName).toBe('Renamed');
  });

  it('rejects a field that does not belong to the slug (strict validation) with 400', async () => {
    const res = await patch(createApp(EDITOR), 'header', { siteName: 'wrong-global' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(mockGlobalQueries.updateGlobalHeader).not.toHaveBeenCalled();
  });
});
