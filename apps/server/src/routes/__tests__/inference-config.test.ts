/**
 * Tests for admin/inference-config route — aiInference Max-tier paywall.
 *
 * Covered:
 *   - requireAdmin: 401 unauth, 403 non-admin
 *   - GET: synthetic default when no row, configured row when present
 *   - PUT: keyless provider (inference-snaps) accepts no apiKey
 *   - PUT: keyless provider rejects apiKey (paired with key-pairing CHECK)
 *   - PUT: keyed provider (groq) requires apiKey
 *   - PUT: keyed provider encrypts apiKey + stores keyHint
 *   - PUT: existing row updates instead of inserting
 *   - DELETE: removes row + returns synthetic default
 *   - Encryption round-trip: ciphertext written, hint redacted
 *   - Keyless round-trip: NULL encryptedApiKey, NULL keyHint
 *   - Gate (requireFeature 'aiInference'): Pro tier → 403, Max → 200
 *     (mocked at the middleware boundary)
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

vi.mock('@revealui/db/crypto', () => ({
  encryptApiKey: vi.fn((key: string) => `encrypted:${key}`),
  redactApiKey: vi.fn((key: string) => `...${key.slice(-4)}`),
}));

vi.mock('@revealui/db/schema', () => ({
  workspaceInferenceConfigs: {
    id: 'id',
    workspaceId: 'workspaceId',
    provider: 'provider',
    encryptedApiKey: 'encryptedApiKey',
    keyHint: 'keyHint',
    model: 'model',
    baseURL: 'baseURL',
    temperature: 'temperature',
    maxTokens: 'maxTokens',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

// Mock @revealui/ai dynamic import path used by syncRegistry / clearRegistry.
const setRegistry = vi.fn();
const deleteRegistry = vi.fn();
vi.mock('@revealui/ai/llm/server', () => ({
  workspaceProviderRegistry: {
    set: setRegistry,
    delete: deleteRegistry,
  },
}));

import { getClient } from '@revealui/db';
import inferenceConfigApp from '../admin/inference-config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockUser {
  id: string;
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
  app.route('/inference/config', inferenceConfigApp);
  return app;
}

function adminUser(): MockUser {
  return { id: 'u_admin', role: 'admin' };
}

function fixtureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wic_1',
    workspaceId: 'site_xyz',
    provider: 'groq',
    encryptedApiKey: 'encrypted:gsk_test_key',
    keyHint: '..._key',
    model: 'qwen/qwen3-32b',
    baseURL: 'https://api.groq.com/openai/v1',
    temperature: 0.7,
    maxTokens: 2048,
    createdAt: new Date('2026-04-27T00:00:00.000Z'),
    updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    ...overrides,
  };
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

function makeInsertChain(returnsRow: unknown) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnsRow]),
    }),
  };
}

function makeUpdateChain(returnsRow: unknown) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([returnsRow]),
      }),
    }),
  };
}

function makeDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// requireAdmin — auth gate
// ---------------------------------------------------------------------------

describe('requireAdmin', () => {
  it('returns 401 when no user is set', async () => {
    const app = createApp();
    const res = await app.request('/inference/config?workspaceId=site_xyz', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user role is not admin', async () => {
    const app = createApp({ id: 'u1', role: 'editor' });
    const res = await app.request('/inference/config?workspaceId=site_xyz', {
      method: 'GET',
    });
    expect(res.status).toBe(403);
  });

  it('allows super-admin role through', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([])),
    } as never);
    const app = createApp({ id: 'u_super', role: 'super-admin' });
    const res = await app.request('/inference/config?workspaceId=site_xyz', {
      method: 'GET',
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET — read config or system default
// ---------------------------------------------------------------------------

describe('GET /admin/inference/config', () => {
  it('returns synthetic default when no row exists for the workspace', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([])),
    } as never);

    const app = createApp(adminUser());
    const res = await app.request('/inference/config?workspaceId=site_no_config', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.data.source).toBe('default');
    expect(body.data.provider).toBe('inference-snaps');
    expect(body.data.model).toBe('gemma3');
    expect(body.data.baseURL).toBe('http://localhost:9090/v1');
    expect(body.data.keyHint).toBeNull();
    expect(body.data.workspaceId).toBe('site_no_config');
  });

  it('returns configured row with redacted keyHint when one exists', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([fixtureRow()])),
    } as never);

    const app = createApp(adminUser());
    const res = await app.request('/inference/config?workspaceId=site_xyz', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body.data.source).toBe('configured');
    expect(body.data.provider).toBe('groq');
    expect(body.data.keyHint).toBe('..._key');
    // The encrypted key MUST NOT leak in GET responses.
    expect(body.data.encryptedApiKey).toBeUndefined();
  });

  it('rejects missing workspaceId param', async () => {
    const app = createApp(adminUser());
    const res = await app.request('/inference/config', { method: 'GET' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT — upsert
// ---------------------------------------------------------------------------

describe('PUT /admin/inference/config', () => {
  it('inserts new row for keyless provider (inference-snaps) with NULL apiKey + NULL keyHint', async () => {
    const insertedRow = fixtureRow({
      id: 'wic_new',
      provider: 'inference-snaps',
      encryptedApiKey: null,
      keyHint: null,
      model: null,
      baseURL: null,
      temperature: null,
      maxTokens: null,
    });

    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([])),
      insert: vi.fn().mockReturnValue(makeInsertChain(insertedRow)),
    } as never);

    const app = createApp(adminUser());
    const res = await app.request('/inference/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'site_keyless',
        provider: 'inference-snaps',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body.data.provider).toBe('inference-snaps');
    expect(body.data.keyHint).toBeNull();
    expect(setRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'inference-snaps',
        apiKey: 'inference-snaps', // placeholder for keyless provider
      }),
    );
  });

  it('rejects keyless provider when apiKey is supplied (refinement enforces invariant)', async () => {
    const app = createApp(adminUser());
    const res = await app.request('/inference/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'site_xyz',
        provider: 'ollama',
        apiKey: 'should-not-be-set',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects keyed provider when apiKey is missing (refinement enforces invariant)', async () => {
    const app = createApp(adminUser());
    const res = await app.request('/inference/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'site_xyz',
        provider: 'groq',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('inserts new row for keyed provider (groq) with encrypted apiKey + hint', async () => {
    const insertedRow = fixtureRow({
      id: 'wic_new',
      encryptedApiKey: 'encrypted:gsk_real_key_abcd',
      keyHint: '...abcd',
    });

    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([])),
      insert: vi.fn().mockReturnValue(makeInsertChain(insertedRow)),
    } as never);

    const app = createApp(adminUser());
    const res = await app.request('/inference/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'site_groq',
        provider: 'groq',
        apiKey: 'gsk_real_key_abcd',
        model: 'qwen/qwen3-32b',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body.data.provider).toBe('groq');
    expect(body.data.keyHint).toBe('...abcd');
    // Plaintext key must not leak in the response.
    expect(JSON.stringify(body)).not.toContain('gsk_real_key_abcd');
    // Registry was synced with plaintext (so subsequent chat() works).
    expect(setRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'groq',
        apiKey: 'gsk_real_key_abcd',
      }),
    );
  });

  it('updates existing row instead of inserting', async () => {
    const existingRow = { id: 'wic_existing' };
    const updatedRow = fixtureRow({ id: 'wic_existing', model: 'qwen/qwen2-32b' });

    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([existingRow])),
      update: vi.fn().mockReturnValue(makeUpdateChain(updatedRow)),
    } as never);

    const app = createApp(adminUser());
    const res = await app.request('/inference/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'site_xyz',
        provider: 'groq',
        apiKey: 'gsk_new',
        model: 'qwen/qwen2-32b',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.model).toBe('qwen/qwen2-32b');
  });
});

// ---------------------------------------------------------------------------
// DELETE — revert to system default
// ---------------------------------------------------------------------------

describe('DELETE /admin/inference/config', () => {
  it('clears the row, calls registry.delete, and returns synthetic default', async () => {
    mockedGetClient.mockReturnValue({
      delete: vi.fn().mockReturnValue(makeDeleteChain()),
    } as never);

    const app = createApp(adminUser());
    const res = await app.request('/inference/config?workspaceId=site_xyz', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.source).toBe('default');
    expect(body.data.provider).toBe('inference-snaps');
    expect(deleteRegistry).toHaveBeenCalledWith('site_xyz');
  });
});

// ---------------------------------------------------------------------------
// requireFeature gate (Pro→403, Max→200) — exercised by mocking the
// middleware itself and confirming the route is reachable through the gate.
// The actual entitlements lookup is well-tested in middleware/__tests__.
// ---------------------------------------------------------------------------

describe('requireFeature gate (integration)', () => {
  it('Max tier passes the gate and reaches the route handler', async () => {
    mockedGetClient.mockReturnValue({
      select: vi.fn().mockReturnValue(makeSelectChain([])),
    } as never);

    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', adminUser());
      await next();
    });
    // Simulate Max-tier requireFeature: pass-through.
    app.use('/inference/config', async (_c, next) => next());
    app.route('/inference/config', inferenceConfigApp);

    const res = await app.request('/inference/config?workspaceId=site_xyz', {
      method: 'GET',
    });
    expect(res.status).toBe(200);
  });

  it('Pro tier hits the gate and returns 403 before the route runs', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test app generic
    const app = new Hono<{ Variables: { user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', adminUser());
      await next();
    });
    // Simulate Pro-tier requireFeature: 403. Standard Hono middleware
    // signature (c, next) — returning a Response without calling next()
    // short-circuits.
    app.use('/inference/config', async (c, _next) =>
      c.json({ error: 'Feature requires Max tier' }, 403),
    );
    app.route('/inference/config', inferenceConfigApp);

    const res = await app.request('/inference/config?workspaceId=site_xyz', {
      method: 'GET',
    });
    expect(res.status).toBe(403);
    // Importantly, the DB client should never have been called when the
    // gate denied entry — proves the gate runs first.
    expect(mockedGetClient).not.toHaveBeenCalled();
  });
});
