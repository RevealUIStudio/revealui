/**
 * Governed MCP endpoint — Phase 2 authorization / quota / session invariants
 * (GAP-371 §6, I-7..I-10) against a REAL migrated schema (PGlite), the real
 * `@hono/node-server`, and the real `@modelcontextprotocol/sdk` client.
 *
 * The Phase-1 pglite test proves identity/audit (I-1..I-6). This proves the
 * Phase-2 depth with the REAL policy (RBAC + tier gate + `McpRateLimiter` +
 * entitlement-derived tier + session caps/TTL):
 *
 *   I-7   role gate: a viewer does not see/execute `revealui_list_users`;
 *         tier gate (free vs pro discovery): a free-tier caller does not
 *         see/execute the pro-gated tool; both denials are audited (authz).
 *   I-8   per-user + tier rate limit: exceeding denies with reason rate-limit;
 *         a second user is unaffected.
 *   I-9   the effective tier is server-derived: a client-supplied tier header is
 *         ignored; the outcome follows the account entitlement.
 *   I-10  sessions are bounded: opening past the per-user cap evicts the oldest;
 *         a session idle past the TTL no longer accepts requests.
 */

import { createHash } from 'node:crypto';
import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import * as schema from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { McpClient } from '@revealui/mcp/client';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMcpEndpointApp, type McpEndpointConfig } from '../mcp-endpoint.js';

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});
vi.mock('@revealui/auth/server', () => ({ getSession: async () => null }));

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// role admin / tier pro
const TOKEN_ADMIN_PRO = `rvui_dev_${'1'.repeat(64)}`;
// role viewer / tier pro
const TOKEN_VIEWER_PRO = `rvui_dev_${'2'.repeat(64)}`;
// role admin / tier free (with the mcp feature)
const TOKEN_ADMIN_FREE = `rvui_dev_${'3'.repeat(64)}`;
// role admin / tier pro — second user for rate-limit isolation
const TOKEN_ADMIN_PRO_B = `rvui_dev_${'4'.repeat(64)}`;

const TOKEN_TO_USER: Record<string, string> = {
  [`Bearer ${TOKEN_ADMIN_PRO}`]: 'user-admin-pro',
  [`Bearer ${TOKEN_VIEWER_PRO}`]: 'user-viewer-pro',
  [`Bearer ${TOKEN_ADMIN_FREE}`]: 'user-admin-free',
  [`Bearer ${TOKEN_ADMIN_PRO_B}`]: 'user-admin-pro-b',
};

let stubBackend: NodeHttpServer;
let stubUrl: string;
const servedApps: Array<ReturnType<typeof serve>> = [];

// Injectable clock for the session TTL/cap invariants (I-10).
let clockNow = 1_000_000;
const clock = (): number => clockNow;

async function seed(): Promise<void> {
  const db = testDb.drizzle;
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(schema.users).values([
    { id: 'user-admin-pro', name: 'AdminPro', email: 'adminpro@example.com', role: 'admin' },
    { id: 'user-viewer-pro', name: 'ViewerPro', email: 'viewerpro@example.com', role: 'viewer' },
    { id: 'user-admin-free', name: 'AdminFree', email: 'adminfree@example.com', role: 'admin' },
    { id: 'user-admin-pro-b', name: 'AdminProB', email: 'adminprob@example.com', role: 'admin' },
  ]);

  await db.insert(schema.userDevices).values(
    [
      ['dev-admin-pro', 'user-admin-pro', TOKEN_ADMIN_PRO],
      ['dev-viewer-pro', 'user-viewer-pro', TOKEN_VIEWER_PRO],
      ['dev-admin-free', 'user-admin-free', TOKEN_ADMIN_FREE],
      ['dev-admin-pro-b', 'user-admin-pro-b', TOKEN_ADMIN_PRO_B],
    ].map(([id, userId, token]) => ({
      id,
      userId,
      deviceId: `device-${id}`,
      deviceType: 'cli' as const,
      tokenHash: tokenHash(token),
      tokenExpiresAt: future,
      isActive: true,
    })),
  );

  await db.insert(schema.accounts).values([
    { id: 'acct-admin-pro', name: 'AdminPro', slug: 'acct-admin-pro' },
    { id: 'acct-viewer-pro', name: 'ViewerPro', slug: 'acct-viewer-pro' },
    { id: 'acct-admin-free', name: 'AdminFree', slug: 'acct-admin-free' },
    { id: 'acct-admin-pro-b', name: 'AdminProB', slug: 'acct-admin-pro-b' },
  ]);

  await db.insert(schema.accountMemberships).values([
    {
      id: 'mem-1',
      accountId: 'acct-admin-pro',
      userId: 'user-admin-pro',
      role: 'owner',
      status: 'active',
    },
    {
      id: 'mem-2',
      accountId: 'acct-viewer-pro',
      userId: 'user-viewer-pro',
      role: 'owner',
      status: 'active',
    },
    {
      id: 'mem-3',
      accountId: 'acct-admin-free',
      userId: 'user-admin-free',
      role: 'owner',
      status: 'active',
    },
    {
      id: 'mem-4',
      accountId: 'acct-admin-pro-b',
      userId: 'user-admin-pro-b',
      role: 'owner',
      status: 'active',
    },
  ]);

  // Every account has the `mcp` feature (so it can reach `/api/mcp`); the
  // difference driving I-7 tier-gating is the TIER (free vs pro).
  await db.insert(schema.accountEntitlements).values([
    {
      id: 'ent-1',
      accountId: 'acct-admin-pro',
      planId: 'p',
      tier: 'pro',
      status: 'active',
      features: { mcp: true },
      mode: 'test',
    },
    {
      id: 'ent-2',
      accountId: 'acct-viewer-pro',
      planId: 'p',
      tier: 'pro',
      status: 'active',
      features: { mcp: true },
      mode: 'test',
    },
    {
      id: 'ent-3',
      accountId: 'acct-admin-free',
      planId: 'p',
      tier: 'free',
      status: 'active',
      features: { mcp: true },
      mode: 'test',
    },
    {
      id: 'ent-4',
      accountId: 'acct-admin-pro-b',
      planId: 'p',
      tier: 'pro',
      status: 'active',
      features: { mcp: true },
      mode: 'test',
    },
  ]);
}

/** Stub REST backend: any known token → 200 for every `/api/*` path. */
function startStubBackend(): Promise<void> {
  stubBackend = createHttpServer((req, res) => {
    const user = TOKEN_TO_USER[req.headers.authorization ?? ''];
    res.setHeader('content-type', 'application/json');
    if (!user) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    res.statusCode = 200;
    res.end(JSON.stringify({ docs: [] }));
  });
  return new Promise<void>((resolve) => {
    stubBackend.listen(0, '127.0.0.1', () => {
      const { port } = stubBackend.address() as AddressInfo;
      stubUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

/** Serve a governed endpoint on an ephemeral port with the given config. */
function startEndpoint(config: Omit<McpEndpointConfig, 'selfApiBaseUrl'> = {}): Promise<string> {
  const app = createMcpEndpointApp({ selfApiBaseUrl: stubUrl, ...config });
  return new Promise<string>((resolve) => {
    const served = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => {
      resolve(`http://127.0.0.1:${info.port}/`);
    });
    servedApps.push(served);
  });
}

function client(token: string, url: string, extraHeaders: Record<string, string> = {}): McpClient {
  return new McpClient({
    clientInfo: { name: 'authz-e2e', version: '0.0.1' },
    transport: {
      kind: 'streamable-http',
      url,
      requestInit: { headers: { Authorization: `Bearer ${token}`, ...extraHeaders } },
    },
  });
}

interface DeniedRow {
  reason?: string;
  tool?: string;
  userId?: string;
}

async function deniedRows(): Promise<DeniedRow[]> {
  const rows = await testDb.drizzle
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.eventType, 'mcp:tool:denied'));
  return rows.map((r) => r.payload as DeniedRow);
}

async function rawInitialize(url: string, token: string): Promise<string> {
  const res = await fetch(url, {
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
        clientInfo: { name: 'raw', version: '0' },
      },
    }),
  });
  const sid = res.headers.get('mcp-session-id');
  if (!sid) throw new Error('no session id issued');
  return sid;
}

function rawRequest(url: string, sessionId: string, token: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
  });
}

beforeAll(async () => {
  process.env.REVEALUI_SECRET = 'test-secret-value-at-least-32-chars-long!!';
  testDb = await createTestDb();
  await seed();
  await startStubBackend();
});

afterAll(async () => {
  for (const served of servedApps) served.close();
  stubBackend?.close();
});

// ---------------------------------------------------------------------------
// I-7 — discovery and execution are independently authorized (role gate)
// ---------------------------------------------------------------------------

describe('I-7 role gate: viewer cannot see or execute list_users', () => {
  it('filters tools/list by role and denies a direct call (audited authz)', async () => {
    const url = await startEndpoint();

    const admin = client(TOKEN_ADMIN_PRO, url);
    await admin.connect();
    const adminTools = (await admin.listTools()).map((t) => t.name);
    await admin.close();
    expect(adminTools).toContain('revealui_list_users');
    expect(adminTools).toContain('kg_add_episode');
    expect(adminTools).toContain('kg_search');

    const viewer = client(TOKEN_VIEWER_PRO, url);
    await viewer.connect();
    const viewerTools = (await viewer.listTools()).map((t) => t.name);
    expect(viewerTools).toContain('revealui_list_sites');
    expect(viewerTools).toContain('kg_search');
    expect(viewerTools).not.toContain('revealui_list_users');
    expect(viewerTools).not.toContain('kg_add_episode');

    // A tool absent from the list is STILL independently denied on a direct call.
    const denied = await viewer.callTool('revealui_list_users', {});
    const kgWriteDenied = await viewer.callTool('kg_add_episode', { episodeType: 'agent-fact' });
    await viewer.close();
    expect(denied.isError).toBe(true);
    expect(kgWriteDenied.isError).toBe(true);

    const rows = await deniedRows();
    expect(
      rows.some(
        (r) =>
          r.userId === 'user-viewer-pro' &&
          r.tool === 'revealui_list_users' &&
          r.reason === 'authz',
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// I-7 — free-vs-pro discovery (tier gate)
// ---------------------------------------------------------------------------

describe('I-7 tier gate: free tier never sees/executes the pro-gated tool', () => {
  it('a free-tier admin lacks list_users; a pro admin has it', async () => {
    const url = await startEndpoint();

    const free = client(TOKEN_ADMIN_FREE, url);
    await free.connect();
    const freeTools = (await free.listTools()).map((t) => t.name);
    expect(freeTools).toContain('revealui_list_sites'); // content reads on every tier
    expect(freeTools).not.toContain('revealui_list_users'); // pro-gated

    const denied = await free.callTool('revealui_list_users', {});
    await free.close();
    expect(denied.isError).toBe(true);

    const rows = await deniedRows();
    expect(
      rows.some(
        (r) =>
          r.userId === 'user-admin-free' &&
          r.tool === 'revealui_list_users' &&
          r.reason === 'authz',
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// I-8 — rate limits bind per user + tier
// ---------------------------------------------------------------------------

describe('I-8 per-user + tier rate limit', () => {
  it('denies once the tier limit is exceeded; a second user is unaffected', async () => {
    const url = await startEndpoint({ rateLimits: { pro: { maxRequests: 2, windowMs: 60_000 } } });

    const a = client(TOKEN_ADMIN_PRO, url);
    await a.connect();
    const first = await a.callTool('revealui_list_sites', {});
    const second = await a.callTool('revealui_list_sites', {});
    const third = await a.callTool('revealui_list_sites', {});
    await a.close();

    expect(first.isError).toBeFalsy();
    expect(second.isError).toBeFalsy();
    expect(third.isError).toBe(true); // over the limit

    // A different user has an independent budget.
    const b = client(TOKEN_ADMIN_PRO_B, url);
    await b.connect();
    const bCall = await b.callTool('revealui_list_sites', {});
    await b.close();
    expect(bCall.isError).toBeFalsy();

    const rows = await deniedRows();
    expect(
      rows.some(
        (r) =>
          r.userId === 'user-admin-pro' &&
          r.tool === 'revealui_list_sites' &&
          r.reason === 'rate-limit',
      ),
    ).toBe(true);
    // The second user was never rate-limited.
    expect(rows.some((r) => r.userId === 'user-admin-pro-b' && r.reason === 'rate-limit')).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// I-9 — the effective tier is server-derived (client input ignored)
// ---------------------------------------------------------------------------

describe('I-9 tier is server-derived', () => {
  it('a client-supplied tier header is ignored; the outcome follows the entitlement', async () => {
    const url = await startEndpoint();
    const spoofHeader = { 'X-RevealUI-Tier': 'enterprise' };

    // Free-tier caller SHOUTS enterprise via a header — still denied the pro tool.
    const free = client(TOKEN_ADMIN_FREE, url, spoofHeader);
    await free.connect();
    const freeTools = (await free.listTools()).map((t) => t.name);
    const freeDenied = await free.callTool('revealui_list_users', {});
    await free.close();
    expect(freeTools).not.toContain('revealui_list_users');
    expect(freeDenied.isError).toBe(true);

    // Pro-tier caller sending the SAME header is allowed — the difference is the
    // entitlement record, not the client-supplied tier.
    const pro = client(TOKEN_ADMIN_PRO, url, spoofHeader);
    await pro.connect();
    const proAllowed = await pro.callTool('revealui_list_users', {});
    await pro.close();
    expect(proAllowed.isError).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// Metering — one usage_meters row per executed call, source `agent` (§5.5 tail)
// ---------------------------------------------------------------------------

describe('metering writes an agent-sourced usage row per executed call', () => {
  it('records a source=agent usage_meters row for an executed tool call', async () => {
    const url = await startEndpoint();
    const c = client(TOKEN_ADMIN_PRO_B, url);
    await c.connect();
    const result = await c.callTool('revealui_list_sites', {});
    await c.close();
    expect(result.isError).toBeFalsy();

    const rows = await testDb.drizzle
      .select()
      .from(schema.usageMeters)
      .where(eq(schema.usageMeters.accountId, 'acct-admin-pro-b'));
    expect(rows.length).toBeGreaterThan(0);
    // Billing sink stays separate from the audit sink; every MCP row is agent-sourced.
    expect(rows.every((r) => r.source === 'agent')).toBe(true);
    expect(rows.some((r) => r.meterName === 'mcp.tool.call')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// I-10 — sessions are bounded (per-user cap + idle TTL)
// ---------------------------------------------------------------------------

describe('I-10 sessions are bounded', () => {
  it('opening past the per-user cap evicts the oldest session', async () => {
    clockNow = 5_000_000;
    const url = await startEndpoint({ maxSessionsPerUser: 2, now: clock });

    const first = await rawInitialize(url, TOKEN_ADMIN_PRO);
    clockNow += 1;
    await rawInitialize(url, TOKEN_ADMIN_PRO);
    clockNow += 1;
    const third = await rawInitialize(url, TOKEN_ADMIN_PRO);

    // The oldest session was evicted when the 3rd opened (cap = 2).
    const evicted = await rawRequest(url, first, TOKEN_ADMIN_PRO);
    expect(evicted.status).not.toBe(200);
    // The newest session still works.
    const alive = await rawRequest(url, third, TOKEN_ADMIN_PRO);
    expect(alive.status).toBe(200);
  });

  it('a session idle past the TTL no longer accepts requests', async () => {
    clockNow = 9_000_000;
    const url = await startEndpoint({ idleSessionTtlMs: 100, now: clock });

    const sid = await rawInitialize(url, TOKEN_ADMIN_PRO);
    // Within the TTL: still accepted.
    clockNow += 50;
    const withinTtl = await rawRequest(url, sid, TOKEN_ADMIN_PRO);
    expect(withinTtl.status).toBe(200);

    // Past the TTL: refused.
    clockNow += 500;
    const expired = await rawRequest(url, sid, TOKEN_ADMIN_PRO);
    expect(expired.status).toBe(401);
  });
});
