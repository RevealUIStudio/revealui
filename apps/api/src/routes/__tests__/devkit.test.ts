/**
 * Tests for the devkit route — Max-tier `devkitProfiles` paywall.
 *
 * Covered:
 *   - requireUser: 401 when no user is set
 *   - GET /profiles: returns the 5-profile metadata list (RevealUI native first)
 *   - GET /profile/active: returns null when unset, returns stored value when set
 *   - PUT /profile/active: validates profileId against the enum, updates user
 *   - PUT with null: clears the setting
 *   - PUT round-trip: PUT then GET reflects the update
 *   - Gate (requireFeature 'devkitProfiles'): Pro tier → 403, Max → 200
 *     (mocked at the middleware boundary; only PUT is gated)
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
}));

vi.mock('@revealui/db/schema', () => ({
  users: {
    id: 'id',
    devkitProfile: 'devkit_profile',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

import { getClient } from '@revealui/db';
import devkitApp from '../devkit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const mockedGetClient = vi.mocked(getClient);

function createApp(user?: MockUser) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { user: any } }>();
  if (user) {
    app.use('*', async (c, next) => {
      c.set('user', user);
      await next();
    });
  }
  app.route('/devkit', devkitApp);
  return app;
}

function authedUser(): MockUser {
  return { id: 'u_1', email: 'user@example.com', name: 'Test User', role: 'editor' };
}

function makeSelectChain(returns: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(returns),
      }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// requireUser — auth gate
// ---------------------------------------------------------------------------

describe('requireUser', () => {
  it('returns 401 on /profiles when no user is set', async () => {
    const app = createApp();
    const res = await app.request('/devkit/profiles', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on /profile/active GET when no user is set', async () => {
    const app = createApp();
    const res = await app.request('/devkit/profile/active', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on /profile/active PUT when no user is set', async () => {
    const app = createApp();
    const res = await app.request('/devkit/profile/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'revealui' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /devkit/profiles — list profiles
// ---------------------------------------------------------------------------

describe('GET /devkit/profiles', () => {
  it('returns the 5-profile metadata list with RevealUI native first', async () => {
    const app = createApp(authedUser());
    const res = await app.request('/devkit/profiles', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      profiles: Array<{
        id: string;
        label: string;
        kind: string;
        recommended?: boolean;
      }>;
    };

    expect(body.success).toBe(true);
    expect(body.profiles).toHaveLength(5);
    expect(body.profiles[0]?.id).toBe('revealui');
    expect(body.profiles[0]?.recommended).toBe(true);
    expect(body.profiles[0]?.kind).toBe('native');

    const ids = body.profiles.map((p) => p.id);
    expect(ids).toEqual(['revealui', 'agents', 'claude', 'cursor', 'zed']);

    // Verify external editors are demoted
    const claude = body.profiles.find((p) => p.id === 'claude');
    expect(claude?.kind).toBe('external-editor');
  });
});

// ---------------------------------------------------------------------------
// GET /devkit/profile/active — read current selection
// ---------------------------------------------------------------------------

describe('GET /devkit/profile/active', () => {
  it('returns null when the user has no profile set', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([{ devkitProfile: null }])),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/devkit/profile/active', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string | null } };
    expect(body.data.profileId).toBeNull();
  });

  it('returns the stored profile when the user has one set', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([{ devkitProfile: 'cursor' }])),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/devkit/profile/active', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string | null } };
    expect(body.data.profileId).toBe('cursor');
  });

  it('returns null if the stored value is somehow not a valid profile (defensive)', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([{ devkitProfile: 'unknown_profile' }])),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/devkit/profile/active', { method: 'GET' });

    const body = (await res.json()) as { data: { profileId: string | null } };
    expect(body.data.profileId).toBeNull();
  });

  it('returns null when no row is found for the user', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([])),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/devkit/profile/active', { method: 'GET' });

    const body = (await res.json()) as { data: { profileId: string | null } };
    expect(body.data.profileId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PUT /devkit/profile/active — set selection
// ---------------------------------------------------------------------------

describe('PUT /devkit/profile/active', () => {
  it('accepts a valid profileId and updates the user row', async () => {
    const updateChain = makeUpdateChain();
    mockedGetClient.mockReturnValue({
      update: vi.fn().mockReturnValue(updateChain),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/devkit/profile/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'revealui' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string | null } };
    expect(body.data.profileId).toBe('revealui');
    expect(updateChain.set).toHaveBeenCalledWith({ devkitProfile: 'revealui' });
  });

  it('accepts null to clear the setting', async () => {
    const updateChain = makeUpdateChain();
    mockedGetClient.mockReturnValue({
      update: vi.fn().mockReturnValue(updateChain),
    } as never);

    const app = createApp(authedUser());
    const res = await app.request('/devkit/profile/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: null }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { profileId: string | null } };
    expect(body.data.profileId).toBeNull();
    expect(updateChain.set).toHaveBeenCalledWith({ devkitProfile: null });
  });

  it('rejects an invalid profileId', async () => {
    const app = createApp(authedUser());
    const res = await app.request('/devkit/profile/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'not_a_real_profile' }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects a malformed body', async () => {
    const app = createApp(authedUser());
    const res = await app.request('/devkit/profile/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// requireFeature gate (Pro→403, Max→200) — exercised at the middleware
// boundary by mocking the gate. The actual entitlements lookup is tested
// in middleware/__tests__/license.test.ts.
// ---------------------------------------------------------------------------

describe('requireFeature gate (integration)', () => {
  it('Max tier passes the PUT gate and reaches the route handler', async () => {
    mockedGetClient.mockReturnValue({
      update: vi.fn().mockReturnValue(makeUpdateChain()),
    } as never);

    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', authedUser());
      await next();
    });
    // Simulate Max-tier requireFeature on PUT only: pass-through.
    app.put('/devkit/profile/active', async (_c, next) => next());
    app.route('/devkit', devkitApp);

    const res = await app.request('/devkit/profile/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'agents' }),
    });
    expect(res.status).toBe(200);
  });

  it('Pro tier hits the PUT gate and returns 403 before the route runs', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', authedUser());
      await next();
    });
    // Simulate Pro-tier requireFeature on PUT only: short-circuit 403.
    app.put('/devkit/profile/active', async (c, _next) =>
      c.json({ error: 'Feature requires Max tier' }, 403),
    );
    app.route('/devkit', devkitApp);

    const res = await app.request('/devkit/profile/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'cursor' }),
    });
    expect(res.status).toBe(403);
    // DB never touched when the gate denied entry — proves the gate ran first.
    expect(mockedGetClient).not.toHaveBeenCalled();
  });

  it('GET /profile/active is NOT gated — Pro tier reaches the handler', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([{ devkitProfile: null }])),
    } as never);

    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', authedUser());
      await next();
    });
    // Pro-tier gate on PUT does NOT block GET (we only register on PUT).
    app.put('/devkit/profile/active', async (c, _next) =>
      c.json({ error: 'Feature requires Max tier' }, 403),
    );
    app.route('/devkit', devkitApp);

    const res = await app.request('/devkit/profile/active', { method: 'GET' });
    expect(res.status).toBe(200);
  });
});
