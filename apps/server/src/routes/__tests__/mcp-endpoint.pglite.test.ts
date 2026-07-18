/**
 * Governed MCP endpoint — end-to-end invariant tests against a REAL migrated
 * schema (PGlite), a real `@hono/node-server` served on an ephemeral port, and
 * the real `@modelcontextprotocol/sdk` client (GAP-371 Phase 1).
 *
 * Device tokens (`rvui_dev_…`) are minted into `user_devices`; the forwarded
 * REST calls hit a stub backend that maps a token → user and enforces site
 * ownership, standing in for the collection-access layer. This proves the MCP
 * layer FORWARDS the caller's identity and honors the REST verdict — the
 * Phase-1 enforcement contract (decision B).
 *
 * Covers:
 *   full acceptance  initialize → tools/list → tools/call with a minted token,
 *                    landing an `mcp:tool:invoked` receipt through the one door
 *                    (I-5, plus the positive I-3 "A's token on A's session → 200")
 *   I-2  a foreign / nonexistent site_id yields the same empty shape (no oracle)
 *   I-3  the session id is never authority (no-token replay → 401; B's token →
 *        401 + session terminated)
 *   I-4  an unauthenticated request 401s even with REVEALUI_API_KEY set
 *   I-6  revocation / expiry honored per request, mid-session
 *   gate requireFeature('mcp') denies a free-tier caller
 */

import { createHash, randomUUID } from 'node:crypto';
import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import * as schema from '@revealui/db/schema';
import { McpClient } from '@revealui/mcp/client';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import { createMcpEndpointApp } from '../mcp-endpoint.js';

let testDb: TestDb;

// `vi.mock` is hoisted above the imports; the factory reads `testDb` lazily so
// the client resolves to the PGlite instance created in beforeAll.
vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});
vi.mock('@revealui/auth/server', () => ({ getSession: async () => null }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const TOKEN_A = `rvui_dev_${'a'.repeat(64)}`;
const TOKEN_B = `rvui_dev_${'b'.repeat(64)}`;
const TOKEN_FREE = `rvui_dev_${'c'.repeat(64)}`;

// Site ownership the stub backend enforces.
const SITE_OWNERS: Record<string, string> = { 'site-A': 'user-A', 'site-B': 'user-B' };
const CONTENT_BY_SITE: Record<string, Array<{ id: string }>> = {
  'site-A': [{ id: 'post-a1' }],
  'site-B': [{ id: 'post-b1' }],
};

let stubBackend: NodeHttpServer;
let stubUrl: string;
let served: ReturnType<typeof serve>;
let endpointUrl: string;

async function seed(): Promise<void> {
  const db = testDb.drizzle;
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(schema.users).values([
    { id: 'user-A', name: 'A', email: 'a@example.com', role: 'editor' },
    { id: 'user-B', name: 'B', email: 'b@example.com', role: 'editor' },
    { id: 'user-free', name: 'Free', email: 'free@example.com', role: 'viewer' },
  ]);

  await db.insert(schema.userDevices).values([
    {
      id: 'dev-A',
      userId: 'user-A',
      deviceId: 'device-A',
      deviceType: 'cli',
      tokenHash: tokenHash(TOKEN_A),
      tokenExpiresAt: future,
      isActive: true,
    },
    {
      id: 'dev-B',
      userId: 'user-B',
      deviceId: 'device-B',
      deviceType: 'cli',
      tokenHash: tokenHash(TOKEN_B),
      tokenExpiresAt: future,
      isActive: true,
    },
    {
      id: 'dev-free',
      userId: 'user-free',
      deviceId: 'device-free',
      deviceType: 'cli',
      tokenHash: tokenHash(TOKEN_FREE),
      tokenExpiresAt: future,
      isActive: true,
    },
  ]);

  // Accounts + memberships + entitlements. A and B are Pro (mcp enabled);
  // the free user has no account (falls to the free tier → no mcp feature).
  await db.insert(schema.accounts).values([
    { id: 'acct-A', name: 'Acct A', slug: 'acct-a' },
    { id: 'acct-B', name: 'Acct B', slug: 'acct-b' },
  ]);
  await db.insert(schema.accountMemberships).values([
    { id: 'mem-A', accountId: 'acct-A', userId: 'user-A', role: 'owner', status: 'active' },
    { id: 'mem-B', accountId: 'acct-B', userId: 'user-B', role: 'owner', status: 'active' },
  ]);
  await db.insert(schema.accountEntitlements).values([
    {
      id: 'ent-A',
      accountId: 'acct-A',
      planId: 'plan-pro',
      tier: 'pro',
      status: 'active',
      features: { mcp: true },
      mode: 'test',
    },
    {
      id: 'ent-B',
      accountId: 'acct-B',
      planId: 'plan-pro',
      tier: 'pro',
      status: 'active',
      features: { mcp: true },
      mode: 'test',
    },
  ]);
}

/** Stub REST backend: token → user, then site-ownership-scoped reads. */
function startStubBackend(): Promise<void> {
  const tokenToUser: Record<string, string> = {
    [`Bearer ${TOKEN_A}`]: 'user-A',
    [`Bearer ${TOKEN_B}`]: 'user-B',
  };
  stubBackend = createHttpServer((req, res) => {
    const user = tokenToUser[req.headers.authorization ?? ''];
    const url = new URL(req.url ?? '/', 'http://stub');
    res.setHeader('content-type', 'application/json');
    if (!user) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (url.pathname === '/api/sites') {
      const owned = Object.entries(SITE_OWNERS)
        .filter(([, owner]) => owner === user)
        .map(([id]) => ({ id }));
      res.statusCode = 200;
      res.end(JSON.stringify({ docs: owned }));
      return;
    }
    // /api/<collection> with a siteId → only rows the caller owns; any foreign
    // or unknown site returns the same empty shape (no existence oracle).
    if (url.pathname.startsWith('/api/')) {
      const siteId = url.searchParams.get('siteId') ?? '';
      const owns = SITE_OWNERS[siteId] === user;
      res.statusCode = 200;
      res.end(JSON.stringify({ docs: owns ? (CONTENT_BY_SITE[siteId] ?? []) : [] }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  });
  return new Promise<void>((resolve) => {
    stubBackend.listen(0, '127.0.0.1', () => {
      const { port } = stubBackend.address() as AddressInfo;
      stubUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

beforeAll(async () => {
  process.env.REVEALUI_SECRET = 'test-secret-value-at-least-32-chars-long!!';
  process.env.REVEALUI_API_KEY = 'ambient-admin-key-should-never-grant-access';
  testDb = await createTestDb();
  await seed();
  await startStubBackend();

  const app = createMcpEndpointApp({ selfApiBaseUrl: stubUrl });
  await new Promise<void>((resolve) => {
    served = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => {
      endpointUrl = `http://127.0.0.1:${info.port}/`;
      resolve();
    });
  });
});

afterAll(async () => {
  served?.close();
  stubBackend?.close();
});

function client(token: string): McpClient {
  return new McpClient({
    clientInfo: { name: 'e2e', version: '0.0.1' },
    transport: {
      kind: 'streamable-http',
      url: endpointUrl,
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    },
  });
}

function parseToolData(result: { content: Array<{ type: string; text?: string }> }): {
  data?: { docs?: Array<{ id: string }> };
} {
  const text = result.content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Acceptance + I-5 receipt + I-3 positive
// ---------------------------------------------------------------------------

describe('acceptance: full governed session', () => {
  it('initialize → tools/list → tools/call with a minted token, landing a receipt', async () => {
    const c = client(TOKEN_A);
    await c.connect();

    const tools = await c.listTools();
    expect(tools.map((t) => t.name)).toContain('revealui_list_sites');

    const result = (await c.callTool('revealui_list_sites', {})) as {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    };
    await c.close();

    expect(result.isError).toBeFalsy();
    expect(parseToolData(result).data?.docs).toEqual([{ id: 'site-A' }]);

    const rows = await testDb.drizzle
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.eventType, 'mcp:tool:invoked'));
    const row = rows.find((r) => (r.payload as { tool?: string }).tool === 'revealui_list_sites');
    expect(row).toBeDefined();
    // GAP-355 Stage 3: the MCP receipt no longer self-signs. It writes through
    // the one door, which signs only when a signer is injected (a production
    // signing deployment). This test env injects none, so the row lands honestly
    // UNSIGNED (signature NULL) — the signed round trip is covered end-to-end in
    // audit-signing-roundtrip.pglite.test.ts.
    expect(row?.signature).toBeNull();
    expect(row?.previousSignature).toBeNull();
    expect((row?.payload as { userId?: string }).userId).toBe('user-A');
    expect(row?.agentId).toBe('mcp:e2e');
  });
});

// ---------------------------------------------------------------------------
// I-2 — client-supplied scope needs an ownership check (no existence oracle)
// ---------------------------------------------------------------------------

describe('I-2 no client-supplied scope without ownership', () => {
  it("A gets an empty, shape-identical response for B's site and for a random UUID", async () => {
    const c = client(TOKEN_A);
    await c.connect();

    const own = parseToolData(
      (await c.callTool('revealui_list_content', {
        collection: 'posts',
        site_id: 'site-A',
      })) as never,
    );
    const foreign = parseToolData(
      (await c.callTool('revealui_list_content', {
        collection: 'posts',
        site_id: 'site-B',
      })) as never,
    );
    const nonexistent = parseToolData(
      (await c.callTool('revealui_list_content', {
        collection: 'posts',
        site_id: randomUUID(),
      })) as never,
    );
    await c.close();

    // A sees its own content...
    expect(own.data?.docs).toEqual([{ id: 'post-a1' }]);
    // ...but B's site and a random id are byte-identical empty responses.
    expect(foreign.data?.docs).toEqual([]);
    expect(JSON.stringify(foreign.data)).toBe(JSON.stringify(nonexistent.data));
    // None of B's content leaked.
    expect(JSON.stringify(foreign)).not.toContain('post-b1');
  });
});

// ---------------------------------------------------------------------------
// I-3 — the session id is never authority
// ---------------------------------------------------------------------------

describe('I-3 the session id is never authority', () => {
  async function rawInitialize(token: string): Promise<string> {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'raw', version: '0.0.1' },
        },
      }),
    });
    const sid = res.headers.get('mcp-session-id');
    if (!sid) throw new Error('no session id issued');
    return sid;
  }

  function rawRequest(sessionId: string, token?: string): Promise<Response> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
  }

  it('rejects a replayed session id with no token (401)', async () => {
    const sid = await rawInitialize(TOKEN_A);
    const res = await rawRequest(sid);
    expect(res.status).toBe(401);
  });

  it("rejects another user's token on the session and terminates it (401)", async () => {
    const sid = await rawInitialize(TOKEN_A);

    const mismatch = await rawRequest(sid, TOKEN_B);
    expect(mismatch.status).toBe(401);

    // The session was terminated: even A's own token can no longer use it.
    const afterTermination = await rawRequest(sid, TOKEN_A);
    expect(afterTermination.status).not.toBe(200);
  });
});

// ---------------------------------------------------------------------------
// I-4 — no ambient service credential on the governed path
// ---------------------------------------------------------------------------

describe('I-4 no ambient service credential', () => {
  it('401s an unauthenticated request even with REVEALUI_API_KEY set', async () => {
    expect(process.env.REVEALUI_API_KEY).toBeTruthy();
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'x', version: '0' },
        },
      }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// I-6 — expiry / revocation honored per request, mid-session
// ---------------------------------------------------------------------------

describe('I-6 revocation honored mid-session', () => {
  it('a request fails once the device is deactivated', async () => {
    const c = client(TOKEN_B);
    await c.connect();
    // Works while active.
    const first = (await c.callTool('revealui_list_sites', {})) as { isError?: boolean };
    expect(first.isError).toBeFalsy();

    // Revoke the device mid-session.
    await testDb.drizzle
      .update(schema.userDevices)
      .set({ isActive: false })
      .where(eq(schema.userDevices.id, 'dev-B'));

    // The next call on the same session must fail — the token no longer resolves.
    await expect(c.callTool('revealui_list_sites', {})).rejects.toThrow();
    await c.close().catch(() => undefined);
  });
});

// ---------------------------------------------------------------------------
// requireFeature('mcp') gate
// ---------------------------------------------------------------------------

describe('entitlement gate', () => {
  it('denies a free-tier caller (no mcp feature)', async () => {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN_FREE}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'x', version: '0' },
        },
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Regression: the bridge must survive the production middleware stack
// ---------------------------------------------------------------------------

describe('bridge tolerates upstream middleware touching the request body (GAP-371 Phase 4)', () => {
  // Found live (2026-07-17): through the REAL server every Initialize
  // arrived body-less at the bridge and session bootstrap failed with
  // "Session ID required", while this suite stayed green — its app mounts
  // no global middleware. The exact stream-claimer in the production stack
  // was not isolated (this gate-mounted repro alone did NOT reproduce it),
  // so the fix removes the dependency class instead: the bridge parses the
  // body web-side and passes it through, verified by a live A/B against
  // the built server (base build fails, fixed build completes the loop).
  // This case pins the pass-through path under a body-touching middleware.
  let gatedServed: ReturnType<typeof serve> | undefined;
  let gatedUrl = '';

  beforeAll(async () => {
    const { Hono } = await import('hono');
    const { bodyLimitGate } = await import('../../middleware/body-limits.js');
    const app = new Hono();
    app.use('*', bodyLimitGate());
    app.route('/', createMcpEndpointApp({ selfApiBaseUrl: stubUrl }));
    await new Promise<void>((resolve) => {
      gatedServed = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => {
        gatedUrl = `http://127.0.0.1:${info.port}/`;
        resolve();
      });
    });
  });

  afterAll(() => {
    gatedServed?.close();
  });

  it('initialize → tools/list → tools/call complete through the gate', async () => {
    const c = new McpClient({
      clientInfo: { name: 'e2e-gated', version: '0.0.1' },
      transport: {
        kind: 'streamable-http',
        url: gatedUrl,
        requestInit: { headers: { Authorization: `Bearer ${TOKEN_A}` } },
      },
    });
    await c.connect();
    const tools = await c.listTools();
    expect(tools.map((t) => t.name)).toContain('revealui_list_sites');

    const result = (await c.callTool('revealui_list_sites', {})) as {
      isError?: boolean;
    };
    expect(result.isError).toBeFalsy();
    await c.close();
  });
});
