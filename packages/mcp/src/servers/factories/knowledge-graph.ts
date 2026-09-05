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
 *
 * Product mode (`mode: 'product'`) extracts `createKnowledgeGraphToolset` so
 * stdio and a later hosted composite share one dispatcher. CallTool threads
 * `extra.authInfo` / `extra.sessionId`. Writes stamp actor + scope from
 * `principalProvider` (client `source` / `contentRef.actorDid` are ignored).
 * Compat mode (default) keeps today's unwrapped JSON for in-repo tests.
 */

import { createHash } from 'node:crypto';
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
  type AssembledContext,
  assembleContext,
  EDGE_RELATIONS,
  type EdgeInput,
  type EdgeRelation,
  type Embedder,
  EPISODE_TYPES,
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
import {
  countDeniedMemoryHits,
  inspectNodeVisibility,
  MEMORY_MAX_CONTENT_CHARS,
  MEMORY_MAX_EDGES,
  MEMORY_MAX_NODES,
  MEMORY_SCHEMA,
  type MemoryClassification,
  type MemoryPrincipal,
  shouldNamespaceKeys,
  tenantNaturalKey,
  validatePrincipal,
} from '@revealui/knowledge-graph/memory';
import { z } from 'zod/v4';
import { validateToolArgs } from '../../validate-tool-args.js';
import type {
  McpToolAuditRecord,
  McpToolAuditSink,
  McpToolCallContext,
} from './revealui-content.js';

const SERVER_NAME = 'knowledge-graph';
const SERVER_VERSION = '0.1.0';

/** Text block budget for `kg_context` — chars, not tokens, per GAP-349 P2 scope. */
const DEFAULT_CONTEXT_CHAR_BUDGET = 16_000;

/** Hard caps for kg_add_episode payloads (prevents unbounded Neon writes). */
const MAX_EPISODE_CONTENT_CHARS = 64_000;
const MAX_EPISODE_ATTRIBUTES_JSON_CHARS = 16_000;

/** Product-mode write types. Compat still accepts the full ontology enum. */
const PRODUCT_EPISODE_TYPES = ['agent-fact', 'memory', 'manual'] as const;

/** Dispatch Promise.race budget. Hung writes must not block the agent. */
export const DEFAULT_KG_TOOL_TIMEOUT_MS = 4_000;

const DEFAULT_MUTATING_TOOLS: ReadonlySet<string> = new Set(['kg_add_episode']);

// ---------------------------------------------------------------------------
// Tool argument schemas (Zod 4)
// ---------------------------------------------------------------------------

export const KgSearchArgsSchema = z
  .object({
    query: z.string().min(1),
    /** Node id (uuid-ish) or natural key — resolved via resolveNaturalKey when needed. */
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

function refineEpisodeJsonCaps(
  val: {
    contentRef?: Record<string, unknown>;
    nodes: Array<{ attributes?: Record<string, unknown> }>;
    edges: Array<{ attributes?: Record<string, unknown> }>;
  },
  ctx: z.RefinementCtx,
): void {
  if (val.contentRef) {
    const size = JSON.stringify(val.contentRef).length;
    if (size > MAX_EPISODE_ATTRIBUTES_JSON_CHARS) {
      ctx.addIssue({
        code: 'custom',
        message: `contentRef JSON max ${MAX_EPISODE_ATTRIBUTES_JSON_CHARS} chars (got ${size})`,
        path: ['contentRef'],
      });
    }
  }
  for (let i = 0; i < val.nodes.length; i++) {
    const attrs = val.nodes[i]?.attributes;
    if (!attrs) continue;
    const size = JSON.stringify(attrs).length;
    if (size > MAX_EPISODE_ATTRIBUTES_JSON_CHARS) {
      ctx.addIssue({
        code: 'custom',
        message: `nodes[${i}].attributes JSON max ${MAX_EPISODE_ATTRIBUTES_JSON_CHARS} chars (got ${size})`,
        path: ['nodes', i, 'attributes'],
      });
    }
  }
  for (let i = 0; i < val.edges.length; i++) {
    const attrs = val.edges[i]?.attributes;
    if (!attrs) continue;
    const size = JSON.stringify(attrs).length;
    if (size > MAX_EPISODE_ATTRIBUTES_JSON_CHARS) {
      ctx.addIssue({
        code: 'custom',
        message: `edges[${i}].attributes JSON max ${MAX_EPISODE_ATTRIBUTES_JSON_CHARS} chars (got ${size})`,
        path: ['edges', i, 'attributes'],
      });
    }
  }
}

export const KgAddEpisodeArgsSchema = z
  .object({
    episodeType: z.enum(EPISODE_TYPES),
    source: z.string().min(1),
    content: z
      .string()
      .max(MAX_EPISODE_CONTENT_CHARS, `content max ${MAX_EPISODE_CONTENT_CHARS} chars`)
      .optional(),
    contentRef: z.record(z.string(), z.unknown()).optional(),
    referenceTime: z.string().datetime().optional(),
    siteId: z.string().min(1).optional(),
    nodes: z.array(NodeInputArgsSchema).default([]),
    edges: z.array(EdgeInputArgsSchema).default([]),
  })
  .strict()
  .superRefine(refineEpisodeJsonCaps);

export const KgProductAddEpisodeArgsSchema = z
  .object({
    episodeType: z.enum(PRODUCT_EPISODE_TYPES),
    /** Ignored; stamped from `principalProvider`. */
    source: z.string().min(1).optional(),
    content: z
      .string()
      .max(MEMORY_MAX_CONTENT_CHARS, `content max ${MEMORY_MAX_CONTENT_CHARS} chars`)
      .optional(),
    contentRef: z.record(z.string(), z.unknown()).optional(),
    classification: z.enum(['private', 'workspace']).optional(),
    referenceTime: z.string().datetime().optional(),
    siteId: z.string().min(1).optional(),
    nodes: z.array(NodeInputArgsSchema).max(MEMORY_MAX_NODES).default([]),
    edges: z.array(EdgeInputArgsSchema).max(MEMORY_MAX_EDGES).default([]),
  })
  .strict()
  .superRefine(refineEpisodeJsonCaps);

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
          description:
            'Anchor node id OR natural key for the BFS traversal channel + node-distance reranker.',
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

function productAddEpisodeTool(): Tool {
  return {
    name: 'kg_add_episode',
    description:
      'Publish an episode (provenance unit) plus candidate nodes/edges into the ' +
      'graph. The ONLY write tool. Always additive (never a rescan). Product ' +
      'mode stamps actor and scope from the session principal — client `source` ' +
      'and `contentRef.actorDid` are ignored. episodeType is agent-fact, memory, ' +
      'or manual.',
    inputSchema: {
      type: 'object',
      properties: {
        episodeType: { type: 'string', enum: [...PRODUCT_EPISODE_TYPES] },
        source: {
          type: 'string',
          description: 'Ignored in product mode; stamped from the session principal.',
        },
        content: {
          type: 'string',
          description: `Raw payload or pointer summary (max ${MEMORY_MAX_CONTENT_CHARS} chars).`,
        },
        contentRef: {
          type: 'object',
          description: 'e.g. { repo, path, sha }. actorDid is ignored.',
        },
        classification: {
          type: 'string',
          enum: ['private', 'workspace'],
          description: 'Memory classification. Default workspace. public is not allowed.',
        },
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
          description: `Candidate nodes to upsert (max ${MEMORY_MAX_NODES}).`,
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
          description: `Candidate facts between nodes (max ${MEMORY_MAX_EDGES}).`,
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
      required: ['episodeType'],
    },
  };
}

function toolsForMode(mode: 'compat' | 'product'): Tool[] {
  if (mode === 'compat') return TOOLS;
  return TOOLS.map((tool) => (tool.name === 'kg_add_episode' ? productAddEpisodeTool() : tool));
}

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

export type { AssembledContext };

// ---------------------------------------------------------------------------
// Product-mode helpers
// ---------------------------------------------------------------------------

const AUDIT_SCALAR_ALLOWLIST = [
  'naturalKey',
  'fromNaturalKey',
  'toNaturalKey',
  'episodeType',
  'classification',
  'query',
] as const;

function extraToContext(extra: unknown): McpToolCallContext {
  const record = extra as { authInfo?: unknown; sessionId?: string } | undefined;
  return { authInfo: record?.authInfo, sessionId: record?.sessionId };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

function digestArgs(args: unknown): string {
  return createHash('sha256').update(canonicalJson(args)).digest('hex');
}

function pickAuditScalars(args: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!args || typeof args !== 'object') return out;
  const record = args as Record<string, unknown>;
  for (const key of AUDIT_SCALAR_ALLOWLIST) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.length > 0) out[key] = raw;
  }
  return out;
}

function namespaceKey(principal: MemoryPrincipal, kind: string, key: string): string {
  if (kind === 'agent') return key;
  if (!shouldNamespaceKeys(principal)) return key;
  return tenantNaturalKey(principal.tenantId, key);
}

function inboundKey(principal: MemoryPrincipal | null, key: string): string {
  if (!(principal && shouldNamespaceKeys(principal))) return key;
  return tenantNaturalKey(principal.tenantId, key);
}

function stampContentRef(
  principal: MemoryPrincipal,
  clientRef: Record<string, unknown> | undefined,
  classification: MemoryClassification,
): Record<string, unknown> {
  const rest = { ...(clientRef ?? {}) };
  const repo = typeof rest.repo === 'string' ? rest.repo : undefined;
  return {
    ...rest,
    schema: MEMORY_SCHEMA,
    actorDid: principal.did,
    harness: principal.harness,
    scope: {
      tenantId: principal.tenantId,
      workspaceId: principal.workspaceId,
      repo,
      classification,
    },
  };
}

function productUnavailable(reason: string, message: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          status: 'unavailable',
          available: false,
          reason,
          message,
        }),
      },
    ],
    isError: true,
  } as CallToolResult;
}

function wrapOk(
  mode: 'compat' | 'product',
  data: unknown,
  principal: MemoryPrincipal | null,
  deniedCount = 0,
): CallToolResult {
  if (mode === 'compat') return textResult(data);
  const enforcement = principal?.trustBoundary === 'hosted' ? 'enforced' : 'deferred';
  return textResult({
    status: 'ok',
    available: true,
    enforcement,
    deniedCount,
    data,
  });
}

function wrapDenied(principal: MemoryPrincipal, deniedCount: number): CallToolResult {
  return textResult({
    status: 'denied',
    available: true,
    reason: 'scope-denied',
    deniedCount,
    scope: {
      tenantId: principal.tenantId,
      workspaceId: principal.workspaceId,
      classification: 'workspace',
    },
    message: 'memory-schema hits existed but none were in scope',
  });
}

async function raceTimeout(
  work: Promise<CallToolResult>,
  timeoutMs: number,
  onTimeout: () => CallToolResult,
): Promise<CallToolResult> {
  if (timeoutMs <= 0) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CallToolResult>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  /** Per-call identity. Required in product mode; ignored in compat. */
  principalProvider?: (
    ctx: McpToolCallContext,
  ) => Promise<MemoryPrincipal | null> | MemoryPrincipal | null;
  /** Optional receipts. Mutating tools fail closed; reads log-and-continue. */
  auditSink?: McpToolAuditSink;
  /** Default `{ kg_add_episode }`. */
  mutatingTools?: ReadonlySet<string>;
  /** `compat` (default) keeps unwrapped JSON. `product` stamps + envelopes. */
  mode?: 'compat' | 'product';
  /** Mount trust boundary. Product default is `studio-local`. */
  trustBoundary?: 'studio-local' | 'hosted';
  /** Dispatch Promise.race budget in ms. Default 4000. */
  timeoutMs?: number;
}

export interface KnowledgeGraphToolset {
  tools: Tool[];
  names: ReadonlySet<string>;
  dispatch(request: CallToolRequest, extra?: unknown): Promise<CallToolResult>;
}

/**
 * Shared dispatcher for stdio and a later hosted composite. CallTool must pass
 * `extra` so `principalProvider` can read `authInfo` / `sessionId`.
 */
export function createKnowledgeGraphToolset(
  options?: CreateKnowledgeGraphServerOptions,
): KnowledgeGraphToolset {
  const mode = options?.mode ?? 'compat';
  const trustBoundary = options?.trustBoundary ?? 'studio-local';
  const timeoutMs = options?.timeoutMs ?? DEFAULT_KG_TOOL_TIMEOUT_MS;
  const mutatingTools = options?.mutatingTools ?? DEFAULT_MUTATING_TOOLS;
  const tools = toolsForMode(mode);
  const names = new Set(tools.map((tool) => tool.name));
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

  function dbUnavailable(err: unknown): CallToolResult {
    const detail = err instanceof Error ? err.message : String(err);
    const message = `knowledge graph database unavailable: ${detail}`;
    return mode === 'product'
      ? productUnavailable('kg-database-unavailable', message)
      : errorResult(message);
  }

  async function handleTool(request: CallToolRequest, extra: unknown): Promise<CallToolResult> {
    const startTime = Date.now();
    const toolName = request.params.name;
    const rawArgs = request.params.arguments;
    const ctx = extraToContext(extra);
    const mutating = mutatingTools.has(toolName);

    async function writeReceipt(
      outcome: McpToolAuditRecord['outcome'],
      opts?: { reason?: string },
    ): Promise<boolean> {
      if (!options?.auditSink) return true;
      const record: McpToolAuditRecord = {
        outcome,
        tool: toolName,
        argsDigest: digestArgs(rawArgs ?? null),
        scalars: pickAuditScalars(rawArgs),
        durationMs: Date.now() - startTime,
        reason: opts?.reason,
        context: ctx,
      };
      try {
        await options.auditSink(record);
        return true;
      } catch {
        return false;
      }
    }

    if (!names.has(toolName)) {
      await writeReceipt('denied');
      return errorResult(`Unknown tool: ${toolName}`);
    }

    let principal: MemoryPrincipal | null = null;
    if (mode === 'product') {
      try {
        principal = (await options?.principalProvider?.(ctx)) ?? null;
      } catch {
        principal = null;
      }
      const missing = validatePrincipal(principal);
      if (missing || !principal) {
        await writeReceipt('denied', { reason: 'principal-missing' });
        return productUnavailable('principal-missing', missing ?? 'principal is required');
      }
      if (principal.trustBoundary !== trustBoundary) {
        await writeReceipt('denied', { reason: 'principal-missing' });
        return productUnavailable(
          'principal-missing',
          'principal trustBoundary does not match the server',
        );
      }
    }

    if (mutating) {
      const recorded = await writeReceipt('invoked');
      if (!recorded) {
        return errorResult('audit log unavailable; mutating tool refused');
      }
    }

    let exec: KgExecutor;
    try {
      exec = await resolveExecutor();
    } catch (err) {
      if (!mutating) await writeReceipt('failed');
      return dbUnavailable(err);
    }

    try {
      const result = await dispatchNamedTool(exec, toolName, request, principal);
      if (!mutating) {
        await writeReceipt(result.isError ? 'failed' : 'invoked');
      }
      return result;
    } catch (err) {
      if (!mutating) await writeReceipt('failed');
      return mode === 'product'
        ? dbUnavailable(err)
        : errorResult(err instanceof Error ? err.message : String(err));
    }
  }

  async function dispatchNamedTool(
    exec: KgExecutor,
    toolName: string,
    request: CallToolRequest,
    principal: MemoryPrincipal | null,
  ): Promise<CallToolResult> {
    switch (toolName) {
      case 'kg_search': {
        const parsed = validateToolArgs(KgSearchArgsSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error as unknown as CallToolResult;
        const { query, anchor, kinds, relations, at, limit, bfsDepth } = parsed.value;
        let anchorId = anchor ? inboundKey(principal, anchor) : anchor;
        if (anchorId) {
          const resolved = await resolveNaturalKey(exec, anchorId);
          if (resolved) {
            anchorId = resolved;
          }
        }
        const queryEmbedding = await tryEmbed(query);
        const scoped = mode === 'product' ? (principal ?? undefined) : undefined;
        const result = await kgSearch(exec, {
          query,
          anchor: anchorId,
          kinds: kinds as NodeKind[] | undefined,
          relations: relations as EdgeRelation[] | undefined,
          at: at ? new Date(at) : undefined,
          limit,
          bfsDepth,
          queryEmbedding,
          principal: scoped,
        });
        const deniedCount = scoped ? await countDeniedMemoryHits(exec, query, scoped) : 0;
        if (
          mode === 'product' &&
          principal &&
          result.nodes.length === 0 &&
          result.facts.length === 0 &&
          deniedCount > 0
        ) {
          return wrapDenied(principal, deniedCount);
        }
        return wrapOk(mode, result, principal, deniedCount);
      }

      case 'kg_get_node': {
        const parsed = validateToolArgs(KgGetNodeArgsSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error as unknown as CallToolResult;
        const naturalKey = inboundKey(principal, parsed.value.naturalKey);
        const id = await resolveNaturalKey(exec, naturalKey);
        if (!id) return errorResult(`no node with natural key: ${naturalKey}`);
        const scoped = mode === 'product' ? (principal ?? undefined) : undefined;
        if (scoped) {
          const visibility = await inspectNodeVisibility(exec, id, scoped);
          if (visibility === 'missing') {
            return errorResult(`no node with natural key: ${naturalKey}`);
          }
          const rows = await exec.query<NodeDetailRow>(
            `SELECT id, kind, name, natural_key, repo, summary, attributes, first_seen_at, last_confirmed_at
             FROM kg_nodes WHERE id = $1`,
            [id],
          );
          const node = rows[0];
          if (!node) return errorResult(`node ${id} vanished`);
          const facts = await kgAtTime(exec, id, new Date(), { principal: scoped });
          if (visibility === 'shell') {
            return wrapOk(
              mode,
              {
                node: {
                  id: node.id,
                  kind: node.kind,
                  name: node.name,
                  natural_key: node.natural_key,
                },
                facts,
              },
              principal,
            );
          }
          return wrapOk(mode, { node, facts }, principal);
        }
        const rows = await exec.query<NodeDetailRow>(
          `SELECT id, kind, name, natural_key, repo, summary, attributes, first_seen_at, last_confirmed_at
           FROM kg_nodes WHERE id = $1`,
          [id],
        );
        const node = rows[0];
        if (!node) return errorResult(`node ${id} vanished`);
        const facts = await kgAtTime(exec, id, new Date());
        return wrapOk(mode, { node, facts }, principal);
      }

      case 'kg_neighbors': {
        const parsed = validateToolArgs(KgNeighborsArgsSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error as unknown as CallToolResult;
        const { depth, relations, at } = parsed.value;
        const naturalKey = inboundKey(principal, parsed.value.naturalKey);
        const id = await resolveNaturalKey(exec, naturalKey);
        if (!id) return errorResult(`no node with natural key: ${naturalKey}`);
        const scoped = mode === 'product' ? (principal ?? undefined) : undefined;
        if (scoped && (await inspectNodeVisibility(exec, id, scoped)) === 'missing') {
          return errorResult(`no node with natural key: ${naturalKey}`);
        }
        const result = await kgNeighbors(exec, id, {
          depth,
          relations: relations as EdgeRelation[] | undefined,
          at: at ? new Date(at) : undefined,
          principal: scoped,
        });
        return wrapOk(mode, result, principal);
      }

      case 'kg_add_episode': {
        if (mode === 'product') {
          if (!principal) {
            return productUnavailable('principal-missing', 'principal is required');
          }
          const parsed = validateToolArgs(
            KgProductAddEpisodeArgsSchema,
            request.params.arguments,
            toolName,
          );
          if (!parsed.ok) return parsed.error as unknown as CallToolResult;
          const v = parsed.value;
          const classification: MemoryClassification = v.classification ?? 'workspace';
          const referenceTime = v.referenceTime ? new Date(v.referenceTime) : new Date();
          const nodes: NodeInput[] = v.nodes.map((n) => ({
            kind: n.kind,
            name: n.name,
            naturalKey: namespaceKey(principal, n.kind, n.naturalKey),
            repo: n.repo,
            summary: n.summary,
            attributes: n.attributes,
          }));
          const edges: EdgeInput[] = v.edges.map((e) => ({
            source: {
              kind: e.source.kind,
              naturalKey: namespaceKey(principal, e.source.kind, e.source.naturalKey),
            },
            target: {
              kind: e.target.kind,
              naturalKey: namespaceKey(principal, e.target.kind, e.target.naturalKey),
            },
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
                source: `agent:${principal.did}`,
                siteId: v.siteId ?? defaultSiteId,
                content: v.content,
                contentRef: stampContentRef(principal, v.contentRef, classification),
                referenceTime,
              },
              nodes,
              edges,
            },
            { embedder, recordOutbox: true, invalidateContradictions: false },
          );
          return wrapOk(
            mode,
            {
              episodeId: result.episodeId,
              nodeCount: result.nodeCount,
              edgeCount: result.edgeCount,
            },
            principal,
          );
        }

        const parsed = validateToolArgs(KgAddEpisodeArgsSchema, request.params.arguments, toolName);
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
        return wrapOk(
          mode,
          {
            episodeId: result.episodeId,
            nodeCount: result.nodeCount,
            edgeCount: result.edgeCount,
          },
          principal,
        );
      }

      case 'kg_path': {
        const parsed = validateToolArgs(KgPathArgsSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error as unknown as CallToolResult;
        const { at, maxDepth } = parsed.value;
        const fromNaturalKey = inboundKey(principal, parsed.value.fromNaturalKey);
        const toNaturalKey = inboundKey(principal, parsed.value.toNaturalKey);
        const fromId = await resolveNaturalKey(exec, fromNaturalKey);
        if (!fromId) return errorResult(`no node with natural key: ${fromNaturalKey}`);
        const toId = await resolveNaturalKey(exec, toNaturalKey);
        if (!toId) return errorResult(`no node with natural key: ${toNaturalKey}`);
        const scoped = mode === 'product' ? (principal ?? undefined) : undefined;
        if (scoped) {
          if ((await inspectNodeVisibility(exec, fromId, scoped)) === 'missing') {
            return errorResult(`no node with natural key: ${fromNaturalKey}`);
          }
          if ((await inspectNodeVisibility(exec, toId, scoped)) === 'missing') {
            return errorResult(`no node with natural key: ${toNaturalKey}`);
          }
        }
        const path = await kgPath(exec, fromId, toId, {
          at: at ? new Date(at) : undefined,
          maxDepth,
          principal: scoped,
        });
        if (!path) return wrapOk(mode, { path: null }, principal);
        const detail = await hydratePath(exec, path);
        return wrapOk(mode, { path: detail }, principal);
      }

      case 'kg_at_time': {
        const parsed = validateToolArgs(KgAtTimeArgsSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error as unknown as CallToolResult;
        const { at } = parsed.value;
        const naturalKey = inboundKey(principal, parsed.value.naturalKey);
        const id = await resolveNaturalKey(exec, naturalKey);
        if (!id) return errorResult(`no node with natural key: ${naturalKey}`);
        const scoped = mode === 'product' ? (principal ?? undefined) : undefined;
        if (scoped && (await inspectNodeVisibility(exec, id, scoped)) === 'missing') {
          return errorResult(`no node with natural key: ${naturalKey}`);
        }
        const facts = await kgAtTime(exec, id, new Date(at), { principal: scoped });
        return wrapOk(mode, { facts }, principal);
      }

      case 'kg_context': {
        const parsed = validateToolArgs(KgContextArgsSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error as unknown as CallToolResult;
        const { charBudget, depth, at } = parsed.value;
        const naturalKey = inboundKey(principal, parsed.value.naturalKey);
        const id = await resolveNaturalKey(exec, naturalKey);
        if (!id) return errorResult(`no node with natural key: ${naturalKey}`);
        const scoped = mode === 'product' ? (principal ?? undefined) : undefined;
        if (scoped && (await inspectNodeVisibility(exec, id, scoped)) === 'missing') {
          return errorResult(`no node with natural key: ${naturalKey}`);
        }
        const assembled = await assembleContext(exec, id, {
          charBudget: charBudget ?? DEFAULT_CONTEXT_CHAR_BUDGET,
          depth: depth ?? 3,
          at: at ? new Date(at) : undefined,
          principal: scoped,
        });
        return wrapOk(mode, assembled, principal);
      }

      default:
        return errorResult(`Unknown tool: ${toolName}`);
    }
  }

  return {
    tools,
    names,
    async dispatch(request: CallToolRequest, extra?: unknown): Promise<CallToolResult> {
      return raceTimeout(handleTool(request, extra), timeoutMs, () =>
        mode === 'product'
          ? productUnavailable('timeout', 'knowledge graph tool timed out')
          : errorResult('knowledge graph tool timed out'),
      );
    },
  };
}

/**
 * Create a fresh `knowledge-graph` MCP Server instance. Safe to call multiple
 * times — each call returns an independent Server with its own request
 * handlers and its own lazily-resolved executor/embedder cache.
 */
export function createKnowledgeGraphServer(options?: CreateKnowledgeGraphServerOptions): Server {
  const toolset = createKnowledgeGraphToolset(options);
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolset.tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest, extra) =>
    toolset.dispatch(request, extra),
  );

  return server;
}
