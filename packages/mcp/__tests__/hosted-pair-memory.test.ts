/**
 * Hosted pair: Cursor HTTP + OpenCode HTTP share one accountId on product-mode
 * knowledge-graph tools. Same-Neon is not same-tenant; studio-local is not a
 * hosted pair.
 */

import { PGlite } from '@electric-sql/pglite';
import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type KgExecutor, kgDdlStatements, makeExecutor } from '@revealui/knowledge-graph';
import {
  httpFallbackDid,
  type MemoryPrincipal,
  tenantNaturalKey,
} from '@revealui/knowledge-graph/memory';
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

function hostedPrincipal(
  userId: string,
  accountId: string,
  harness: MemoryPrincipal['harness'],
): MemoryPrincipal {
  const did = httpFallbackDid(userId, accountId);
  return {
    ...did,
    harness,
    tenantId: accountId,
    trustBoundary: 'hosted',
    isFleetOperator: false,
  };
}

const cursorPrincipal = (): MemoryPrincipal =>
  hostedPrincipal('user-cursor', 'acct_shared', 'cursor');
const opencodePrincipal = (): MemoryPrincipal =>
  hostedPrincipal('user-opencode', 'acct_shared', 'opencode');
const otherAccountPrincipal = (): MemoryPrincipal =>
  hostedPrincipal('user-other', 'acct_other', 'cursor');

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

const TOKEN = 'hosted-lantern-finding';

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

describe('Cursor HTTP + OpenCode HTTP share one accountId', () => {
  it('publishes from Cursor and OpenCode search returns the provenance episode id', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const cursor = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => cursorPrincipal(),
    });
    const opencode = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => opencodePrincipal(),
    });

    const published = await cursor.dispatch(call('kg_add_episode', findingArgs(cursorPrincipal())));
    expect(published.isError).not.toBe(true);
    const written = parseJson<{
      status: string;
      enforcement: string;
      data: { episodeId: string };
    }>(published);
    expect(written.status).toBe('ok');
    expect(written.enforcement).toBe('enforced');

    const searched = await opencode.dispatch(call('kg_search', { query: TOKEN }));
    expect(searched.isError).not.toBe(true);
    const body = parseJson<{
      status: string;
      enforcement: string;
      data: {
        nodes: Array<{ naturalKey: string }>;
        facts: Array<{ episodeIds: string[] }>;
      };
    }>(searched);
    expect(body.status).toBe('ok');
    expect(body.enforcement).toBe('enforced');
    const prefixed = tenantNaturalKey('acct_shared', `concept:${TOKEN}`);
    expect(body.data.nodes.some((n) => n.naturalKey === prefixed)).toBe(true);
    expect(body.data.facts.some((f) => f.episodeIds.includes(written.data.episodeId))).toBe(true);
  });

  it('also works in reverse: OpenCode publishes, Cursor search matches episode id', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const cursor = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => cursorPrincipal(),
    });
    const opencode = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => opencodePrincipal(),
    });

    const published = await opencode.dispatch(
      call('kg_add_episode', findingArgs(opencodePrincipal())),
    );
    const written = parseJson<{ data: { episodeId: string } }>(published);
    const searched = await cursor.dispatch(call('kg_search', { query: TOKEN }));
    const body = parseJson<{ data: { facts: Array<{ episodeIds: string[] }> } }>(searched);
    expect(body.data.facts.some((f) => f.episodeIds.includes(written.data.episodeId))).toBe(true);
  });

  it('denies a different accountId even on the same graph store', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const cursor = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => cursorPrincipal(),
    });
    const other = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => otherAccountPrincipal(),
    });

    const published = await cursor.dispatch(call('kg_add_episode', findingArgs(cursorPrincipal())));
    expect(published.isError).not.toBe(true);

    const denied = await other.dispatch(call('kg_search', { query: TOKEN }));
    expect(denied.isError).not.toBe(true);
    const body = parseJson<{ status: string; deniedCount: number }>(denied);
    expect(body.status).toBe('denied');
    expect(body.deniedCount).toBeGreaterThan(0);
  });

  it('is not a pair with studio-local: hosted search does not see stdio writes', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const grokStdio = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'studio-local',
      principalProvider: () => ({
        did: 'did:revfleet:grok-1:fpgro',
        agentId: 'grok-1',
        fingerprint: 'fpgro',
        didKind: 'agent-key',
        harness: 'grok',
        tenantId: 'studio-local',
        trustBoundary: 'studio-local',
        isFleetOperator: true,
      }),
    });
    const cursorHosted = createKnowledgeGraphToolset({
      executor: db.exec,
      mode: 'product',
      timeoutMs: 0,
      trustBoundary: 'hosted',
      principalProvider: () => cursorPrincipal(),
    });

    const published = await grokStdio.dispatch(
      call('kg_add_episode', {
        episodeType: 'agent-fact',
        content: `${TOKEN} from studio-local`,
        nodes: [{ kind: 'concept', name: TOKEN, naturalKey: `concept:${TOKEN}` }],
      }),
    );
    expect(published.isError).not.toBe(true);
    const written = parseJson<{ data: { episodeId: string } }>(published);

    const hosted = await cursorHosted.dispatch(call('kg_search', { query: TOKEN }));
    const body = parseJson<{
      status: string;
      data?: { facts?: Array<{ episodeIds: string[] }> };
    }>(hosted);
    const sawEpisode = body.data?.facts?.some((f) => f.episodeIds.includes(written.data.episodeId));
    expect(sawEpisode).toBeFalsy();
  });
});
