/**
 * Product-mode coverage for the knowledge-graph MCP toolset: extra threading,
 * actor stamp, envelope, timeout, hosted scoped reads, audit fail-closed.
 * Compat-mode unwrapped JSON lives in knowledge-graph-factory.test.ts.
 */

import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  ingestEpisode,
  type KgExecutor,
  kgDdlStatements,
  makeExecutor,
  type NodeInput,
} from '@revealui/knowledge-graph';
import { type MemoryPrincipal, tenantNaturalKey } from '@revealui/knowledge-graph/memory';
import { afterEach, describe, expect, it } from 'vitest';
import { McpClient } from '../src/client.js';
import {
  createKnowledgeGraphServer,
  createKnowledgeGraphToolset,
  KgProductAddEpisodeArgsSchema,
} from '../src/servers/factories/knowledge-graph.js';
import type { McpToolAuditRecord } from '../src/servers/factories/revealui-content.js';
import { createNodeStreamableHttpHandler } from '../src/streamable-http.js';

interface TestDb {
  exec: KgExecutor;
  close: () => Promise<void>;
}

async function createTestDb(): Promise<TestDb> {
  const pglite = new PGlite();
  for (const statement of kgDdlStatements({ variant: 'portable' })) {
    await pglite.exec(statement);
  }
  return { exec: makeExecutor(pglite), close: () => pglite.close() };
}

const FILE_KEY = 'revealui/packages/ai/src/llm/client.ts';
const T = new Date('2026-07-01T00:00:00Z');

async function seed(exec: KgExecutor): Promise<void> {
  const nodes: NodeInput[] = [
    {
      kind: 'file',
      name: 'client.ts',
      naturalKey: FILE_KEY,
      repo: 'revealui',
      summary: 'the LLM client factory',
    },
  ];
  await ingestEpisode(exec, {
    episode: {
      episodeType: 'code-scan',
      source: 'test',
      siteId: 'test-site',
      referenceTime: T,
      contentRef: { repo: 'revealui' },
    },
    nodes,
    edges: [],
  });
}

function studioPrincipal(partial: Partial<MemoryPrincipal> = {}): MemoryPrincipal {
  return {
    did: 'did:revfleet:grok-1:fpabc',
    agentId: 'grok-1',
    fingerprint: 'fpabc',
    didKind: 'agent-key',
    harness: 'grok',
    tenantId: 'studio-local',
    trustBoundary: 'studio-local',
    isFleetOperator: true,
    ...partial,
  };
}

function hostedPrincipal(partial: Partial<MemoryPrincipal> = {}): MemoryPrincipal {
  return {
    did: 'did:revfleet:user_abc:fpxyz',
    agentId: 'user_abc',
    fingerprint: 'fpxyz',
    didKind: 'user-account-fallback',
    harness: 'cursor',
    tenantId: 'acct_1',
    trustBoundary: 'hosted',
    isFleetOperator: false,
    ...partial,
  };
}

function call(name: string, args?: Record<string, unknown>): CallToolRequest {
  return {
    method: 'tools/call',
    params: { name, arguments: args },
  } as CallToolRequest;
}

function parseJson<T>(result: CallToolResult): T {
  const first = result.content[0];
  if (first?.type !== 'text' || !('text' in first)) {
    throw new Error('expected text content');
  }
  return JSON.parse(first.text) as T;
}

const teardowns: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (teardowns.length > 0) {
    const t = teardowns.pop();
    if (t) await t().catch(() => undefined);
  }
});

describe('KgProductAddEpisodeArgsSchema', () => {
  it('rejects code-scan and public classification', () => {
    expect(
      KgProductAddEpisodeArgsSchema.safeParse({
        episodeType: 'code-scan',
        content: 'laundered',
      }).success,
    ).toBe(false);
    expect(
      KgProductAddEpisodeArgsSchema.safeParse({
        episodeType: 'agent-fact',
        classification: 'public',
      }).success,
    ).toBe(false);
  });

  it('caps nodes, edges, and content', () => {
    const nodes = Array.from({ length: 33 }, (_, i) => ({
      kind: 'concept',
      name: `n${i}`,
      naturalKey: `concept:n${i}`,
    }));
    expect(
      KgProductAddEpisodeArgsSchema.safeParse({ episodeType: 'agent-fact', nodes }).success,
    ).toBe(false);
    expect(
      KgProductAddEpisodeArgsSchema.safeParse({
        episodeType: 'memory',
        content: 'x'.repeat(20_001),
      }).success,
    ).toBe(false);
  });

  it('accepts a private agent-fact without source', () => {
    const parsed = KgProductAddEpisodeArgsSchema.safeParse({
      episodeType: 'agent-fact',
      classification: 'private',
      content: 'finding',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('createKnowledgeGraphToolset product mode', () => {
  it('lists the seven kg_* tools and does not add publish/subscribe/claim', () => {
    const toolset = createKnowledgeGraphToolset({ mode: 'product', timeoutMs: 0 });
    expect([...toolset.names].sort()).toEqual(
      [
        'kg_add_episode',
        'kg_at_time',
        'kg_context',
        'kg_get_node',
        'kg_neighbors',
        'kg_path',
        'kg_search',
      ].sort(),
    );
    expect(toolset.names.has('kg_publish')).toBe(false);
    expect(toolset.names.has('kg_subscribe')).toBe(false);
    expect(toolset.names.has('kg_claim')).toBe(false);
    const add = toolset.tools.find((t) => t.name === 'kg_add_episode');
    const episodeType = add?.inputSchema.properties?.episodeType as { enum?: string[] } | undefined;
    expect(episodeType?.enum).toEqual(['agent-fact', 'memory', 'manual']);
  });

  it('threads extra.authInfo and extra.sessionId into principalProvider', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const seen: Array<{ authInfo?: unknown; sessionId?: string }> = [];
    const toolset = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'studio-local',
      principalProvider: (ctx) => {
        seen.push({ authInfo: ctx.authInfo, sessionId: ctx.sessionId });
        return studioPrincipal();
      },
    });
    const result = await toolset.dispatch(call('kg_search', { query: 'client' }), {
      authInfo: { userId: 'u1' },
      sessionId: 'sess-9',
    });
    expect(result.isError).not.toBe(true);
    expect(seen[0]).toEqual({ authInfo: { userId: 'u1' }, sessionId: 'sess-9' });
  });

  it('wraps reads in the product envelope with nested data', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const toolset = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      principalProvider: () => studioPrincipal(),
    });
    const search = await toolset.dispatch(call('kg_search', { query: 'client' }));
    const body = parseJson<{
      status: string;
      available: boolean;
      enforcement: string;
      deniedCount: number;
      data: { nodes: Array<{ naturalKey: string }> };
    }>(search);
    expect(body.status).toBe('ok');
    expect(body.available).toBe(true);
    expect(body.enforcement).toBe('deferred');
    expect(body.deniedCount).toBe(0);
    expect(body.data.nodes.some((n) => n.naturalKey === FILE_KEY)).toBe(true);

    const context = await toolset.dispatch(call('kg_context', { naturalKey: FILE_KEY }));
    const packed = parseJson<{ data: { context: string } }>(context);
    expect(packed.data.context).toContain('# Context for');
  });

  it('returns principal-missing when the provider yields nothing', async () => {
    const toolset = createKnowledgeGraphToolset({
      mode: 'product',
      timeoutMs: 0,
      principalProvider: () => null,
    });
    const result = await toolset.dispatch(call('kg_search', { query: 'x' }));
    expect(result.isError).toBe(true);
    const body = parseJson<{ status: string; reason: string }>(result);
    expect(body.status).toBe('unavailable');
    expect(body.reason).toBe('principal-missing');
  });

  it('stamps source and actorDid from the principal, ignoring the client', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const toolset = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      principalProvider: () => studioPrincipal(),
    });
    const result = await toolset.dispatch(
      call('kg_add_episode', {
        episodeType: 'agent-fact',
        source: 'spoofed-client',
        content: 'a durable finding',
        classification: 'private',
        contentRef: { actorDid: 'did:evil', repo: 'revealui' },
        nodes: [{ kind: 'concept', name: 'finding', naturalKey: 'concept:finding' }],
      }),
    );
    expect(result.isError).not.toBe(true);
    const body = parseJson<{
      status: string;
      data: { episodeId: string; nodeCount: number };
    }>(result);
    expect(body.status).toBe('ok');
    expect(body.data.nodeCount).toBe(1);

    const rows = await db.exec.query<{ source: string; content_ref: Record<string, unknown> }>(
      `SELECT source, content_ref FROM kg_episodes WHERE id = $1`,
      [body.data.episodeId],
    );
    expect(rows[0]?.source).toBe('agent:did:revfleet:grok-1:fpabc');
    expect(rows[0]?.content_ref.actorDid).toBe('did:revfleet:grok-1:fpabc');
    expect(rows[0]?.content_ref.schema).toBe('revealui.memory.v1');
    const scope = rows[0]?.content_ref.scope as { classification?: string };
    expect(scope.classification).toBe('private');
  });

  it('namespaces hosted writes and does not merge onto a fleet scan node', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const toolset = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => hostedPrincipal(),
    });
    const result = await toolset.dispatch(
      call('kg_add_episode', {
        episodeType: 'agent-fact',
        content: 'customer finding',
        nodes: [{ kind: 'file', name: 'client.ts', naturalKey: FILE_KEY }],
      }),
    );
    expect(result.isError).not.toBe(true);
    const prefixed = tenantNaturalKey('acct_1', FILE_KEY);
    const scan = await db.exec.query<{ summary: string | null }>(
      `SELECT summary FROM kg_nodes WHERE natural_key = $1`,
      [FILE_KEY],
    );
    expect(scan[0]?.summary).toBe('the LLM client factory');
    const memory = await db.exec.query<{ natural_key: string }>(
      `SELECT natural_key FROM kg_nodes WHERE natural_key = $1`,
      [prefixed],
    );
    expect(memory[0]?.natural_key).toBe(prefixed);
  });

  it('scopes hosted reads: another tenant is denied, scan keys look missing', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const writer = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => hostedPrincipal(),
    });
    const actor = hostedPrincipal();
    const written = await writer.dispatch(
      call('kg_add_episode', {
        episodeType: 'agent-fact',
        content: 'lantern customer finding',
        nodes: [
          { kind: 'agent', name: actor.agentId, naturalKey: actor.did },
          { kind: 'concept', name: 'lantern', naturalKey: 'concept:lantern' },
        ],
        edges: [
          {
            source: { kind: 'agent', naturalKey: actor.did },
            target: { kind: 'concept', naturalKey: 'concept:lantern' },
            relation: 'discovered',
            fact: 'user_abc discovered lantern customer finding',
          },
        ],
      }),
    );
    expect(written.isError).not.toBe(true);

    const other = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () =>
        hostedPrincipal({
          did: 'did:revfleet:user_other:fpoth',
          agentId: 'user_other',
          fingerprint: 'fpoth',
          tenantId: 'acct_other',
        }),
    });
    const denied = await other.dispatch(call('kg_search', { query: 'lantern' }));
    expect(denied.isError).not.toBe(true);
    const deniedBody = parseJson<{ status: string; deniedCount: number }>(denied);
    expect(deniedBody.status).toBe('denied');
    expect(deniedBody.deniedCount).toBeGreaterThan(0);

    const scan = await writer.dispatch(call('kg_get_node', { naturalKey: FILE_KEY }));
    expect(scan.isError).toBe(true);

    const prefixed = tenantNaturalKey('acct_1', 'concept:lantern');
    const own = await writer.dispatch(call('kg_search', { query: 'lantern' }));
    const ownBody = parseJson<{
      status: string;
      enforcement: string;
      data: { nodes: Array<{ naturalKey: string }> };
    }>(own);
    expect(ownBody.status).toBe('ok');
    expect(ownBody.enforcement).toBe('enforced');
    expect(ownBody.data.nodes.some((n) => n.naturalKey === prefixed)).toBe(true);
  });

  it('times out a hung dispatch as unavailable/timeout', async () => {
    const hanging: KgExecutor = {
      query: () => new Promise((resolve) => setTimeout(() => resolve([]), 5_000)),
      transaction: () => new Promise((resolve) => setTimeout(() => resolve([] as never), 5_000)),
    };
    const toolset = createKnowledgeGraphToolset({
      executor: hanging,
      mode: 'product',
      timeoutMs: 50,
      principalProvider: () => studioPrincipal(),
    });
    const result = await toolset.dispatch(call('kg_search', { query: 'hang' }));
    expect(result.isError).toBe(true);
    const body = parseJson<{ status: string; reason: string }>(result);
    expect(body.status).toBe('unavailable');
    expect(body.reason).toBe('timeout');
  });

  it('fails closed on a mutating audit sink error before ingest', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const toolset = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      principalProvider: () => studioPrincipal(),
      auditSink: async () => {
        throw new Error('audit down');
      },
    });
    const result = await toolset.dispatch(
      call('kg_add_episode', {
        episodeType: 'agent-fact',
        content: 'should not land',
        nodes: [{ kind: 'concept', name: 'x', naturalKey: 'concept:x' }],
      }),
    );
    expect(result.isError).toBe(true);
    const first = result.content[0];
    expect(first && 'text' in first ? first.text : '').toContain('audit log unavailable');
    const rows = await db.exec.query<{ n: string }>(`SELECT count(*)::text AS n FROM kg_episodes`);
    expect(rows[0]?.n).toBe('0');
  });

  it('log-and-continues when a read audit sink fails', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const toolset = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      principalProvider: () => studioPrincipal(),
      auditSink: async () => {
        throw new Error('audit down');
      },
    });
    const result = await toolset.dispatch(call('kg_search', { query: 'client' }));
    expect(result.isError).not.toBe(true);
    const body = parseJson<{ status: string }>(result);
    expect(body.status).toBe('ok');
  });

  it('records a denied receipt for a missing principal', async () => {
    const audits: McpToolAuditRecord[] = [];
    const toolset = createKnowledgeGraphToolset({
      mode: 'product',
      timeoutMs: 0,
      principalProvider: () => null,
      auditSink: async (record) => {
        audits.push(record);
      },
    });
    await toolset.dispatch(call('kg_search', { query: 'x' }));
    expect(audits[0]?.outcome).toBe('denied');
    expect(audits[0]?.reason).toBe('principal-missing');
    expect(audits[0]?.argsDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('createKnowledgeGraphServer product mode over HTTP', () => {
  it('returns the envelope through Streamable HTTP', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const handler = createNodeStreamableHttpHandler({
      createServer: () =>
        createKnowledgeGraphServer({
          executor: db.exec,
          mode: 'product',
          timeoutMs: 0,
          principalProvider: () => studioPrincipal(),
        }),
      enableJsonResponse: true,
    });
    const httpServer: NodeHttpServer = createHttpServer((req, res) => {
      void handler(req, res).catch(() => {
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address() as AddressInfo;
    teardowns.push(
      () =>
        new Promise<void>((resolve, reject) =>
          httpServer.close((err) => (err ? reject(err) : resolve())),
        ),
    );
    const client = new McpClient({
      clientInfo: { name: 'kg-product-test', version: '0.0.1' },
      transport: { kind: 'streamable-http', url: `http://127.0.0.1:${port}/` },
    });
    await client.connect();
    teardowns.push(async () => {
      await client.close();
    });
    // biome-ignore lint/suspicious/noExplicitAny: reaching into private SDK field for coverage
    const sdk = (client as any).sdk as {
      callTool(args: {
        name: string;
        arguments?: Record<string, unknown>;
      }): Promise<CallToolResult>;
    };
    const result = await sdk.callTool({ name: 'kg_search', arguments: { query: 'client' } });
    expect(result.isError).not.toBe(true);
    const body = parseJson<{ status: string; data: { nodes: unknown[] } }>(result);
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data.nodes)).toBe(true);
  });
});
