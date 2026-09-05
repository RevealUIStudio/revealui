/**
 * Hosted pair on `/api/mcp`: two editor device tokens on one accountId
 * (Cursor HTTP × OpenCode HTTP) share durable knowledge-graph memory.
 * A third token on a different account is denied. Graph-down WARNs without
 * blocking the content path.
 */

import { createHash } from 'node:crypto';
import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { serve } from '@hono/node-server';
import * as schema from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { type KgExecutor, kgDdlStatements, makeExecutor } from '@revealui/knowledge-graph';
import { httpFallbackDid } from '@revealui/knowledge-graph/memory';
import { McpClient } from '@revealui/mcp/client';
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

const TOKEN_CURSOR = `rvui_dev_${'c'.repeat(64)}`;
const TOKEN_OPENCODE = `rvui_dev_${'o'.repeat(64)}`;
const TOKEN_OTHER = `rvui_dev_${'x'.repeat(64)}`;

const TOKEN_TO_USER: Record<string, string> = {
  [`Bearer ${TOKEN_CURSOR}`]: 'user-cursor',
  [`Bearer ${TOKEN_OPENCODE}`]: 'user-opencode',
  [`Bearer ${TOKEN_OTHER}`]: 'user-other',
};

let stubBackend: NodeHttpServer;
let stubUrl: string;
const servedApps: Array<ReturnType<typeof serve>> = [];
let kgExec: KgExecutor;
let kgClose: () => Promise<void>;

const FINDING = 'hosted-pair-lantern';

async function seed(): Promise<void> {
  const db = testDb.drizzle;
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(schema.users).values([
    { id: 'user-cursor', name: 'Cursor', email: 'cursor@example.com', role: 'editor' },
    { id: 'user-opencode', name: 'OpenCode', email: 'opencode@example.com', role: 'editor' },
    { id: 'user-other', name: 'Other', email: 'other@example.com', role: 'editor' },
  ]);

  await db.insert(schema.userDevices).values(
    [
      ['dev-cursor', 'user-cursor', TOKEN_CURSOR],
      ['dev-opencode', 'user-opencode', TOKEN_OPENCODE],
      ['dev-other', 'user-other', TOKEN_OTHER],
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
    { id: 'acct-shared', name: 'Shared', slug: 'acct-shared' },
    { id: 'acct-other', name: 'Other', slug: 'acct-other' },
  ]);
  await db.insert(schema.accountMemberships).values([
    {
      id: 'mem-cursor',
      accountId: 'acct-shared',
      userId: 'user-cursor',
      role: 'owner',
      status: 'active',
    },
    {
      id: 'mem-opencode',
      accountId: 'acct-shared',
      userId: 'user-opencode',
      role: 'owner',
      status: 'active',
    },
    {
      id: 'mem-other',
      accountId: 'acct-other',
      userId: 'user-other',
      role: 'owner',
      status: 'active',
    },
  ]);
  await db.insert(schema.accountEntitlements).values([
    {
      id: 'ent-shared',
      accountId: 'acct-shared',
      planId: 'p',
      tier: 'pro',
      status: 'active',
      features: { mcp: true },
      mode: 'test',
    },
    {
      id: 'ent-other',
      accountId: 'acct-other',
      planId: 'p',
      tier: 'pro',
      status: 'active',
      features: { mcp: true },
      mode: 'test',
    },
  ]);
}

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
    res.end(JSON.stringify({ docs: [{ id: 'site-ok' }] }));
  });
  return new Promise<void>((resolve) => {
    stubBackend.listen(0, '127.0.0.1', () => {
      const { port } = stubBackend.address() as AddressInfo;
      stubUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function startEndpoint(config: Omit<McpEndpointConfig, 'selfApiBaseUrl'> = {}): Promise<string> {
  const app = createMcpEndpointApp({ selfApiBaseUrl: stubUrl, kgTimeoutMs: 0, ...config });
  return new Promise<string>((resolve) => {
    const served = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => {
      resolve(`http://127.0.0.1:${info.port}/`);
    });
    servedApps.push(served);
  });
}

function client(token: string, url: string, name: string): McpClient {
  return new McpClient({
    clientInfo: { name, version: '0.0.1' },
    transport: {
      kind: 'streamable-http',
      url,
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    },
  });
}

function parseKg<T>(result: { content: Array<{ type: string; text?: string }> }): T {
  const text = result.content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text) as T;
}

function findingArgs(label: string, userId: string): Record<string, unknown> {
  const did = httpFallbackDid(userId, 'acct-shared');
  return {
    episodeType: 'agent-fact',
    content: `${FINDING} recorded by ${label}`,
    classification: 'workspace',
    nodes: [
      { kind: 'agent', name: label, naturalKey: did.did },
      { kind: 'concept', name: FINDING, naturalKey: `concept:${FINDING}` },
    ],
    edges: [
      {
        source: { kind: 'agent', naturalKey: did.did },
        target: { kind: 'concept', naturalKey: `concept:${FINDING}` },
        relation: 'discovered',
        fact: `${label} discovered ${FINDING}`,
      },
    ],
  };
}

beforeAll(async () => {
  process.env.REVEALUI_SECRET = 'test-secret-value-at-least-32-chars-long!!';
  testDb = await createTestDb();
  await seed();
  await startStubBackend();
  const pglite = new PGlite();
  for (const statement of kgDdlStatements({ variant: 'portable' })) {
    await pglite.exec(statement);
  }
  kgExec = makeExecutor(pglite);
  kgClose = () => pglite.close();
}, 60_000);

afterAll(async () => {
  for (const s of servedApps) s.close();
  stubBackend?.close();
  await kgClose?.();
});

describe.sequential('hosted pair on /api/mcp (one accountId)', () => {
  it('Cursor publishes and OpenCode search returns the provenance episode id', async () => {
    const url = await startEndpoint({ kgExecutor: kgExec });
    const cursor = client(TOKEN_CURSOR, url, 'cursor');
    const opencode = client(TOKEN_OPENCODE, url, 'opencode');
    await cursor.connect();
    await opencode.connect();

    const published = await cursor.callTool('kg_add_episode', findingArgs('cursor', 'user-cursor'));
    expect(published.isError).toBeFalsy();
    const written = parseKg<{ status: string; data: { episodeId: string } }>(published);
    expect(written.status).toBe('ok');
    expect(written.data.episodeId).toBeTruthy();

    const searched = await opencode.callTool('kg_search', { query: FINDING });
    expect(searched.isError).toBeFalsy();
    const body = parseKg<{
      status: string;
      data: { facts: Array<{ episodeIds: string[] }> };
    }>(searched);
    expect(body.status).toBe('ok');
    expect(body.data.facts.some((f) => f.episodeIds.includes(written.data.episodeId))).toBe(true);

    await cursor.close();
    await opencode.close();
  }, 60_000);

  it('also works in reverse: OpenCode publishes, Cursor search matches episode id', async () => {
    const url = await startEndpoint({ kgExecutor: kgExec });
    const cursor = client(TOKEN_CURSOR, url, 'cursor');
    const opencode = client(TOKEN_OPENCODE, url, 'opencode');
    await cursor.connect();
    await opencode.connect();

    const published = await opencode.callTool(
      'kg_add_episode',
      findingArgs('opencode', 'user-opencode'),
    );
    expect(published.isError).toBeFalsy();
    const written = parseKg<{ data: { episodeId: string } }>(published);
    const searched = await cursor.callTool('kg_search', { query: FINDING });
    await cursor.close();
    await opencode.close();
    const body = parseKg<{ data: { facts: Array<{ episodeIds: string[] }> } }>(searched);
    expect(body.data.facts.some((f) => f.episodeIds.includes(written.data.episodeId))).toBe(true);
  }, 60_000);

  it('denies a different accountId on the same mount', async () => {
    const url = await startEndpoint({ kgExecutor: kgExec });
    const other = client(TOKEN_OTHER, url, 'cursor');
    await other.connect();
    const searched = await other.callTool('kg_search', { query: FINDING });
    await other.close();
    expect(searched.isError).toBeFalsy();
    const body = parseKg<{ status: string }>(searched);
    expect(body.status).toBe('denied');
  }, 60_000);

  it('graph-down kg_search is unavailable; content tools still work', async () => {
    const down: KgExecutor = {
      query: async () => {
        throw new Error('ECONNREFUSED neon');
      },
      transaction: async () => {
        throw new Error('ECONNREFUSED neon');
      },
    };
    const url = await startEndpoint({ kgExecutor: down });
    const opencode = client(TOKEN_OPENCODE, url, 'opencode');
    await opencode.connect();
    const kg = await opencode.callTool('kg_search', { query: FINDING });
    expect(kg.isError).toBe(true);
    const body = parseKg<{ status: string; message: string }>(kg);
    expect(body.status).toBe('unavailable');
    expect(JSON.stringify(body)).not.toContain('no facts');

    const content = await opencode.callTool('revealui_list_sites', {});
    await opencode.close();
    expect(content.isError).toBeFalsy();
  });

  it('does not block B on a hung A kg publish', async () => {
    const hanging: KgExecutor = {
      query: () => new Promise(() => undefined),
      transaction: () => new Promise(() => undefined),
    };
    const url = await startEndpoint({ kgExecutor: hanging, kgTimeoutMs: 50 });
    const cursor = client(TOKEN_CURSOR, url, 'cursor');
    const opencode = client(TOKEN_OPENCODE, url, 'opencode');
    await cursor.connect();
    await opencode.connect();

    const aPublish = cursor.callTool('kg_add_episode', findingArgs('cursor', 'user-cursor'));
    const bContent = opencode.callTool('revealui_list_sites', {});
    const b = await bContent;
    expect(b.isError).toBeFalsy();
    const a = await aPublish;
    expect(a.isError).toBe(true);
    await cursor.close();
    await opencode.close();
  });
});
