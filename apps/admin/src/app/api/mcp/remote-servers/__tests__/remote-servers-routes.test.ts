/**
 * MCP remote-server catalog route tests (Stage 3.1).
 *
 * Exercises:
 *   - GET /api/mcp/remote-servers?tenant=X — enumerates OAuth-authorized
 *     remote servers by walking `mcp/<tenant>/<server>/tokens` in the vault.
 *   - POST /api/mcp/remote-servers/[server]/disconnect — revokes every
 *     credential path for `(tenant, server)`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const vaultStore = new Map<string, string>();

vi.mock('@revealui/mcp/oauth', async () => {
  const actual = await vi.importActual<typeof import('@revealui/mcp/oauth')>('@revealui/mcp/oauth');
  const sharedVault = {
    get: async (p: string): Promise<string | undefined> => vaultStore.get(p),
    set: async (p: string, v: string): Promise<void> => {
      vaultStore.set(p, v);
    },
    delete: async (p: string): Promise<void> => {
      vaultStore.delete(p);
    },
    list: async (prefix: string): Promise<string[]> =>
      Array.from(vaultStore.keys()).filter((k) => k.startsWith(prefix)),
  };
  return {
    ...actual,
    createRevvaultVault: () => sharedVault,
  };
});

const mockGetSession = vi.fn();
vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: undefined, ipAddress: undefined }),
}));

function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(url, {
    headers: { cookie: 'session=test' },
    ...init,
  });
}

beforeEach(() => {
  vaultStore.clear();
  mockGetSession.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/mcp/remote-servers?tenant=X
// ---------------------------------------------------------------------------

describe('GET /api/mcp/remote-servers', () => {
  it('returns 401 without a session', async () => {
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers?tenant=acme') as never,
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin sessions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'user' } });
    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers?tenant=acme') as never,
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when tenant query param is missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../route.js');
    const res = await GET(makeRequest('http://admin.test/api/mcp/remote-servers') as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 on malformed tenant ids', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers?tenant=../etc') as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when tenant is a reserved segment (oauth)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers?tenant=oauth') as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns an empty list when the tenant has no servers', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers?tenant=acme') as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { servers: unknown[] };
    expect(body.servers).toEqual([]);
  });

  it('lists servers whose tokens path exists under the tenant prefix', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    vaultStore.set('mcp/acme/linear/tokens', '{"access_token":"at"}');
    vaultStore.set('mcp/acme/linear/client', '{"client_id":"cid"}');
    vaultStore.set('mcp/acme/notion/tokens', '{"access_token":"at"}');
    // Different tenant — should NOT surface under acme.
    vaultStore.set('mcp/other/stripe/tokens', '{"access_token":"at"}');
    // Unrelated pending record — should NOT be listed.
    vaultStore.set('mcp/oauth/pending/some-state', '{}');

    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers?tenant=acme') as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      servers: Array<{ tenant: string; server: string; connectionState: string }>;
    };
    expect(body.servers).toEqual([
      { tenant: 'acme', server: 'linear', connectionState: 'connected' },
      { tenant: 'acme', server: 'notion', connectionState: 'connected' },
    ]);
  });

  it('ignores malformed server identifiers', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    vaultStore.set('mcp/acme/linear/tokens', '{"access_token":"at"}');
    // Adversarial — `..` should fail the IDENTIFIER_RE check
    vaultStore.set('mcp/acme/../oops/tokens', '{}');

    const { GET } = await import('../route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/remote-servers?tenant=acme') as never,
    );
    const body = (await res.json()) as {
      servers: Array<{ server: string }>;
    };
    expect(body.servers.map((s) => s.server)).toEqual(['linear']);
  });
});

// ---------------------------------------------------------------------------
// POST /api/mcp/remote-servers/[server]/disconnect
// ---------------------------------------------------------------------------

describe('POST /api/mcp/remote-servers/[server]/disconnect', () => {
  it('returns 401 without a session', async () => {
    mockGetSession.mockResolvedValue(null);
    const { POST } = await import('../[server]/disconnect/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/disconnect', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme' }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin sessions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'user' } });
    const { POST } = await import('../[server]/disconnect/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/disconnect', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme' }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when the server path segment is malformed', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../[server]/disconnect/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/bad..one/disconnect', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme' }),
      }) as never,
      { params: Promise.resolve({ server: 'bad..one' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when body tenant is missing or malformed', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../[server]/disconnect/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/disconnect', {
        method: 'POST',
        body: JSON.stringify({ tenant: '../bad' }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(400);
  });

  it('deletes every credential path for (tenant, server)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    vaultStore.set('mcp/acme/linear/tokens', '{"access_token":"at"}');
    vaultStore.set('mcp/acme/linear/client', '{"client_id":"cid"}');
    vaultStore.set('mcp/acme/linear/verifier', 'verifier-123');
    vaultStore.set('mcp/acme/linear/discovery', '{}');
    // Sibling server — MUST be preserved.
    vaultStore.set('mcp/acme/notion/tokens', '{"access_token":"at"}');

    const { POST } = await import('../[server]/disconnect/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/disconnect', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme' }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);

    expect(vaultStore.has('mcp/acme/linear/tokens')).toBe(false);
    expect(vaultStore.has('mcp/acme/linear/client')).toBe(false);
    expect(vaultStore.has('mcp/acme/linear/verifier')).toBe(false);
    expect(vaultStore.has('mcp/acme/linear/discovery')).toBe(false);
    // Notion untouched.
    expect(vaultStore.has('mcp/acme/notion/tokens')).toBe(true);
  });

  it('is idempotent — disconnecting an already-disconnected server returns 200', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../[server]/disconnect/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/disconnect', {
        method: 'POST',
        body: JSON.stringify({ tenant: 'acme' }),
      }) as never,
      { params: Promise.resolve({ server: 'linear' }) },
    );
    expect(res.status).toBe(200);
  });
});
