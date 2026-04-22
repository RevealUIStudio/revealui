/**
 * MCP OAuth route tests (Stage 2 PR-2.2).
 *
 * Exercises the full initiate → callback round-trip end-to-end against a
 * hermetic mock authorization server. The revvault-backed vault is swapped
 * for a shared in-memory vault via `vi.mock` so we can:
 *   - confirm the initiate handler stores a pending record keyed by state
 *   - confirm the callback handler resolves + deletes that record
 *   - confirm tokens land at `mcp/<tenant>/<server>/tokens` after the flow
 */

import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// -- Hermetic mock authorization server (same shape as packages/mcp tests) --

type AuthCodeGrant = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
};

interface MockAsState {
  clients: Map<string, { client_id: string; redirect_uris: string[] }>;
  issuedCodes: Map<string, AuthCodeGrant>;
  validRefreshTokens: Set<string>;
  nextAccessToken: number;
  nextRefreshToken: number;
}

type RunningAs = {
  url: string;
  state: MockAsState;
  close(): Promise<void>;
};

const teardowns: Array<() => Promise<void>> = [];

async function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}

async function sha256Base64Url(input: string): Promise<string> {
  const { subtle } = await import('node:crypto');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Buffer.from(digest)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function startMockAs(): Promise<RunningAs> {
  const state: MockAsState = {
    clients: new Map(),
    issuedCodes: new Map(),
    validRefreshTokens: new Set(),
    nextAccessToken: 1,
    nextRefreshToken: 1,
  };

  const server = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const baseUrl = `http://${req.headers.host}`;
    const send = (status: number, body: unknown): void => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body));
    };

    try {
      if (req.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource') {
        return send(200, { resource: baseUrl, authorization_servers: [baseUrl] });
      }
      if (req.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
        return send(200, {
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/authorize`,
          token_endpoint: `${baseUrl}/token`,
          registration_endpoint: `${baseUrl}/register`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
        });
      }
      if (req.method === 'POST' && url.pathname === '/register') {
        const body = await readBody(req);
        const metadata = JSON.parse(body) as { redirect_uris: string[]; client_name?: string };
        const clientId = `client-${state.clients.size + 1}`;
        state.clients.set(clientId, {
          client_id: clientId,
          redirect_uris: metadata.redirect_uris,
        });
        return send(201, {
          client_id: clientId,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          ...metadata,
        });
      }
      if (req.method === 'POST' && url.pathname === '/token') {
        const form = parseForm(await readBody(req));
        if (form.grant_type === 'authorization_code') {
          const code = form.code ?? '';
          const grant = state.issuedCodes.get(code);
          if (!grant) return send(400, { error: 'invalid_grant' });
          const expectedChallenge = await sha256Base64Url(form.code_verifier ?? '');
          if (
            grant.codeChallengeMethod !== 'S256' ||
            expectedChallenge !== grant.codeChallenge ||
            grant.clientId !== form.client_id
          ) {
            return send(400, { error: 'invalid_grant' });
          }
          state.issuedCodes.delete(code);
          const access = `access-${state.nextAccessToken++}`;
          const refresh = `refresh-${state.nextRefreshToken++}`;
          state.validRefreshTokens.add(refresh);
          return send(200, {
            access_token: access,
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: refresh,
          });
        }
        return send(400, { error: 'unsupported_grant_type' });
      }
      return send(404, { error: 'not_found' });
    } catch (err) {
      return send(500, { error: String(err) });
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const close = () =>
    new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  teardowns.push(close);
  return { url, state, close };
}

function makeRequest(url: string): Request {
  return new Request(url, { headers: { cookie: 'session=test' } });
}

// -- Tests ------------------------------------------------------------------

beforeEach(() => {
  vaultStore.clear();
  mockGetSession.mockReset();
});

afterEach(async () => {
  while (teardowns.length) {
    const fn = teardowns.pop();
    if (fn) await fn().catch(() => undefined);
  }
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

  it('runs discovery + DCR and redirects to the authorization URL', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
    const as = await startMockAs();

    const { GET } = await import('../initiate/route.js');
    const res = await GET(
      makeRequest(
        `http://admin.test/api/mcp/oauth/initiate?tenant=acme&server=linear&serverUrl=${encodeURIComponent(as.url)}`,
      ) as never,
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    const loc = new URL(location as string);
    expect(loc.origin).toBe(as.url);
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
    expect(pending.serverUrl).toBe(`${as.url}/`);

    // DCR ran against the mock AS.
    expect(as.state.clients.size).toBe(1);
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
    expect(location.pathname).toBe('/admin/mcp/connect');
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
    const as = await startMockAs();

    // 1. Initiate — runs DCR + builds authorization URL + writes pending record.
    const { GET: initiateGET } = await import('../initiate/route.js');
    const initRes = await initiateGET(
      makeRequest(
        `http://admin.test/api/mcp/oauth/initiate?tenant=acme&server=linear&serverUrl=${encodeURIComponent(as.url)}`,
      ) as never,
    );
    expect(initRes.status).toBe(302);
    const authUrl = new URL(initRes.headers.get('location') as string);
    const state = authUrl.searchParams.get('state') as string;
    const codeChallenge = authUrl.searchParams.get('code_challenge') as string;
    const clientId = authUrl.searchParams.get('client_id') as string;
    const redirectUri = authUrl.searchParams.get('redirect_uri') as string;

    // 2. Simulate the AS issuing an authorization code after user consent.
    const authCode = 'auth-code-12345';
    as.state.issuedCodes.set(authCode, {
      code: authCode,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: 'S256',
      state,
    });

    // 3. Callback — exchanges code for tokens, clears pending record, 302 to result page.
    const { GET: callbackGET } = await import('../callback/route.js');
    const cbRes = await callbackGET(
      makeRequest(
        `http://admin.test/api/mcp/oauth/callback?code=${authCode}&state=${state}`,
      ) as never,
    );
    expect(cbRes.status).toBe(302);
    const result = new URL(cbRes.headers.get('location') as string);
    expect(result.pathname).toBe('/admin/mcp/connect');
    expect(result.searchParams.get('connected')).toBe('linear');

    // Tokens landed under the documented layout.
    const tokensRaw = vaultStore.get('mcp/acme/linear/tokens');
    expect(tokensRaw).toBeTruthy();
    const tokens = JSON.parse(tokensRaw as string);
    expect(tokens.access_token).toMatch(/^access-/);
    expect(tokens.refresh_token).toMatch(/^refresh-/);

    // Pending record deleted (one-shot).
    expect(vaultStore.get(`mcp/oauth/pending/${state}`)).toBeUndefined();
  });
});
