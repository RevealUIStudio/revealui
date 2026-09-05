/**
 * Two-harness acceptance: Claude stdio + Grok stdio share studio-local
 * knowledge-graph memory through the same product-mode toolset the
 * `revealui-mcp knowledge-graph` launcher mounts. No second MCP server,
 * no hosted credentials.
 */

import { PGlite } from '@electric-sql/pglite';
import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type KgExecutor, kgDdlStatements, makeExecutor } from '@revealui/knowledge-graph';
import type { MemoryPrincipal } from '@revealui/knowledge-graph/memory';
import { afterEach, describe, expect, it } from 'vitest';
import { createKnowledgeGraphToolset } from '../src/servers/factories/knowledge-graph.js';

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

function studioPrincipal(partial: Partial<MemoryPrincipal> = {}): MemoryPrincipal {
  return {
    did: 'did:revfleet:claude-1:fpcla',
    agentId: 'claude-1',
    fingerprint: 'fpcla',
    didKind: 'agent-key',
    harness: 'claude',
    tenantId: 'studio-local',
    trustBoundary: 'studio-local',
    isFleetOperator: true,
    ...partial,
  };
}

const claudePrincipal = (): MemoryPrincipal => studioPrincipal();
const grokPrincipal = (): MemoryPrincipal =>
  studioPrincipal({
    did: 'did:revfleet:grok-1:fpgro',
    agentId: 'grok-1',
    fingerprint: 'fpgro',
    harness: 'grok',
  });

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

const TOKEN = 'brass-compass-finding';

function findingArgs(actor: MemoryPrincipal): Record<string, unknown> {
  return {
    episodeType: 'agent-fact',
    content: `${TOKEN} recorded by ${actor.agentId}`,
    classification: 'workspace',
    nodes: [
      { kind: 'agent', name: actor.agentId, naturalKey: actor.did },
      { kind: 'concept', name: TOKEN, naturalKey: `concept:${TOKEN}` },
    ],
    edges: [
      {
        source: { kind: 'agent', naturalKey: actor.did },
        target: { kind: 'concept', naturalKey: `concept:${TOKEN}` },
        relation: 'discovered',
        fact: `${actor.agentId} discovered ${TOKEN}`,
      },
    ],
  };
}

const teardowns: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (teardowns.length > 0) {
    const t = teardowns.pop();
    if (t) await t().catch(() => undefined);
  }
});

describe('Claude stdio + Grok stdio share studio-local memory', () => {
  it('uses one knowledge-graph toolset (no second memory server)', () => {
    const toolset = createKnowledgeGraphToolset({ mode: 'product', timeoutMs: 0 });
    expect(toolset.names.has('kg_add_episode')).toBe(true);
    expect(toolset.names.has('kg_search')).toBe(true);
    expect(toolset.names.has('kg_publish')).toBe(false);
    expect(toolset.names.has('kg_claim')).toBe(false);
    expect(toolset.names.size).toBe(7);
  });

  it('publishes from Claude and Grok search returns the provenance episode id', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const claude = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'studio-local',
      principalProvider: () => claudePrincipal(),
    });
    const grok = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'studio-local',
      principalProvider: () => grokPrincipal(),
    });

    const published = await claude.dispatch(call('kg_add_episode', findingArgs(claudePrincipal())));
    expect(published.isError).not.toBe(true);
    const written = parseJson<{
      status: string;
      enforcement: string;
      data: { episodeId: string };
    }>(published);
    expect(written.status).toBe('ok');
    expect(written.enforcement).toBe('deferred');
    expect(written.data.episodeId).toBeTruthy();

    const searched = await grok.dispatch(call('kg_search', { query: TOKEN }));
    expect(searched.isError).not.toBe(true);
    const body = parseJson<{
      status: string;
      enforcement: string;
      data: {
        nodes: Array<{ naturalKey: string }>;
        facts: Array<{ episodeIds: string[]; fact: string }>;
      };
    }>(searched);
    expect(body.status).toBe('ok');
    expect(body.enforcement).toBe('deferred');
    expect(body.data.nodes.some((n) => n.naturalKey === `concept:${TOKEN}`)).toBe(true);
    expect(body.data.facts.some((f) => f.episodeIds.includes(written.data.episodeId))).toBe(true);
  });

  it('also works in reverse: Grok publishes, Claude search matches episode id', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const claude = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'studio-local',
      principalProvider: () => claudePrincipal(),
    });
    const grok = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'studio-local',
      principalProvider: () => grokPrincipal(),
    });

    const published = await grok.dispatch(call('kg_add_episode', findingArgs(grokPrincipal())));
    const written = parseJson<{ data: { episodeId: string } }>(published);
    const searched = await claude.dispatch(call('kg_search', { query: TOKEN }));
    const body = parseJson<{
      data: { facts: Array<{ episodeIds: string[] }> };
    }>(searched);
    expect(body.data.facts.some((f) => f.episodeIds.includes(written.data.episodeId))).toBe(true);
  });

  it('stamps both harnesses onto the studio-local tenant', async () => {
    expect(claudePrincipal().tenantId).toBe('studio-local');
    expect(grokPrincipal().tenantId).toBe('studio-local');
    expect(claudePrincipal().trustBoundary).toBe('studio-local');
    expect(grokPrincipal().trustBoundary).toBe('studio-local');
  });

  it('WARNs and continues when B has no graph (dropped credentials)', async () => {
    const down: KgExecutor = {
      query: async () => {
        throw new Error('ECONNREFUSED neon');
      },
      transaction: async () => {
        throw new Error('ECONNREFUSED neon');
      },
    };
    const grok = createKnowledgeGraphToolset({
      executor: down,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'studio-local',
      principalProvider: () => grokPrincipal(),
    });
    const result = await grok.dispatch(call('kg_search', { query: TOKEN }));
    expect(result.isError).toBe(true);
    const body = parseJson<{ status: string; reason: string; message: string }>(result);
    expect(body.status).toBe('unavailable');
    expect(body.message.toLowerCase()).toContain('econnrefused');
    expect(JSON.stringify(body)).not.toContain('no facts');
  });

  it('does not block B waiting on a hung A publish', async () => {
    const hanging: KgExecutor = {
      query: () => new Promise(() => undefined),
      transaction: () => new Promise(() => undefined),
    };
    const db = await createTestDb();
    teardowns.push(db.close);

    const claude = createKnowledgeGraphToolset({
      executor: hanging,
      mode: 'product',
      timeoutMs: 50,
      trustBoundary: 'studio-local',
      principalProvider: () => claudePrincipal(),
    });
    const grok = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'studio-local',
      principalProvider: () => grokPrincipal(),
    });

    const aPublish = claude.dispatch(call('kg_add_episode', findingArgs(claudePrincipal())));
    const bSearch = grok.dispatch(call('kg_search', { query: TOKEN }));
    const b = await bSearch;
    expect(b.isError).not.toBe(true);
    const body = parseJson<{ status: string }>(b);
    expect(body.status).toBe('ok');

    const a = await aPublish;
    expect(a.isError).toBe(true);
    const aBody = parseJson<{ reason: string }>(a);
    expect(aBody.reason).toBe('timeout');
  });
});
