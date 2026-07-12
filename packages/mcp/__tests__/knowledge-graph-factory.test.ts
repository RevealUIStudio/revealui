/**
 * Vitest coverage for the `knowledge-graph` MCP server factory (GAP-349 P2).
 *
 * Exercises: tool-schema validation (Zod), kg_add_episode ontology
 * validation, the read tools (kg_search/kg_get_node/kg_neighbors/kg_path/
 * kg_at_time) against a PGlite-backed KgExecutor seeded via the P1 additive
 * ingest path, and kg_context budget enforcement (spec §8.4).
 *
 * The PGlite harness mirrors `@revealui/knowledge-graph`'s own
 * `src/__tests__/test-db.ts`, built only from that package's PUBLIC export
 * surface (`kgDdlStatements` + `makeExecutor`) since the internal test
 * helper isn't exported. NEVER touches a real database.
 */

import { createServer as createHttpServer, type Server as NodeHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import {
  type EdgeInput,
  type EpisodeInput,
  ingestEpisode,
  type KgExecutor,
  kgDdlStatements,
  makeExecutor,
  type NodeInput,
} from '@revealui/knowledge-graph';
import { afterEach, describe, expect, it } from 'vitest';
import { McpClient } from '../src/client.js';
import {
  createKnowledgeGraphServer,
  KgAddEpisodeArgsSchema,
  KgAtTimeArgsSchema,
  KgContextArgsSchema,
  KgGetNodeArgsSchema,
  KgNeighborsArgsSchema,
  KgPathArgsSchema,
  KgSearchArgsSchema,
} from '../src/servers/factories/knowledge-graph.js';
import { createNodeStreamableHttpHandler } from '../src/streamable-http.js';

// ---------------------------------------------------------------------------
// PGlite test db
// ---------------------------------------------------------------------------

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

const REPO = 'revealui';
const FILE_KEY = 'revealui/packages/ai/src/llm/client.ts';
const SYMBOL_KEY = `${FILE_KEY}#getClient`;
const T = new Date('2026-07-01T00:00:00Z');

async function seed(exec: KgExecutor): Promise<void> {
  const episode: EpisodeInput = {
    episodeType: 'code-scan',
    source: 'test',
    siteId: 'test-site',
    referenceTime: T,
    contentRef: { repo: REPO },
  };
  const nodes: NodeInput[] = [
    {
      kind: 'file',
      name: 'client.ts',
      naturalKey: FILE_KEY,
      repo: REPO,
      summary: 'the LLM client factory',
    },
    {
      kind: 'symbol',
      name: 'getClient',
      naturalKey: SYMBOL_KEY,
      repo: REPO,
      summary: 'creates an LLM client',
    },
    { kind: 'dependency', name: 'zod', naturalKey: 'npm:zod' },
  ];
  const edges: EdgeInput[] = [
    {
      source: { kind: 'file', naturalKey: FILE_KEY },
      target: { kind: 'symbol', naturalKey: SYMBOL_KEY },
      relation: 'exports',
      fact: 'client.ts exports getClient',
      repo: REPO,
      validAt: T,
    },
    {
      source: { kind: 'file', naturalKey: FILE_KEY },
      target: { kind: 'dependency', naturalKey: 'npm:zod' },
      relation: 'imports',
      fact: 'client.ts imports zod',
      repo: REPO,
      validAt: T,
    },
  ];
  await ingestEpisode(exec, { episode, nodes, edges });
}

// ---------------------------------------------------------------------------
// HTTP harness (mirrors revealui-content-factory.integration.test.ts)
// ---------------------------------------------------------------------------

type McpHandle = { url: string; close: () => Promise<void> };

async function startMcpHttp(exec: KgExecutor): Promise<McpHandle> {
  const handler = createNodeStreamableHttpHandler({
    createServer: () => createKnowledgeGraphServer({ executor: exec }),
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
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

interface SdkCallToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}
interface SdkClient {
  callTool(args: { name: string; arguments?: Record<string, unknown> }): Promise<SdkCallToolResult>;
}

const teardowns: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (teardowns.length > 0) {
    const t = teardowns.pop();
    if (t) await t().catch(() => undefined);
  }
});

async function connectedClient(exec: KgExecutor): Promise<{ client: McpClient; sdk: SdkClient }> {
  const mcp = await startMcpHttp(exec);
  teardowns.push(mcp.close);
  const client = new McpClient({
    clientInfo: { name: 'kg-test', version: '0.0.1' },
    transport: { kind: 'streamable-http', url: mcp.url },
  });
  await client.connect();
  teardowns.push(async () => {
    await client.close();
  });
  // Tool invocation isn't yet surfaced on McpClient's own facade (same gap
  // noted in revealui-content-factory.integration.test.ts) — reach into the
  // internal SDK client, matching that test's established workaround.
  // biome-ignore lint/suspicious/noExplicitAny: reaching into private SDK field for coverage
  const sdk = (client as any).sdk as SdkClient;
  return { client, sdk };
}

function parseToolJson<T>(result: SdkCallToolResult): T {
  const first = result.content[0];
  if (first?.type !== 'text') throw new Error('expected text content');
  return JSON.parse(first.text) as T;
}

// ---------------------------------------------------------------------------
// Tool-schema validation
// ---------------------------------------------------------------------------

describe('knowledge-graph tool schemas', () => {
  it('kg_search accepts a bare query', () => {
    expect(KgSearchArgsSchema.safeParse({ query: 'client' }).success).toBe(true);
  });

  it('kg_search rejects an unrecognized field (strict — never raw SQL/table names)', () => {
    expect(
      KgSearchArgsSchema.safeParse({ query: 'client', sql: 'DROP TABLE kg_nodes' }).success,
    ).toBe(false);
  });

  it('kg_search rejects an unknown node kind', () => {
    expect(KgSearchArgsSchema.safeParse({ query: 'client', kinds: ['not-a-kind'] }).success).toBe(
      false,
    );
  });

  it('kg_get_node requires naturalKey', () => {
    expect(KgGetNodeArgsSchema.safeParse({}).success).toBe(false);
    expect(KgGetNodeArgsSchema.safeParse({ naturalKey: FILE_KEY }).success).toBe(true);
  });

  it('kg_neighbors rejects an unknown edge relation', () => {
    expect(
      KgNeighborsArgsSchema.safeParse({ naturalKey: FILE_KEY, relations: ['drops'] }).success,
    ).toBe(false);
  });

  it('kg_path requires both endpoints', () => {
    expect(KgPathArgsSchema.safeParse({ fromNaturalKey: 'a' }).success).toBe(false);
    expect(KgPathArgsSchema.safeParse({ fromNaturalKey: 'a', toNaturalKey: 'b' }).success).toBe(
      true,
    );
  });

  it('kg_at_time requires an ISO-8601 `at`', () => {
    expect(KgAtTimeArgsSchema.safeParse({ naturalKey: FILE_KEY, at: 'not-a-date' }).success).toBe(
      false,
    );
    expect(
      KgAtTimeArgsSchema.safeParse({ naturalKey: FILE_KEY, at: T.toISOString() }).success,
    ).toBe(true);
  });

  it('kg_context accepts a charBudget override', () => {
    expect(KgContextArgsSchema.safeParse({ naturalKey: FILE_KEY, charBudget: 500 }).success).toBe(
      true,
    );
  });
});

describe('kg_add_episode ontology validation', () => {
  it('rejects an unknown episodeType', () => {
    const parsed = KgAddEpisodeArgsSchema.safeParse({
      episodeType: 'not-a-real-type',
      source: 'test',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown node kind in the nodes array', () => {
    const parsed = KgAddEpisodeArgsSchema.safeParse({
      episodeType: 'agent-fact',
      source: 'test',
      nodes: [{ kind: 'not-a-kind', name: 'x', naturalKey: 'x' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown edge relation in the edges array', () => {
    const parsed = KgAddEpisodeArgsSchema.safeParse({
      episodeType: 'agent-fact',
      source: 'test',
      edges: [
        {
          source: { kind: 'file', naturalKey: 'a' },
          target: { kind: 'file', naturalKey: 'b' },
          relation: 'not-a-relation',
          fact: 'a relates to b',
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a minimal valid agent-fact episode', () => {
    const parsed = KgAddEpisodeArgsSchema.safeParse({
      episodeType: 'agent-fact',
      source: 'claude-session',
      content: 'discovered a race condition',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unrecognized top-level field (strict — never raw SQL/table names)', () => {
    const parsed = KgAddEpisodeArgsSchema.safeParse({
      episodeType: 'agent-fact',
      source: 'test',
      sql: 'DROP TABLE kg_nodes',
    });
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Read tools against a PGlite-backed KgExecutor
// ---------------------------------------------------------------------------

describe('knowledge-graph MCP tools (PGlite)', () => {
  it('lists all 7 tools', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const { client } = await connectedClient(db.exec);
    const tools = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
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
  });

  it('kg_search finds a seeded node via the FTS channel with no embedder configured', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({ name: 'kg_search', arguments: { query: 'client' } });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{ nodes: Array<{ naturalKey: string }> }>(result);
    expect(parsed.nodes.some((n) => n.naturalKey === FILE_KEY)).toBe(true);
  });

  it('kg_get_node fetches a seeded node by natural key with its current facts', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_get_node',
      arguments: { naturalKey: FILE_KEY },
    });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{
      node: { natural_key: string };
      facts: Array<{ relation: string }>;
    }>(result);
    expect(parsed.node.natural_key).toBe(FILE_KEY);
    expect(parsed.facts.some((f) => f.relation === 'exports')).toBe(true);
  });

  it('kg_get_node returns an MCP tool error for an unknown natural key', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_get_node',
      arguments: { naturalKey: 'does-not-exist' },
    });
    expect(result.isError).toBe(true);
  });

  it('kg_neighbors reaches connected nodes', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_neighbors',
      arguments: { naturalKey: FILE_KEY, depth: 2 },
    });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{ nodes: Array<{ naturalKey: string; distance: number }> }>(
      result,
    );
    const zod = parsed.nodes.find((n) => n.naturalKey === 'npm:zod');
    expect(zod).toBeDefined();
    expect(zod?.distance).toBe(1);
  });

  it('kg_path finds the shortest path between two nodes', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_path',
      arguments: { fromNaturalKey: FILE_KEY, toNaturalKey: 'npm:zod' },
    });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{ path: Array<{ natural_key: string }> | null }>(result);
    expect(parsed.path).not.toBeNull();
    expect(parsed.path?.at(-1)?.natural_key).toBe('npm:zod');
  });

  it('kg_path returns null when no path exists', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    // getClient is only connected to client.ts (1-hop), never to zod directly
    // without traversing through client.ts's other edges is fine — instead
    // seed an isolated node with no edges to prove the null path.
    const nodes: NodeInput[] = [{ kind: 'concept', name: 'orphan', naturalKey: 'concept:orphan' }];
    await ingestEpisode(db.exec, {
      episode: {
        episodeType: 'manual',
        source: 'test',
        siteId: 'test-site',
        referenceTime: T,
      },
      nodes,
      edges: [],
    });
    const result = await sdk.callTool({
      name: 'kg_path',
      arguments: { fromNaturalKey: FILE_KEY, toNaturalKey: 'concept:orphan' },
    });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{ path: unknown }>(result);
    expect(parsed.path).toBeNull();
  });

  it('kg_at_time returns the facts valid at the seeded reference time', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_at_time',
      arguments: { naturalKey: FILE_KEY, at: new Date(T.getTime() + 1000).toISOString() },
    });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{ facts: Array<{ relation: string }> }>(result);
    expect(parsed.facts.some((f) => f.relation === 'exports')).toBe(true);
  });

  it('kg_add_episode is the only write path and its result is durably visible to reads', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_add_episode',
      arguments: {
        episodeType: 'agent-fact',
        source: 'claude-session',
        content: 'the electric proxy retries with backoff',
        nodes: [
          {
            kind: 'concept',
            name: 'electric proxy retries',
            naturalKey: 'concept:electric-proxy-retries',
          },
        ],
        edges: [],
      },
    });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{ episodeId: string; nodeCount: number; edgeCount: number }>(
      result,
    );
    expect(parsed.nodeCount).toBe(1);
    expect(typeof parsed.episodeId).toBe('string');

    const getResult = await sdk.callTool({
      name: 'kg_get_node',
      arguments: { naturalKey: 'concept:electric-proxy-retries' },
    });
    expect(getResult.isError).not.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// kg_context — budget enforcement (spec §8.4)
// ---------------------------------------------------------------------------

describe('kg_context budget enforcement', () => {
  it('packs the full neighborhood within a generous budget', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_context',
      arguments: { naturalKey: FILE_KEY, depth: 2, charBudget: 16_000 },
    });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{
      truncated: boolean;
      nodeCount: number;
      charsUsed: number;
      charBudget: number;
    }>(result);
    expect(parsed.truncated).toBe(false);
    expect(parsed.nodeCount).toBeGreaterThanOrEqual(3);
    expect(parsed.charsUsed).toBeLessThanOrEqual(parsed.charBudget);
  });

  it('truncates and never exceeds charBudget under a tight budget', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_context',
      arguments: { naturalKey: FILE_KEY, depth: 2, charBudget: 80 },
    });
    expect(result.isError).not.toBe(true);
    const parsed = parseToolJson<{
      truncated: boolean;
      charsUsed: number;
      charBudget: number;
      context: string;
    }>(result);
    expect(parsed.truncated).toBe(true);
    expect(parsed.charsUsed).toBeLessThanOrEqual(80);
    expect(parsed.context.length).toBeLessThanOrEqual(80);
  });

  it('includes provenance episode ids for facts in the packed context', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({
      name: 'kg_context',
      arguments: { naturalKey: FILE_KEY, depth: 2, charBudget: 16_000 },
    });
    const parsed = parseToolJson<{ context: string }>(result);
    expect(parsed.context).toContain('[episodes:');
    expect(parsed.context).not.toContain('[episodes: none]');
  });

  it('defaults charBudget to 16000 when omitted', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    await seed(db.exec);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({ name: 'kg_context', arguments: { naturalKey: FILE_KEY } });
    const parsed = parseToolJson<{ charBudget: number }>(result);
    expect(parsed.charBudget).toBe(16_000);
  });

  it('returns an MCP tool error for an unknown anchor natural key', async () => {
    const db = await createTestDb();
    teardowns.push(db.close);
    const { sdk } = await connectedClient(db.exec);
    const result = await sdk.callTool({ name: 'kg_context', arguments: { naturalKey: 'nope' } });
    expect(result.isError).toBe(true);
  });
});
