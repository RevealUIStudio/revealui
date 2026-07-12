/**
 * Factory for the `knowledge-graph` MCP server (GAP-349 P2 — agent surfaces for
 * the fleet knowledge graph; P1 shipped the schema + `@revealui/knowledge-graph`
 * core in revealui#1858).
 *
 * Tools exposed:
 *   kg_search       — hybrid retrieval (vector + FTS + BFS traversal, RRF-fused)
 *   kg_get_node     — fetch a node + its current facts by natural key
 *   kg_neighbors    — BFS neighbors of a node (current or point-in-time)
 *   kg_add_episode  — THE ONLY WRITE TOOL. Additive ingestion (never a rescan).
 *   kg_path         — shortest path between two nodes
 *   kg_at_time      — a node's facts as of a point-in-time timestamp
 *   kg_context      — budgeted context assembly (design spec §8.4): BFS from an
 *                      anchor, rerank by node-distance + episode-mentions, pack
 *                      node summaries + edge facts (with provenance episode ids)
 *                      into a text block capped at `charBudget` characters.
 *
 * All tools operate over a `KgExecutor` (the driver-agnostic query interface
 * `@revealui/knowledge-graph` already exposes for Neon-in-prod / PGlite-in-tests
 * parity). Production resolves a pooled executor lazily from `@revealui/db/pool`
 * (the same connection pattern `revkg`'s CLI uses — extend, not duplicate); tests
 * inject a PGlite-backed executor via `CreateKnowledgeGraphServerOptions.executor`.
 *
 * Read tools degrade gracefully with no pgvector and no embeddings present:
 * `kgSearch`'s vector channel is skipped whenever no query embedding is
 * supplied, and query-embedding generation here is best-effort — an
 * `@revealui/ai` import failure or an Ollama-down `generateEmbedding()` call
 * both fall back to FTS + BFS only, never a hard failure.
 *
 * `kg_add_episode` is the only write tool. It always calls the additive
 * `ingestEpisode` (never `applyScan`, which is the deterministic-rescan path
 * reserved for `revkg scan`), Zod-validates `episodeType` plus every node kind
 * and edge relation against the ontology enums, and accepts no raw SQL or
 * table-name input of any kind.
 */

import { hostname } from 'node:os';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  EDGE_RELATIONS,
  type EdgeInput,
  type EdgeRelation,
  type Embedder,
  ingestEpisode,
  type KgExecutor,
  kgAtTime,
  kgNeighbors,
  kgPath,
  kgSearch,
  makePoolExecutor,
  NODE_KINDS,
  type NodeInput,
  type NodeKind,
} from '@revealui/knowledge-graph';
import { resolveNaturalKey } from '@revealui/knowledge-graph/ingest';
import { z } from 'zod/v4';
import { validateToolArgs } from '../../validate-tool-args.js';

const SERVER_NAME = 'knowledge-graph';
const SERVER_VERSION = '0.1.0';

/** Text block budget for `kg_context` — chars, not tokens, per GAP-349 P2 scope. */
const DEFAULT_CONTEXT_CHAR_BUDGET = 16_000;

/**
 * Mirrors `EpisodeType` in `@revealui/knowledge-graph/src/types.ts`. That union
 * is a compile-time type only (not exported as a runtime array by P1), so the
 * literal list is duplicated here for Zod enum validation — keep it in
 * lockstep with `types.ts` on any future P3 change.
 */
const EPISODE_TYPES = [
  'code-scan',
  'git-commit',
  'doc',
  'agent-fact',
  'memory',
  'json',
  'manual',
] as const;

// ---------------------------------------------------------------------------
// Tool argument schemas (Zod 4)
// ---------------------------------------------------------------------------

export const KgSearchArgsSchema = z
  .object({
    query: z.string().min(1),
    anchor: z.string().min(1).optional(),
    kinds: z.array(z.enum(NODE_KINDS)).optional(),
    relations: z.array(z.enum(EDGE_RELATIONS)).optional(),
    at: z.string().datetime().optional(),
    limit: z.number().int().positive().max(100).optional(),
    bfsDepth: z.number().int().min(1).max(6).optional(),
  })
  .strict();

export const KgGetNodeArgsSchema = z
  .object({
    naturalKey: z.string().min(1),
  })
  .strict();

export const KgNeighborsArgsSchema = z
  .object({
    naturalKey: z.string().min(1),
    depth: z.number().int().min(1).max(6).optional(),
    relations: z.array(z.enum(EDGE_RELATIONS)).optional(),
    at: z.string().datetime().optional(),
  })
  .strict();

const NodeRefArgsSchema = z
  .object({
    kind: z.enum(NODE_KINDS),
    naturalKey: z.string().min(1),
  })
  .strict();

const NodeInputArgsSchema = z
  .object({
    kind: z.enum(NODE_KINDS),
    name: z.string().min(1),
    naturalKey: z.string().min(1),
    repo: z.string().min(1).optional(),
    summary: z.string().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const EdgeInputArgsSchema = z
  .object({
    source: NodeRefArgsSchema,
    target: NodeRefArgsSchema,
    relation: z.enum(EDGE_RELATIONS),
    fact: z.string().min(1),
    repo: z.string().min(1).optional(),
    validAt: z.string().datetime().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const KgAddEpisodeArgsSchema = z
  .object({
    episodeType: z.enum(EPISODE_TYPES),
    source: z.string().min(1),
    content: z.string().optional(),
    contentRef: z.record(z.string(), z.unknown()).optional(),
    referenceTime: z.string().datetime().optional(),
    siteId: z.string().min(1).optional(),
    nodes: z.array(NodeInputArgsSchema).default([]),
    edges: z.array(EdgeInputArgsSchema).default([]),
  })
  .strict();

export const KgPathArgsSchema = z
  .object({
    fromNaturalKey: z.string().min(1),
    toNaturalKey: z.string().min(1),
    at: z.string().datetime().optional(),
    maxDepth: z.number().int().min(1).max(12).optional(),
  })
  .strict();

export const KgAtTimeArgsSchema = z
  .object({
    naturalKey: z.string().min(1),
    at: z.string().datetime(),
  })
  .strict();

export const KgContextArgsSchema = z
  .object({
    naturalKey: z.string().min(1),
    charBudget: z.number().int().positive().max(200_000).optional(),
    depth: z.number().int().min(1).max(6).optional(),
    at: z.string().datetime().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Tool definitions (MCP SDK JSON Schema)
// ---------------------------------------------------------------------------

const NODE_KIND_ENUM = [...NODE_KINDS];
const EDGE_RELATION_ENUM = [...EDGE_RELATIONS];

const NODE_REF_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: NODE_KIND_ENUM },
    naturalKey: { type: 'string' },
  },
  required: ['kind', 'naturalKey'],
} as const;

const TOOLS: Tool[] = [
  {
    name: 'kg_search',
    description:
      'Hybrid search over the fleet knowledge graph: vector + full-text + BFS ' +
      'traversal, RRF-fused, reranked by node-distance and episode-mentions. ' +
      'Returns nodes AND facts (edges) with provenance episode ids. Prefer ' +
      'kg_context for "what do I need to know before touching X" — this tool ' +
      'is for open-ended queries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text query.' },
        anchor: {
          type: 'string',
          description: 'Anchor node id for the BFS traversal channel + node-distance reranker.',
        },
        kinds: {
          type: 'array',
          items: { type: 'string', enum: NODE_KIND_ENUM },
          description: 'Restrict results to these node kinds.',
        },
        relations: {
          type: 'array',
          items: { type: 'string', enum: EDGE_RELATION_ENUM },
          description: 'Restrict fact results to these edge relations.',
        },
        at: { type: 'string', description: 'ISO-8601 point-in-time; omit for the current graph.' },
        limit: { type: 'number', description: 'Max results per list (default 20).' },
        bfsDepth: {
          type: 'number',
          description: 'Max BFS depth for the traversal channel (default 3).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'kg_get_node',
    description: 'Fetch a node and its current facts by natural key.',
    inputSchema: {
      type: 'object',
      properties: {
        naturalKey: {
          type: 'string',
          description: 'e.g. "revealui/packages/ai/src/llm/client.ts#getClient"',
        },
      },
      required: ['naturalKey'],
    },
  },
  {
    name: 'kg_neighbors',
    description: 'BFS neighbors of a node (current graph, or as of a point-in-time timestamp).',
    inputSchema: {
      type: 'object',
      properties: {
        naturalKey: { type: 'string' },
        depth: { type: 'number', description: 'Max hops (default 1).' },
        relations: {
          type: 'array',
          items: { type: 'string', enum: EDGE_RELATION_ENUM },
          description: 'Restrict traversal to these edge relations.',
        },
        at: { type: 'string', description: 'ISO-8601 point-in-time; omit for the current graph.' },
      },
      required: ['naturalKey'],
    },
  },
  {
    name: 'kg_add_episode',
    description:
      'Publish an episode (provenance unit) plus candidate nodes/edges into the ' +
      'graph. The ONLY write tool. Always additive (never a rescan) — use this ' +
      'to durably record an agent discovery (episodeType "agent-fact") or any ' +
      'other unstructured fact, extending the shared_facts / end-of-session ' +
      'publishing flow.',
    inputSchema: {
      type: 'object',
      properties: {
        episodeType: { type: 'string', enum: [...EPISODE_TYPES] },
        source: {
          type: 'string',
          description: 'e.g. "claude-session", "shared_facts:coord-abc123"',
        },
        content: { type: 'string', description: 'Raw payload or pointer summary.' },
        contentRef: { type: 'object', description: 'e.g. { repo, path, sha, factId }' },
        referenceTime: {
          type: 'string',
          description: 'ISO-8601; when the described state was true. Defaults to now.',
        },
        siteId: {
          type: 'string',
          description: 'Origin machine/replica id. Defaults to hostname().',
        },
        nodes: {
          type: 'array',
          description:
            'Candidate nodes to upsert (deterministic ids derived from kind+naturalKey).',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: NODE_KIND_ENUM },
              name: { type: 'string' },
              naturalKey: { type: 'string' },
              repo: { type: 'string' },
              summary: { type: 'string' },
              attributes: { type: 'object' },
            },
            required: ['kind', 'name', 'naturalKey'],
          },
        },
        edges: {
          type: 'array',
          description: 'Candidate facts between nodes referenced by kind+naturalKey.',
          items: {
            type: 'object',
            properties: {
              source: NODE_REF_SCHEMA,
              target: NODE_REF_SCHEMA,
              relation: { type: 'string', enum: EDGE_RELATION_ENUM },
              fact: { type: 'string' },
              repo: { type: 'string' },
              validAt: { type: 'string', description: 'ISO-8601; defaults to referenceTime.' },
              attributes: { type: 'object' },
            },
            required: ['source', 'target', 'relation', 'fact'],
          },
        },
      },
      required: ['episodeType', 'source'],
    },
  },
  {
    name: 'kg_path',
    description: 'Shortest path (node list) between two nodes, current or as of a point-in-time.',
    inputSchema: {
      type: 'object',
      properties: {
        fromNaturalKey: { type: 'string' },
        toNaturalKey: { type: 'string' },
        at: { type: 'string', description: 'ISO-8601 point-in-time; omit for the current graph.' },
        maxDepth: { type: 'number', description: 'Max hops to search (default 6).' },
      },
      required: ['fromNaturalKey', 'toNaturalKey'],
    },
  },
  {
    name: 'kg_at_time',
    description: "A node's facts as of a point-in-time timestamp.",
    inputSchema: {
      type: 'object',
      properties: {
        naturalKey: { type: 'string' },
        at: { type: 'string', description: 'ISO-8601 timestamp.' },
      },
      required: ['naturalKey', 'at'],
    },
  },
  {
    name: 'kg_context',
    description:
      'Budgeted context assembly (design spec §8.4): BFS from an anchor node, ' +
      'rerank by node-distance + episode-mentions, pack node summaries and edge ' +
      'facts (with provenance episode ids) into a text block capped at ' +
      'charBudget characters. The default entry point for "what do I need to ' +
      'know before touching X" — prefer this over kg_search for that use case.',
    inputSchema: {
      type: 'object',
      properties: {
        naturalKey: { type: 'string', description: 'Anchor node natural key.' },
        charBudget: {
          type: 'number',
          description: `Max characters in the packed context block (default ${DEFAULT_CONTEXT_CHAR_BUDGET}).`,
        },
        depth: { type: 'number', description: 'Max BFS depth from the anchor (default 3).' },
        at: { type: 'string', description: 'ISO-8601 point-in-time; omit for the current graph.' },
      },
      required: ['naturalKey'],
    },
  },
];

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

function textResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  } as CallToolResult;
}

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  } as CallToolResult;
}

// ---------------------------------------------------------------------------
// kg_context — budgeted context assembly (spec §8.4)
// ---------------------------------------------------------------------------

interface ContextNode {
  id: string;
  kind: string;
  name: string;
  naturalKey: string;
  summary: string | null;
  distance: number;
}

interface ContextFact {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  fact: string;
  mentions: number;
  episodeIds: string[];
}

export interface AssembledContext {
  context: string;
  anchor: { id: string; naturalKey: string };
  nodeCount: number;
  factCount: number;
  charBudget: number;
  charsUsed: number;
  truncated: boolean;
}

async function assembleContext(
  exec: KgExecutor,
  anchorId: string,
  opts: { charBudget: number; depth: number; at?: Date },
): Promise<AssembledContext> {
  const neighbors = await kgNeighbors(exec, anchorId, { depth: opts.depth, at: opts.at });

  const nodeIds = neighbors.nodes.map((n): string => n.id);
  const summaryRows = nodeIds.length
    ? await exec.query<{ id: string; summary: string | null }>(
        `SELECT id, summary FROM kg_nodes WHERE id = ANY($1::text[])`,
        [nodeIds],
      )
    : [];
  const summaryById = new Map<string, string | null>(summaryRows.map((r) => [r.id, r.summary]));

  const rankedNodes: ContextNode[] = neighbors.nodes
    .map(
      (n): ContextNode => ({
        id: n.id,
        kind: n.kind,
        name: n.name,
        naturalKey: n.naturalKey,
        summary: summaryById.get(n.id) ?? null,
        distance: n.distance,
      }),
    )
    .sort((a, b) =>
      a.distance - b.distance !== 0
        ? a.distance - b.distance
        : a.naturalKey < b.naturalKey
          ? -1
          : 1,
    );
  const distanceById = new Map<string, number>(rankedNodes.map((n) => [n.id, n.distance]));

  const edgeIds = neighbors.edges.map((e): string => e.id);
  const mentionRows = edgeIds.length
    ? await exec.query<{ id: string; mentions: number; episode_ids: string[] | null }>(
        `SELECT e.id, count(ee.episode_id)::int AS mentions,
                coalesce(array_agg(ee.episode_id) FILTER (WHERE ee.episode_id IS NOT NULL), '{}') AS episode_ids
         FROM kg_edges e
         LEFT JOIN kg_edge_episodes ee ON ee.edge_id = e.id
         WHERE e.id = ANY($1::text[])
         GROUP BY e.id`,
        [edgeIds],
      )
    : [];
  const mentionById = new Map<string, { mentions: number; episodeIds: string[] }>(
    mentionRows.map((r) => [
      r.id,
      { mentions: Number(r.mentions), episodeIds: r.episode_ids ?? [] },
    ]),
  );

  interface RankedFactCandidate extends ContextFact {
    rankDistance: number;
  }

  const rankedFacts: ContextFact[] = neighbors.edges
    .map((e): RankedFactCandidate => {
      const m = mentionById.get(e.id) ?? { mentions: 0, episodeIds: [] };
      const nearDistance = Math.min(
        distanceById.get(e.sourceId) ?? Number.POSITIVE_INFINITY,
        distanceById.get(e.targetId) ?? Number.POSITIVE_INFINITY,
      );
      return {
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        relation: e.relation,
        fact: e.fact,
        mentions: m.mentions,
        episodeIds: m.episodeIds,
        rankDistance: nearDistance,
      };
    })
    .sort((a, b) => {
      if (b.mentions - a.mentions !== 0) return b.mentions - a.mentions;
      if (a.rankDistance - b.rankDistance !== 0) return a.rankDistance - b.rankDistance;
      return a.id < b.id ? -1 : 1;
    })
    .map(({ rankDistance: _rankDistance, ...fact }): ContextFact => fact);

  const lines: string[] = [`# Context for ${anchorId} (depth=${opts.depth})`, '', '## Nodes'];
  for (const n of rankedNodes) {
    const summaryPart = n.summary ? ` — ${n.summary}` : '';
    lines.push(`- [${n.kind}] ${n.naturalKey} (${n.distance} hop)${summaryPart}`);
  }
  lines.push('', '## Facts');
  for (const f of rankedFacts) {
    const provenance = f.episodeIds.length > 0 ? f.episodeIds.join(', ') : 'none';
    lines.push(`- (${f.relation}) ${f.fact} [episodes: ${provenance}]`);
  }

  let charsUsed = 0;
  let truncated = false;
  const packed: string[] = [];
  for (const line of lines) {
    const addedLength = line.length + 1; // + newline
    if (charsUsed + addedLength > opts.charBudget) {
      truncated = true;
      break;
    }
    packed.push(line);
    charsUsed += addedLength;
  }

  return {
    context: packed.join('\n'),
    anchor: {
      id: anchorId,
      naturalKey: rankedNodes.find((n) => n.id === anchorId)?.naturalKey ?? anchorId,
    },
    nodeCount: rankedNodes.length,
    factCount: rankedFacts.length,
    charBudget: opts.charBudget,
    charsUsed,
    truncated,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateKnowledgeGraphServerOptions {
  /** Injected executor. Tests pass a PGlite-backed `KgExecutor`; production omits this and resolves lazily from `@revealui/db/pool`. */
  executor?: KgExecutor;
  /** Injected embedder. Tests can stub; production omits this and resolves lazily from `@revealui/ai/embeddings`, degrading to `undefined` (no vector channel) when unavailable. */
  embedder?: Embedder;
  /** siteId stamped on episodes ingested via `kg_add_episode`. Defaults to `os.hostname()`. */
  siteId?: string;
}

/**
 * Create a fresh `knowledge-graph` MCP Server instance. Safe to call multiple
 * times — each call returns an independent Server with its own request
 * handlers and its own lazily-resolved executor/embedder cache.
 */
export function createKnowledgeGraphServer(options?: CreateKnowledgeGraphServerOptions): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  const defaultSiteId = options?.siteId ?? hostname();

  let cachedExecutor: KgExecutor | undefined = options?.executor;
  async function resolveExecutor(): Promise<KgExecutor> {
    if (cachedExecutor) return cachedExecutor;
    const poolModule = await import('@revealui/db/pool');
    cachedExecutor = makePoolExecutor(poolModule.getPool());
    return cachedExecutor;
  }

  // Tri-state: `undefined` = not yet resolved, `null` = resolved-unavailable.
  let cachedEmbedder: Embedder | null | undefined = options?.embedder;
  async function resolveEmbedder(): Promise<Embedder | undefined> {
    if (cachedEmbedder !== undefined) return cachedEmbedder ?? undefined;
    try {
      // Non-literal specifier: `@revealui/ai` is an optional (Pro) dependency,
      // so this package must not carry a hard type/import edge to it.
      const specifier = '@revealui/ai/embeddings';
      const ai = (await import(specifier)) as {
        generateEmbedding(text: string): Promise<{ vector: number[] }>;
      };
      cachedEmbedder = async (text: string): Promise<number[]> => {
        const result = await ai.generateEmbedding(text);
        return result.vector;
      };
    } catch {
      cachedEmbedder = null;
    }
    return cachedEmbedder ?? undefined;
  }

  /** Best-effort query embedding: Ollama-down or no embedder both fall back to `undefined` (FTS + BFS only). */
  async function tryEmbed(text: string): Promise<number[] | undefined> {
    const embedder = await resolveEmbedder();
    if (!embedder) return undefined;
    try {
      return await embedder(text);
    } catch {
      return undefined;
    }
  }

  interface NodeDetailRow {
    id: string;
    kind: string;
    name: string;
    natural_key: string;
    repo: string | null;
    summary: string | null;
    attributes: Record<string, unknown>;
    first_seen_at: string;
    last_confirmed_at: string;
  }

  async function hydratePath(exec: KgExecutor, path: string[]): Promise<NodeDetailRow[]> {
    if (path.length === 0) return [];
    const rows = await exec.query<NodeDetailRow>(
      `SELECT id, kind, name, natural_key, repo, summary, attributes, first_seen_at, last_confirmed_at
       FROM kg_nodes WHERE id = ANY($1::text[])`,
      [path],
    );
    const byId = new Map<string, NodeDetailRow>(rows.map((r) => [r.id, r]));
    return path.flatMap((id): NodeDetailRow[] => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const toolName = request.params.name;

    let exec: KgExecutor;
    try {
      exec = await resolveExecutor();
    } catch (err) {
      return errorResult(
        `knowledge graph database unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    try {
      switch (toolName) {
        case 'kg_search': {
          const parsed = validateToolArgs(KgSearchArgsSchema, request.params.arguments, toolName);
          if (!parsed.ok) return parsed.error as unknown as CallToolResult;
          const { query, anchor, kinds, relations, at, limit, bfsDepth } = parsed.value;
          const queryEmbedding = await tryEmbed(query);
          const result = await kgSearch(exec, {
            query,
            anchor,
            kinds: kinds as NodeKind[] | undefined,
            relations: relations as EdgeRelation[] | undefined,
            at: at ? new Date(at) : undefined,
            limit,
            bfsDepth,
            queryEmbedding,
          });
          return textResult(result);
        }

        case 'kg_get_node': {
          const parsed = validateToolArgs(KgGetNodeArgsSchema, request.params.arguments, toolName);
          if (!parsed.ok) return parsed.error as unknown as CallToolResult;
          const { naturalKey } = parsed.value;
          const id = await resolveNaturalKey(exec, naturalKey);
          if (!id) return errorResult(`no node with natural key: ${naturalKey}`);
          const rows = await exec.query<NodeDetailRow>(
            `SELECT id, kind, name, natural_key, repo, summary, attributes, first_seen_at, last_confirmed_at
             FROM kg_nodes WHERE id = $1`,
            [id],
          );
          const node = rows[0];
          if (!node) return errorResult(`node ${id} vanished`);
          const facts = await kgAtTime(exec, id, new Date());
          return textResult({ node, facts });
        }

        case 'kg_neighbors': {
          const parsed = validateToolArgs(
            KgNeighborsArgsSchema,
            request.params.arguments,
            toolName,
          );
          if (!parsed.ok) return parsed.error as unknown as CallToolResult;
          const { naturalKey, depth, relations, at } = parsed.value;
          const id = await resolveNaturalKey(exec, naturalKey);
          if (!id) return errorResult(`no node with natural key: ${naturalKey}`);
          const result = await kgNeighbors(exec, id, {
            depth,
            relations: relations as EdgeRelation[] | undefined,
            at: at ? new Date(at) : undefined,
          });
          return textResult(result);
        }

        case 'kg_add_episode': {
          const parsed = validateToolArgs(
            KgAddEpisodeArgsSchema,
            request.params.arguments,
            toolName,
          );
          if (!parsed.ok) return parsed.error as unknown as CallToolResult;
          const v = parsed.value;
          const referenceTime = v.referenceTime ? new Date(v.referenceTime) : new Date();
          const nodes: NodeInput[] = v.nodes.map((n) => ({
            kind: n.kind,
            name: n.name,
            naturalKey: n.naturalKey,
            repo: n.repo,
            summary: n.summary,
            attributes: n.attributes,
          }));
          const edges: EdgeInput[] = v.edges.map((e) => ({
            source: e.source,
            target: e.target,
            relation: e.relation,
            fact: e.fact,
            repo: e.repo,
            validAt: e.validAt ? new Date(e.validAt) : undefined,
            attributes: e.attributes,
          }));
          const embedder = await resolveEmbedder();
          const result = await ingestEpisode(
            exec,
            {
              episode: {
                episodeType: v.episodeType,
                source: v.source,
                siteId: v.siteId ?? defaultSiteId,
                content: v.content,
                contentRef: v.contentRef,
                referenceTime,
              },
              nodes,
              edges,
            },
            { embedder, recordOutbox: true },
          );
          return textResult({
            episodeId: result.episodeId,
            nodeCount: result.nodeCount,
            edgeCount: result.edgeCount,
          });
        }

        case 'kg_path': {
          const parsed = validateToolArgs(KgPathArgsSchema, request.params.arguments, toolName);
          if (!parsed.ok) return parsed.error as unknown as CallToolResult;
          const { fromNaturalKey, toNaturalKey, at, maxDepth } = parsed.value;
          const fromId = await resolveNaturalKey(exec, fromNaturalKey);
          if (!fromId) return errorResult(`no node with natural key: ${fromNaturalKey}`);
          const toId = await resolveNaturalKey(exec, toNaturalKey);
          if (!toId) return errorResult(`no node with natural key: ${toNaturalKey}`);
          const path = await kgPath(exec, fromId, toId, {
            at: at ? new Date(at) : undefined,
            maxDepth,
          });
          if (!path) return textResult({ path: null });
          const detail = await hydratePath(exec, path);
          return textResult({ path: detail });
        }

        case 'kg_at_time': {
          const parsed = validateToolArgs(KgAtTimeArgsSchema, request.params.arguments, toolName);
          if (!parsed.ok) return parsed.error as unknown as CallToolResult;
          const { naturalKey, at } = parsed.value;
          const id = await resolveNaturalKey(exec, naturalKey);
          if (!id) return errorResult(`no node with natural key: ${naturalKey}`);
          const facts = await kgAtTime(exec, id, new Date(at));
          return textResult({ facts });
        }

        case 'kg_context': {
          const parsed = validateToolArgs(KgContextArgsSchema, request.params.arguments, toolName);
          if (!parsed.ok) return parsed.error as unknown as CallToolResult;
          const { naturalKey, charBudget, depth, at } = parsed.value;
          const id = await resolveNaturalKey(exec, naturalKey);
          if (!id) return errorResult(`no node with natural key: ${naturalKey}`);
          const assembled = await assembleContext(exec, id, {
            charBudget: charBudget ?? DEFAULT_CONTEXT_CHAR_BUDGET,
            depth: depth ?? 3,
            at: at ? new Date(at) : undefined,
          });
          return textResult(assembled);
        }

        default:
          return errorResult(`Unknown tool: ${toolName}`);
      }
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  return server;
}
