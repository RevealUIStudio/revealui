/**
 * Hybrid retrieval (spec §7).
 *
 * `kgSearch` runs up to three channels in parallel — pgvector cosine (only when
 * a query embedding is supplied and the store has pgvector), tsvector
 * `websearch_to_tsquery` + `ts_rank`, and BFS from an anchor (recursive CTE,
 * depth ≤ 3) — fuses the node channels with RRF, and reranks by node-distance
 * and episode-mentions. It returns nodes AND facts (edges) with provenance
 * episode ids, mirroring graphiti's search_nodes / search_facts split.
 *
 * Point-in-time: pass `at` to query the graph as of a timestamp
 * (`valid_at <= at AND (invalid_at IS NULL OR invalid_at > at)`); omit it for
 * the current graph (`invalid_at IS NULL AND expired_at IS NULL`).
 */

import type { EdgeRelation, NodeKind } from '../ontology/index.js';
import type { KgExecutor } from '../types.js';
import { applyEpisodeMentions, applyNodeDistance, rankByScore, rrfFuse } from './rrf.js';

export interface KgSearchQuery {
  query: string;
  /** Anchor node id for the traversal channel + node-distance reranker. */
  anchor?: string;
  kinds?: NodeKind[];
  relations?: EdgeRelation[];
  /** Point-in-time timestamp; omit for the current graph. */
  at?: Date;
  limit?: number;
  /** Query embedding for the vector channel (768-dim). Omit to skip it. */
  queryEmbedding?: number[];
  /** Max BFS depth for the traversal channel (default 3). */
  bfsDepth?: number;
}

export interface RankedNode {
  id: string;
  kind: string;
  name: string;
  naturalKey: string;
  repo: string | null;
  summary: string | null;
  score: number;
  distance?: number;
}

export interface RankedFact {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  fact: string;
  validAt: string;
  invalidAt: string | null;
  mentions: number;
  episodeIds: string[];
  score: number;
}

export interface KgSearchResult {
  nodes: RankedNode[];
  facts: RankedFact[];
}

/** Valid-time predicate for an edge alias; `null` at → current-graph predicate. */
function edgeTemporalClause(alias: string, atParam: string | null): string {
  if (atParam === null) {
    return `${alias}.invalid_at IS NULL AND ${alias}.expired_at IS NULL`;
  }
  return `${alias}.valid_at <= ${atParam}::timestamptz AND (${alias}.invalid_at IS NULL OR ${alias}.invalid_at > ${atParam}::timestamptz)`;
}

function formatVector(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

interface NodeChannelRow {
  id: string;
  score?: number;
}

async function nodeFtsChannel(
  exec: KgExecutor,
  query: string,
  kinds: NodeKind[] | undefined,
  limit: number,
): Promise<string[]> {
  const params: unknown[] = [query, kinds ?? null, limit];
  const rows = await exec.query<NodeChannelRow>(
    `SELECT id FROM kg_nodes
     WHERE search @@ websearch_to_tsquery('english', $1)
       AND ($2::text[] IS NULL OR kind = ANY($2::text[]))
     ORDER BY ts_rank(search, websearch_to_tsquery('english', $1)) DESC, id
     LIMIT $3`,
    params,
  );
  return rows.map((r) => r.id);
}

async function nodeVectorChannel(
  exec: KgExecutor,
  queryEmbedding: number[] | undefined,
  kinds: NodeKind[] | undefined,
  limit: number,
): Promise<string[]> {
  if (!queryEmbedding || queryEmbedding.length === 0) return [];
  try {
    const rows = await exec.query<NodeChannelRow>(
      `SELECT id FROM kg_nodes
       WHERE embedding IS NOT NULL
         AND ($2::text[] IS NULL OR kind = ANY($2::text[]))
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [formatVector(queryEmbedding), kinds ?? null, limit],
    );
    return rows.map((r) => r.id);
  } catch {
    // No pgvector (e.g. PGlite without the extension) — skip the vector channel.
    return [];
  }
}

async function bfsChannel(
  exec: KgExecutor,
  anchor: string | undefined,
  relations: EdgeRelation[] | undefined,
  at: Date | undefined,
  depth: number,
): Promise<Map<string, number>> {
  const distances = new Map<string, number>();
  if (!anchor) return distances;
  const atParam = at ? '$3' : null;
  const params: unknown[] = [anchor, relations ?? null, ...(at ? [at.toISOString()] : [])];
  const rows = await exec.query<{ node_id: string; depth: number }>(
    `WITH RECURSIVE bfs(node_id, depth) AS (
       SELECT $1::text, 0
       UNION
       SELECT CASE WHEN e.source_id = b.node_id THEN e.target_id ELSE e.source_id END, b.depth + 1
       FROM bfs b
       JOIN kg_edges e ON (e.source_id = b.node_id OR e.target_id = b.node_id)
       WHERE b.depth < ${depth}
         AND (${edgeTemporalClause('e', atParam)})
         AND ($2::text[] IS NULL OR e.relation = ANY($2::text[]))
     )
     SELECT node_id, MIN(depth) AS depth FROM bfs GROUP BY node_id`,
    params,
  );
  for (const row of rows) distances.set(row.node_id, Number(row.depth));
  return distances;
}

interface FactRow {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  fact: string;
  valid_at: string;
  invalid_at: string | null;
  mentions: number;
  episode_ids: string[] | null;
}

async function factChannel(
  exec: KgExecutor,
  query: string,
  relations: EdgeRelation[] | undefined,
  at: Date | undefined,
  limit: number,
): Promise<FactRow[]> {
  const atParam = at ? '$4' : null;
  const params: unknown[] = [query, relations ?? null, limit, ...(at ? [at.toISOString()] : [])];
  return exec.query<FactRow>(
    `SELECT e.id, e.source_id, e.target_id, e.relation, e.fact, e.valid_at, e.invalid_at,
            count(ee.episode_id)::int AS mentions,
            coalesce(array_agg(ee.episode_id) FILTER (WHERE ee.episode_id IS NOT NULL), '{}') AS episode_ids
     FROM kg_edges e
     LEFT JOIN kg_edge_episodes ee ON ee.edge_id = e.id
     WHERE e.search @@ websearch_to_tsquery('english', $1)
       AND (${edgeTemporalClause('e', atParam)})
       AND ($2::text[] IS NULL OR e.relation = ANY($2::text[]))
     GROUP BY e.id
     ORDER BY ts_rank(e.search, websearch_to_tsquery('english', $1)) DESC, e.id
     LIMIT $3`,
    params,
  );
}

interface NodeDetailRow {
  id: string;
  kind: string;
  name: string;
  natural_key: string;
  repo: string | null;
  summary: string | null;
}

async function hydrateNodes(exec: KgExecutor, ids: string[]): Promise<Map<string, NodeDetailRow>> {
  const map = new Map<string, NodeDetailRow>();
  if (ids.length === 0) return map;
  const rows = await exec.query<NodeDetailRow>(
    `SELECT id, kind, name, natural_key, repo, summary FROM kg_nodes WHERE id = ANY($1::text[])`,
    [ids],
  );
  for (const row of rows) map.set(row.id, row);
  return map;
}

export async function kgSearch(exec: KgExecutor, q: KgSearchQuery): Promise<KgSearchResult> {
  const limit = q.limit ?? 20;
  const channelLimit = Math.max(limit * 3, 30);
  const depth = q.bfsDepth ?? 3;

  const [ftsNodes, vectorNodes, bfsDistances, facts] = await Promise.all([
    nodeFtsChannel(exec, q.query, q.kinds, channelLimit),
    nodeVectorChannel(exec, q.queryEmbedding, q.kinds, channelLimit),
    bfsChannel(exec, q.anchor, q.relations, q.at, depth),
    factChannel(exec, q.query, q.relations, q.at, channelLimit),
  ]);

  // RRF over node channels + traversal reach.
  const bfsList = [...bfsDistances.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const fused = rrfFuse([ftsNodes, vectorNodes, bfsList]);

  // node-distance reranker.
  for (const [id, score] of fused) {
    fused.set(id, applyNodeDistance(score, bfsDistances.get(id)));
  }
  const rankedNodeIds = rankByScore(fused).slice(0, limit);
  const detail = await hydrateNodes(
    exec,
    rankedNodeIds.map((n) => n.id),
  );
  const nodes: RankedNode[] = [];
  for (const { id, score } of rankedNodeIds) {
    const d = detail.get(id);
    if (!d) continue;
    nodes.push({
      id,
      kind: d.kind,
      name: d.name,
      naturalKey: d.natural_key,
      repo: d.repo,
      summary: d.summary,
      score,
      distance: bfsDistances.get(id),
    });
  }

  // episode-mentions reranker over facts (facts arrive keyword-ranked; index → base score).
  const rankedFacts: RankedFact[] = facts
    .map((f, index) => {
      const base = 1 / (index + 1);
      return {
        id: f.id,
        sourceId: f.source_id,
        targetId: f.target_id,
        relation: f.relation,
        fact: f.fact,
        validAt: f.valid_at,
        invalidAt: f.invalid_at,
        mentions: Number(f.mentions),
        episodeIds: f.episode_ids ?? [],
        score: applyEpisodeMentions(base, Number(f.mentions)),
      };
    })
    .sort((a, b) => (b.score - a.score !== 0 ? b.score - a.score : a.id < b.id ? -1 : 1))
    .slice(0, limit);

  return { nodes, facts: rankedFacts };
}

// =============================================================================
// Traversal helpers
// =============================================================================

export interface NeighborsResult {
  nodes: Array<{ id: string; kind: string; name: string; naturalKey: string; distance: number }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    relation: string;
    fact: string;
  }>;
}

/** Neighbors of a node within `depth` hops (bidirectional), current or as-of `at`. */
export async function kgNeighbors(
  exec: KgExecutor,
  nodeId: string,
  options: { depth?: number; relations?: EdgeRelation[]; at?: Date } = {},
): Promise<NeighborsResult> {
  const depth = options.depth ?? 1;
  const distances = await bfsChannel(exec, nodeId, options.relations, options.at, depth);
  const ids = [...distances.keys()];
  const detail = await hydrateNodes(exec, ids);
  const atParam = options.at ? '$2' : null;
  const edgeParams: unknown[] = [ids, ...(options.at ? [options.at.toISOString()] : [])];
  const edges = await exec.query<FactRow>(
    `SELECT id, source_id, target_id, relation, fact, valid_at, invalid_at
     FROM kg_edges e
     WHERE (e.source_id = ANY($1::text[]) AND e.target_id = ANY($1::text[]))
       AND (${edgeTemporalClause('e', atParam)})`,
    edgeParams,
  );
  return {
    nodes: ids.flatMap((id) => {
      const d = detail.get(id);
      if (!d) return [];
      return [
        {
          id,
          kind: d.kind,
          name: d.name,
          naturalKey: d.natural_key,
          distance: distances.get(id) ?? 0,
        },
      ];
    }),
    edges: edges.map((e) => ({
      id: e.id,
      sourceId: e.source_id,
      targetId: e.target_id,
      relation: e.relation,
      fact: e.fact,
    })),
  };
}

/** The current (or as-of `at`) edges incident to a node — its facts at time t. */
export async function kgAtTime(exec: KgExecutor, nodeId: string, at: Date): Promise<RankedFact[]> {
  const rows = await exec.query<FactRow>(
    `SELECT e.id, e.source_id, e.target_id, e.relation, e.fact, e.valid_at, e.invalid_at,
            count(ee.episode_id)::int AS mentions,
            coalesce(array_agg(ee.episode_id) FILTER (WHERE ee.episode_id IS NOT NULL), '{}') AS episode_ids
     FROM kg_edges e
     LEFT JOIN kg_edge_episodes ee ON ee.edge_id = e.id
     WHERE (e.source_id = $1 OR e.target_id = $1)
       AND (${edgeTemporalClause('e', '$2')})
     GROUP BY e.id
     ORDER BY e.valid_at DESC, e.id`,
    [nodeId, at.toISOString()],
  );
  return rows.map((f) => ({
    id: f.id,
    sourceId: f.source_id,
    targetId: f.target_id,
    relation: f.relation,
    fact: f.fact,
    validAt: f.valid_at,
    invalidAt: f.invalid_at,
    mentions: Number(f.mentions),
    episodeIds: f.episode_ids ?? [],
    score: 1,
  }));
}

/** Shortest path (node-id list) between two nodes via undirected BFS, or null. */
export async function kgPath(
  exec: KgExecutor,
  from: string,
  to: string,
  options: { at?: Date; maxDepth?: number } = {},
): Promise<string[] | null> {
  const maxDepth = options.maxDepth ?? 6;
  const atParam = options.at ? '$3' : null;
  const params: unknown[] = [from, to, ...(options.at ? [options.at.toISOString()] : [])];
  const rows = await exec.query<{ path: string[] }>(
    `WITH RECURSIVE walk(node_id, path, depth) AS (
       SELECT $1::text, ARRAY[$1::text], 0
       UNION ALL
       SELECT nxt, w.path || nxt, w.depth + 1
       FROM walk w
       JOIN LATERAL (
         SELECT CASE WHEN e.source_id = w.node_id THEN e.target_id ELSE e.source_id END AS nxt
         FROM kg_edges e
         WHERE (e.source_id = w.node_id OR e.target_id = w.node_id)
           AND (${edgeTemporalClause('e', atParam)})
       ) step ON true
       WHERE w.depth < ${maxDepth} AND NOT (nxt = ANY(w.path)) AND w.node_id <> $2::text
     )
     SELECT path FROM walk WHERE node_id = $2::text ORDER BY depth LIMIT 1`,
    params,
  );
  return rows[0]?.path ?? null;
}
