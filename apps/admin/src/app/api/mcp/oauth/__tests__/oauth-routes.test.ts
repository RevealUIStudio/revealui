/**
 * MCP OAuth route tests (Stage 2 PR-2.2).
 *
 * Exercises the initiate → callback route plumbing. The revvault-backed vault
 * is swapped for a shared in-memory vault and the SDK's auth() orchestrator is
 * mocked (see below) so the tests are hermetic — no real authorization server.
 * The real discovery/DCR/PKCE/token-exchange round trip is covered at the
 * provider layer by packages/mcp/__tests__/oauth-integration.test.ts. Here we
 * confirm the routes:
 *   - store a pending record keyed by state on initiate
 *   - resolve + delete that record on callback
 *   - land tokens at `mcp/<tenant>/<server>/tokens` after the flow
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// -- Shared in-memory vault swapped in for the revvault-backed default --

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

// The initiate route SSRF-guards the server URL via assertPublicUrl, which does
// a real DNS lookup that fails in the network-less CI. Stub it so these flow
// tests reach the OAuth logic; the guard is covered by @revealui/security's
// ssrf.test.ts.
vi.mock('@revealui/security/server', async () => {
  const actual = await vi.importActual<typeof import('@revealui/security/server')>(
    '@revealui/security/server',
  );
  return {
    ...actual,
    assertPublicUrl: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock the SDK's auth() orchestrator so these route tests are hermetic — no
// real authorization server. The real discovery/DCR/PKCE/token-exchange round
// trip is covered at the provider layer by packages/mcp/oauth-integration.test.
// auth() drives the REAL McpOAuthProvider exactly as the SDK would:
//   - initiate leg (no code): build an authorization URL and hand it to
//     redirectToAuthorization(), so provider.lastAuthorizationUrl is set.
//   - callback leg (code present): persist tokens via saveTokens().
interface FakeOAuthProvider {
  state(): string | Promise<string>;
  redirectToAuthorization(url: URL): Promise<void>;
  saveTokens(tokens: Record<string, unknown>): Promise<void>;
}
vi.mock('@modelcontextprotocol/sdk/client/auth.js', () => ({
  auth: vi.fn(
    async (
      provider: FakeOAuthProvider,
      opts: { serverUrl: string | URL; authorizationCode?: string },
    ): Promise<'REDIRECT' | 'AUTHORIZED'> => {
      if (opts.authorizationCode) {
        await provider.saveTokens({
          access_token: 'access-test-token',
          token_type: 'Bearer',
          refresh_token: 'refresh-test-token',
          expires_in: 3600,
        });
        return 'AUTHORIZED';
      }
      const base = typeof opts.serverUrl === 'string' ? opts.serverUrl : opts.serverUrl.toString();
      const authUrl = new URL('/authorize', base);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('code_challenge', 'test-code-challenge');
      authUrl.searchParams.set('client_id', 'test-client-id');
      authUrl.searchParams.set('redirect_uri', 'http://admin.test/api/mcp/oauth/callback');
      authUrl.searchParams.set('state', String(await provider.state()));
      await provider.redirectToAuthorization(authUrl);
      return 'REDIRECT';
    },
  ),
}));

function makeRequest(url: string): Request {
  return new Request(url, { headers: { cookie: 'session=test' } });
}

// -- Tests ------------------------------------------------------------------

beforeEach(() => {
  vaultStore.clear();
  mockGetSession.mockReset();
});

describe('GET /api/mcp/oauth/initiate', () => {
  it('returns 401 when the caller is not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../initiate/route.js');
    const res = await GET(
      makeRequest(
        'http://admin.test/api/mcp/oauth/initiate?tenant=acme&server=linear&serverUrl=https://example.com',
      ) as never,
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'user' } });
    const { GET } = await import('../initiate/route.js');
    const res = await GET(
      makeRequest(
        'http://admin.test/api/mcp/oauth/initiate?tenant=acme&server=linear&serverUrl=https://example.com',
      ) as never,
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when tenant/server/serverUrl are missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../initiate/route.js');
    const res = await GET(makeRequest('http://admin.test/api/mcp/oauth/initiate') as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when tenant/server contain disallowed characters', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../initiate/route.js');
    const res = await GET(
      makeRequest(
        'http://admin.test/api/mcp/oauth/initiate?tenant=acme&server=../etc/passwd&serverUrl=https://example.com',
      ) as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when serverUrl is not https (except localhost)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { GET } = await import('../initiate/route.js');
    const res = await GET(
      makeRequest(
        'http://admin.test/api/mcp/oauth/initiate?tenant=acme&server=linear&serverUrl=http://malicious.example.com',
      ) as never,
    );
    expect(res.status).toBe(400);
  });

  it('redirects to the authorization URL and writes the pending record', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
    const serverUrl = 'https://mcp.example.com';

    const { GET } = await import('../initiate/route.js');
    const res = await GET(
      makeRequest(
        `http://admin.test/api/mcp/oauth/initiate?tenant=acme&server=linear&serverUrl=${encodeURIComponent(serverUrl)}`,
      ) as never,
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    const loc = new URL(location as string);
    expect(loc.origin).toBe(serverUrl);
    expect(loc.pathname).toBe('/authorize');
    expect(loc.searchParams.get('response_type')).toBe('code');
    expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
    const state = loc.searchParams.get('state');
    expect(state).toBeTruthy();

    // Pending record landed in the shared in-memory vault under the expected key.
    const raw = vaultStore.get(`mcp/oauth/pending/${state}`);
    expect(raw).toBeTruthy();
    const pending = JSON.parse(raw as string);
    expect(pending.tenant).toBe('acme');
    expect(pending.server).toBe('linear');
    expect(pending.userId).toBe('admin-1');
    expect(pending.serverUrl).toBe(`${serverUrl}/`);
  });
});

describe('GET /api/mcp/oauth/callback', () => {
  it('redirects to /admin/mcp/connect?error=invalid_or_expired_state when state is unknown', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
    const { GET } = await import('../callback/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/oauth/callback?code=abc&state=unknown') as never,
    );
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location') as string);
    expect(location.pathname).toBe('/mcp/connect');
    expect(location.searchParams.get('error')).toBe('invalid_or_expired_state');
  });

  it('rejects when the session user does not match the pending record', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'eve', role: 'admin' } });
    vaultStore.set(
      'mcp/oauth/pending/state-xyz',
      JSON.stringify({
        tenant: 'acme',
        server: 'linear',
        serverUrl: 'http://127.0.0.1/',
        userId: 'admin-1',
        createdAt: new Date().toISOString(),
      }),
    );
    const { GET } = await import('../callback/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/oauth/callback?code=abc&state=state-xyz') as never,
    );
    const location = new URL(res.headers.get('location') as string);
    expect(location.searchParams.get('error')).toBe('session_mismatch');
    // Pending record is consumed one-shot regardless of outcome.
    expect(vaultStore.get('mcp/oauth/pending/state-xyz')).toBeUndefined();
  });

  it('rejects when the pending record is older than the TTL', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
    const createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    vaultStore.set(
      'mcp/oauth/pending/state-old',
      JSON.stringify({
        tenant: 'acme',
        server: 'linear',
        serverUrl: 'http://127.0.0.1/',
        userId: 'admin-1',
        createdAt,
      }),
    );
    const { GET } = await import('../callback/route.js');
    const res = await GET(
      makeRequest('http://admin.test/api/mcp/oauth/callback?code=abc&state=state-old') as never,
    );
    const location = new URL(res.headers.get('location') as string);
    expect(location.searchParams.get('error')).toBe('pending_expired');
  });

  it('propagates AS errors into the result page', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
    vaultStore.set(
      'mcp/oauth/pending/state-err',
      JSON.stringify({
        tenant: 'acme',
        server: 'linear',
        serverUrl: 'http://127.0.0.1/',
        userId: 'admin-1',
        createdAt: new Date().toISOString(),
      }),
    );
    const { GET } = await import('../callback/route.js');
    const res = await GET(
      makeRequest(
        'http://admin.test/api/mcp/oauth/callback?state=state-err&error=access_denied',
      ) as never,
    );
    const location = new URL(res.headers.get('location') as string);
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('server')).toBe('linear');
  });

  it('full round-trip: initiate then callback lands tokens in the vault', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
    const serverUrl = 'https://mcp.example.com';

    // 1. Initiate — builds the authorization URL + writes the pending record.
    const { GET: initiateGET } = await import('../initiate/route.js');
    const initRes = await initiateGET(
      makeRequest(
        `http://admin.test/api/mcp/oauth/initiate?tenant=acme&server=linear&serverUrl=${encodeURIComponent(serverUrl)}`,
      ) as never,
    );
    expect(initRes.status).toBe(302);
    const authUrl = new URL(initRes.headers.get('location') as string);
    const state = authUrl.searchParams.get('state') as string;
    expect(state).toBeTruthy();

    // 2. Callback — the AS redirected back with a code; the route exchanges it
    // for tokens (via the mocked auth()), clears the pending record, and 302s
    // to the result page.
    const { GET: callbackGET } = await import('../callback/route.js');
    const cbRes = await callbackGET(
      makeRequest(
        `http://admin.test/api/mcp/oauth/callback?code=auth-code-12345&state=${state}`,
      ) as never,
    );
    expect(cbRes.status).toBe(302);
    const result = new URL(cbRes.headers.get('location') as string);
    expect(result.pathname).toBe('/mcp/connect');
    expect(result.searchParams.get('connected')).toBe('linear');

    // Tokens landed under the documented layout (values from the mocked auth()).
    const tokensRaw = vaultStore.get('mcp/acme/linear/tokens');
    expect(tokensRaw).toBeTruthy();
    const tokens = JSON.parse(tokensRaw as string);
    expect(tokens.access_token).toBe('access-test-token');
    expect(tokens.refresh_token).toBe('refresh-test-token');

    // Pending record deleted (one-shot).
    expect(vaultStore.get(`mcp/oauth/pending/${state}`)).toBeUndefined();
  });
});
