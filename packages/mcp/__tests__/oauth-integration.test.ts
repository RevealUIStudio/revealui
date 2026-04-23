/**
 * OAuth 2.1 integration tests (Stage 2 PR-2.1).
 *
 * Drives the SDK's top-level `auth()` helper against a hermetic mock
 * authorization server (real `http.createServer` on an ephemeral port) with
 * our {@link McpOAuthProvider} attached. Covers:
 *
 *   1. First-time authorization with Dynamic Client Registration (RFC 7591),
 *      PKCE verifier generation, and the `redirectToAuthorization` hand-off.
 *   2. Authorization code exchange with PKCE — the verifier round-trips through
 *      the vault and lands in the token request.
 *   3. Refresh-token rotation (OAuth 2.1 §4.12) — a rotated refresh_token is
 *      persisted through `saveTokens` verbatim.
 *   4. Streamable HTTP transport wiring — an `authProvider` with pre-seeded
 *      tokens produces an `Authorization: Bearer …` header on the MCP wire.
 */

import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { auth, refreshAuthorization } from '@modelcontextprotocol/sdk/client/auth.js';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { McpClient } from '../src/client.js';
import { createMemoryVault, McpOAuthProvider, type Vault } from '../src/oauth.js';
import { createNodeStreamableHttpHandler } from '../src/streamable-http.js';

// ---------------------------------------------------------------------------
// Mock authorization server
// ---------------------------------------------------------------------------

type AuthCodeGrant = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string;
};

interface MockAsState {
  clients: Map<string, { client_id: string; redirect_uris: string[] }>;
  issuedCodes: Map<string, AuthCodeGrant>;
  validRefreshTokens: Set<string>;
  /** Controls whether the server rotates refresh tokens on refresh (RFC 6749 §5.2 OR OAuth 2.1 §4.12). */
  rotateRefreshTokens: boolean;
  /** Events observed, for assertions. */
  events: Array<{ kind: string; detail?: Record<string, unknown> }>;
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
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}

async function startMockAs(options?: { rotateRefreshTokens?: boolean }): Promise<RunningAs> {
  const state: MockAsState = {
    clients: new Map(),
    issuedCodes: new Map(),
    validRefreshTokens: new Set(),
    rotateRefreshTokens: options?.rotateRefreshTokens ?? true,
    events: [],
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
        state.events.push({ kind: 'resource-metadata' });
        return send(200, {
          resource: baseUrl,
          authorization_servers: [baseUrl],
        });
      }

      if (req.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
        state.events.push({ kind: 'as-metadata' });
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
        const metadata = JSON.parse(body) as {
          redirect_uris: string[];
          client_name?: string;
        };
        const clientId = `client-${state.clients.size + 1}`;
        state.clients.set(clientId, {
          client_id: clientId,
          redirect_uris: metadata.redirect_uris,
        });
        state.events.push({ kind: 'register', detail: { clientId } });
        return send(201, {
          client_id: clientId,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          ...metadata,
        });
      }

      if (req.method === 'POST' && url.pathname === '/token') {
        const form = parseForm(await readBody(req));
        if (form.grant_type === 'authorization_code') {
          const grant = state.issuedCodes.get(form.code);
          if (!grant) return send(400, { error: 'invalid_grant' });
          // Verify PKCE.
          const expectedChallenge = await sha256Base64Url(form.code_verifier ?? '');
          if (grant.codeChallengeMethod !== 'S256' || expectedChallenge !== grant.codeChallenge) {
            return send(400, { error: 'invalid_grant', error_description: 'PKCE mismatch' });
          }
          if (grant.clientId !== form.client_id) {
            return send(400, { error: 'invalid_client' });
          }
          state.issuedCodes.delete(form.code);
          const access = `access-${state.nextAccessToken++}`;
          const refresh = `refresh-${state.nextRefreshToken++}`;
          state.validRefreshTokens.add(refresh);
          state.events.push({
            kind: 'token-exchange',
            detail: { code: form.code, client: form.client_id },
          });
          return send(200, {
            access_token: access,
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: refresh,
            scope: grant.scope,
          });
        }

        if (form.grant_type === 'refresh_token') {
          const presented = form.refresh_token ?? '';
          if (!state.validRefreshTokens.has(presented)) {
            return send(400, { error: 'invalid_grant' });
          }
          state.validRefreshTokens.delete(presented);
          const newAccess = `access-${state.nextAccessToken++}`;
          const refreshBody: Record<string, unknown> = {
            access_token: newAccess,
            token_type: 'Bearer',
            expires_in: 3600,
          };
          if (state.rotateRefreshTokens) {
            const rotated = `refresh-${state.nextRefreshToken++}`;
            state.validRefreshTokens.add(rotated);
            refreshBody.refresh_token = rotated;
          } else {
            state.validRefreshTokens.add(presented); // keep old refresh valid
          }
          state.events.push({
            kind: 'refresh',
            detail: {
              old: presented,
              rotated: refreshBody.refresh_token,
            },
          });
          return send(200, refreshBody);
        }

        return send(400, { error: 'unsupported_grant_type' });
      }

      return send(404, { error: 'not_found', path: url.pathname });
    } catch (err) {
      return send(500, { error: 'server_error', message: String(err) });
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

async function sha256Base64Url(input: string): Promise<string> {
  const { subtle } = await import('node:crypto');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Buffer.from(digest)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseClientMetadata = {
  redirect_uris: ['http://localhost/oauth/callback'],
  client_name: 'McpOAuthProvider test',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
};

function mkProvider(
  vault: Vault = createMemoryVault(),
  overrides?: Partial<ConstructorParameters<typeof McpOAuthProvider>[0]>,
): McpOAuthProvider {
  return new McpOAuthProvider({
    tenant: 'acme',
    server: 'linear',
    vault,
    redirectUrl: 'http://localhost/oauth/callback',
    clientMetadata: baseClientMetadata,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(async () => {
  while (teardowns.length) {
    const fn = teardowns.pop();
    if (fn) await fn().catch(() => undefined);
  }
});

describe('McpOAuthProvider × SDK auth() first-time flow', () => {
  it('runs discovery, DCR, and redirect — persisting verifier + client info', async () => {
    const as = await startMockAs();
    const vault = createMemoryVault();
    const provider = mkProvider(vault);

    const result = await auth(provider, { serverUrl: as.url });

    expect(result).toBe('REDIRECT');

    // Provider has captured the URL for the caller to navigate to.
    expect(provider.lastAuthorizationUrl).toBeDefined();
    const authUrl = provider.lastAuthorizationUrl as URL;
    expect(authUrl.pathname).toBe('/authorize');
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(authUrl.searchParams.get('client_id')).toBe('client-1');

    // DCR and discovery fired against the AS.
    const kinds = as.state.events.map((e) => e.kind);
    expect(kinds).toContain('as-metadata');
    expect(kinds).toContain('register');

    // Client info persisted.
    const storedClient = await provider.clientInformation();
    expect(storedClient?.client_id).toBe('client-1');

    // PKCE verifier stored in vault under the documented path.
    expect(await vault.get('mcp/acme/linear/verifier')).toBeTruthy();
  });

  it('exchanges an authorization code and stores tokens via saveTokens', async () => {
    const as = await startMockAs();
    const provider = mkProvider();

    // Step 1: kick off the flow.
    expect(await auth(provider, { serverUrl: as.url })).toBe('REDIRECT');

    // Step 2: simulate the user consenting + AS issuing an authorization code.
    // We hand-register the code against the state the client just built.
    const authUrl = provider.lastAuthorizationUrl as URL;
    const codeChallenge = authUrl.searchParams.get('code_challenge') as string;
    const clientId = authUrl.searchParams.get('client_id') as string;
    const redirectUri = authUrl.searchParams.get('redirect_uri') as string;
    const authCode = 'auth-code-abc';
    as.state.issuedCodes.set(authCode, {
      code: authCode,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: 'S256',
      scope: authUrl.searchParams.get('scope') ?? undefined,
    });

    // Step 3: the redirect lands with ?code=…; caller invokes auth() again with it.
    const result = await auth(provider, { serverUrl: as.url, authorizationCode: authCode });
    expect(result).toBe('AUTHORIZED');

    // Tokens landed in the vault.
    const tokens = await provider.tokens();
    expect(tokens?.access_token).toBe('access-1');
    expect(tokens?.refresh_token).toBe('refresh-1');
    expect(tokens?.token_type).toBe('Bearer');

    // Token exchange was observed on the AS.
    expect(as.state.events.find((e) => e.kind === 'token-exchange')).toBeDefined();
  });
});

describe('McpOAuthProvider × refresh rotation', () => {
  it('persists a rotated refresh_token when the AS rotates (OAuth 2.1 §4.12)', async () => {
    const as = await startMockAs({ rotateRefreshTokens: true });
    const vault = createMemoryVault();
    const provider = mkProvider(vault);

    // Pre-seed client info + expired tokens. We set expires_in=0 to force
    // downstream consumers to treat the access as stale; the refresh flow
    // does not itself check expiry — it just exchanges the refresh_token.
    await provider.saveClientInformation({
      client_id: 'pre-registered',
      redirect_uris: baseClientMetadata.redirect_uris,
    });
    const originalRefresh = 'refresh-original';
    as.state.validRefreshTokens.add(originalRefresh);
    await provider.saveTokens({
      access_token: 'access-stale',
      token_type: 'Bearer',
      expires_in: 0,
      refresh_token: originalRefresh,
    });

    // Execute the refresh directly via the SDK helper.
    const newTokens = await refreshAuthorization(as.url, {
      clientInformation: { client_id: 'pre-registered' },
      refreshToken: originalRefresh,
    });

    // Persist through the provider as the SDK transport would.
    await provider.saveTokens(newTokens);

    const stored = await provider.tokens();
    expect(stored?.access_token).toBe(newTokens.access_token);
    expect(stored?.refresh_token).toBeDefined();
    expect(stored?.refresh_token).not.toBe(originalRefresh);

    // AS rotated, so the old refresh_token is no longer valid.
    expect(as.state.validRefreshTokens.has(originalRefresh)).toBe(false);
    expect(as.state.validRefreshTokens.has(stored?.refresh_token as string)).toBe(true);
  });

  it('keeps the original refresh_token when the AS does not rotate', async () => {
    const as = await startMockAs({ rotateRefreshTokens: false });
    const vault = createMemoryVault();
    const provider = mkProvider(vault);

    await provider.saveClientInformation({
      client_id: 'pre-registered',
      redirect_uris: baseClientMetadata.redirect_uris,
    });
    const originalRefresh = 'refresh-keep';
    as.state.validRefreshTokens.add(originalRefresh);
    await provider.saveTokens({
      access_token: 'access-stale',
      token_type: 'Bearer',
      refresh_token: originalRefresh,
    });

    const newTokens = await refreshAuthorization(as.url, {
      clientInformation: { client_id: 'pre-registered' },
      refreshToken: originalRefresh,
    });
    // The SDK preserves the original refresh_token when the AS omits one.
    await provider.saveTokens(newTokens);
    const stored = await provider.tokens();
    expect(stored?.refresh_token).toBe(originalRefresh);
  });
});

// ---------------------------------------------------------------------------
// Transport wiring — the provider is passed through to StreamableHTTPClientTransport
// and emits Authorization headers on the MCP wire.
// ---------------------------------------------------------------------------

describe('McpOAuthProvider × StreamableHTTP transport wiring', () => {
  it('forwards the bearer token from the provider into the MCP request headers', async () => {
    const seenAuthorizationHeaders: string[] = [];

    // Mock MCP server that records the Authorization header on every request.
    const handler = createNodeStreamableHttpHandler({
      createServer: () => {
        const server = new McpServer(
          { name: 'auth-wire-fixture', version: '0.0.1' },
          { capabilities: { resources: {} } },
        );
        server.setRequestHandler(ListResourcesRequestSchema, async () => ({
          resources: [{ uri: 'res://one', name: 'one' }],
        }));
        server.setRequestHandler(ReadResourceRequestSchema, async (req) => ({
          contents: [{ uri: req.params.uri, mimeType: 'text/plain', text: 'ok' }],
        }));
        return server;
      },
    });

    const httpServer: NodeHttpServer = createHttpServer((req, res) => {
      seenAuthorizationHeaders.push(String(req.headers.authorization ?? ''));
      void handler(req, res).catch((err) => {
        if (!res.headersSent) res.statusCode = 500;
        res.end(String(err));
      });
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address() as AddressInfo;
    teardowns.push(
      () =>
        new Promise((resolve, reject) =>
          httpServer.close((err) => (err ? reject(err) : resolve())),
        ),
    );

    // Provider with pre-seeded, still-valid tokens.
    const vault = createMemoryVault();
    const provider = mkProvider(vault);
    await provider.saveClientInformation({
      client_id: 'pre-registered',
      redirect_uris: baseClientMetadata.redirect_uris,
    });
    await provider.saveTokens({
      access_token: 'pre-seeded-access',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'pre-seeded-refresh',
    });

    const client = new McpClient({
      clientInfo: { name: 'oauth-wire-test', version: '0.0.0' },
      transport: {
        kind: 'streamable-http',
        url: `http://127.0.0.1:${port}/`,
        authProvider: provider,
      },
    });

    await client.connect();
    const resources = await client.listResources();
    await client.close();

    expect(resources).toHaveLength(1);
    // At least one wire request carried the Bearer header from the provider.
    expect(seenAuthorizationHeaders.some((h) => h === 'Bearer pre-seeded-access')).toBe(true);
  });

  it('rejects finishAuth when transport is not streamable-http', async () => {
    const client = new McpClient({
      clientInfo: { name: 'test', version: '0.0.0' },
      transport: {
        kind: 'stdio',
        command: 'node',
        args: ['-e', ';'],
      },
    });
    await expect(client.finishAuth('code-123')).rejects.toThrow(
      /requires the 'streamable-http' transport/,
    );
  });

  it('rejects finishAuth when connect() has not been called', async () => {
    const provider = mkProvider();
    const client = new McpClient({
      clientInfo: { name: 'test', version: '0.0.0' },
      transport: {
        kind: 'streamable-http',
        url: 'http://127.0.0.1:1/',
        authProvider: provider,
      },
    });
    await expect(client.finishAuth('code-123')).rejects.toThrow(/finishAuth.*before connect/);
  });
});
