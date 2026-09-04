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

import { bindVisibility, SqlParams } from '../memory/scope-sql.js';
import type { MemoryPrincipal } from '../memory/types.js';
import type { EdgeRelation, NodeKind } from '../ontology/index.js';
import type { KgExecutor } from '../types.js';
import { applyEpisodeMentions, applyNodeDistance, rankByScore, rrfFuse } from './rrf.js';

export type { DriftCandidate, KgDriftOptions } from './drift.js';
export { kgDrift } from './drift.js';

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
  /**
   * Product-memory principal. When hosted, node and fact channels restrict to
   * visible rows in SQL before LIMIT. Studio-local / omitted = unrestricted.
   */
  principal?: MemoryPrincipal;
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
  principal: MemoryPrincipal | undefined,
): Promise<string[]> {
  const p = new SqlParams();
  const vis = bindVisibility(principal, p);
  const q = p.add(query);
  const kindsP = p.add(kinds ?? null);
  const limitP = p.add(limit);
  const visSql = vis ? `AND ${vis.nodeVisible('n')}` : '';
  const rows = await exec.query<NodeChannelRow>(
    `SELECT n.id FROM kg_nodes n
     WHERE n.search @@ websearch_to_tsquery('english', ${q})
       AND (${kindsP}::text[] IS NULL OR n.kind = ANY(${kindsP}::text[]))
       ${visSql}
     ORDER BY ts_rank(n.search, websearch_to_tsquery('english', ${q})) DESC, n.id
     LIMIT ${limitP}`,
    p.values,
  );
  return rows.map((r) => r.id);
}

async function nodeVectorChannel(
  exec: KgExecutor,
  queryEmbedding: number[] | undefined,
  kinds: NodeKind[] | undefined,
  limit: number,
  principal: MemoryPrincipal | undefined,
): Promise<string[]> {
  if (!queryEmbedding || queryEmbedding.length === 0) return [];
  const p = new SqlParams();
  const vis = bindVisibility(principal, p);
  const embeddingP = p.add(formatVector(queryEmbedding));
  const kindsP = p.add(kinds ?? null);
  const limitP = p.add(limit);
  const visSql = vis ? `AND ${vis.nodeVisible('n')}` : '';
  try {
    const rows = await exec.query<NodeChannelRow>(
      `SELECT n.id FROM kg_nodes n
       WHERE n.embedding IS NOT NULL
         AND (${kindsP}::text[] IS NULL OR n.kind = ANY(${kindsP}::text[]))
         ${visSql}
       ORDER BY n.embedding <=> ${embeddingP}::vector
       LIMIT ${limitP}`,
      p.values,
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
  principal: MemoryPrincipal | undefined,
): Promise<Map<string, number>> {
  const distances = new Map<string, number>();
  if (!anchor) return distances;
  const p = new SqlParams();
  const vis = bindVisibility(principal, p);
  const anchorP = p.add(anchor);
  const relationsP = p.add(relations ?? null);
  const atP = at ? p.add(at.toISOString()) : null;
  const visSql = vis ? `AND ${vis.edgeVisible('e')}` : '';
  const rows = await exec.query<{ node_id: string; depth: number }>(
    `WITH RECURSIVE bfs(node_id, depth) AS (
       SELECT ${anchorP}::text, 0
       UNION
       SELECT CASE WHEN e.source_id = b.node_id THEN e.target_id ELSE e.source_id END, b.depth + 1
       FROM bfs b
       JOIN kg_edges e ON (e.source_id = b.node_id OR e.target_id = b.node_id)
       WHERE b.depth < ${depth}
         AND (${edgeTemporalClause('e', atP)})
         AND (${relationsP}::text[] IS NULL OR e.relation = ANY(${relationsP}::text[]))
         ${visSql}
     )
     SELECT node_id, MIN(depth) AS depth FROM bfs GROUP BY node_id`,
    p.values,
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
  principal: MemoryPrincipal | undefined,
): Promise<FactRow[]> {
  const p = new SqlParams();
  const vis = bindVisibility(principal, p);
  const q = p.add(query);
  const relationsP = p.add(relations ?? null);
  const limitP = p.add(limit);
  const atP = at ? p.add(at.toISOString()) : null;
  const visSql = vis ? `AND ${vis.edgeVisible('e')}` : '';
  return exec.query<FactRow>(
    `SELECT e.id, e.source_id, e.target_id, e.relation, e.fact, e.valid_at, e.invalid_at,
            count(ee.episode_id)::int AS mentions,
            coalesce(array_agg(ee.episode_id) FILTER (WHERE ee.episode_id IS NOT NULL), '{}') AS episode_ids
     FROM kg_edges e
     LEFT JOIN kg_edge_episodes ee ON ee.edge_id = e.id
     WHERE e.search @@ websearch_to_tsquery('english', ${q})
       AND (${edgeTemporalClause('e', atP)})
       AND (${relationsP}::text[] IS NULL OR e.relation = ANY(${relationsP}::text[]))
       ${visSql}
     GROUP BY e.id
     ORDER BY ts_rank(e.search, websearch_to_tsquery('english', ${q})) DESC, e.id
     LIMIT ${limitP}`,
    p.values,
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
    nodeFtsChannel(exec, q.query, q.kinds, channelLimit, q.principal),
    nodeVectorChannel(exec, q.queryEmbedding, q.kinds, channelLimit, q.principal),
    bfsChannel(exec, q.anchor, q.relations, q.at, depth, q.principal),
    factChannel(exec, q.query, q.relations, q.at, channelLimit, q.principal),
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
  options: {
    depth?: number;
    relations?: EdgeRelation[];
    at?: Date;
    principal?: MemoryPrincipal;
  } = {},
): Promise<NeighborsResult> {
  const depth = options.depth ?? 1;
  const distances = await bfsChannel(
    exec,
    nodeId,
    options.relations,
    options.at,
    depth,
    options.principal,
  );
  const ids = [...distances.keys()];
  const detail = await hydrateNodes(exec, ids);
  const p = new SqlParams();
  const vis = bindVisibility(options.principal, p);
  const idsP = p.add(ids);
  const atP = options.at ? p.add(options.at.toISOString()) : null;
  const visSql = vis ? `AND ${vis.edgeVisible('e')}` : '';
  const edges = await exec.query<FactRow>(
    `SELECT e.id, e.source_id, e.target_id, e.relation, e.fact, e.valid_at, e.invalid_at
     FROM kg_edges e
     WHERE (e.source_id = ANY(${idsP}::text[]) AND e.target_id = ANY(${idsP}::text[]))
       AND (${edgeTemporalClause('e', atP)})
       ${visSql}`,
    p.values,
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
export async function kgAtTime(
  exec: KgExecutor,
  nodeId: string,
  at: Date,
  options: { principal?: MemoryPrincipal } = {},
): Promise<RankedFact[]> {
  const p = new SqlParams();
  const vis = bindVisibility(options.principal, p);
  const nodeP = p.add(nodeId);
  const atP = p.add(at.toISOString());
  const visSql = vis ? `AND ${vis.edgeVisible('e')}` : '';
  const rows = await exec.query<FactRow>(
    `SELECT e.id, e.source_id, e.target_id, e.relation, e.fact, e.valid_at, e.invalid_at,
            count(ee.episode_id)::int AS mentions,
            coalesce(array_agg(ee.episode_id) FILTER (WHERE ee.episode_id IS NOT NULL), '{}') AS episode_ids
     FROM kg_edges e
     LEFT JOIN kg_edge_episodes ee ON ee.edge_id = e.id
     WHERE (e.source_id = ${nodeP} OR e.target_id = ${nodeP})
       AND (${edgeTemporalClause('e', atP)})
       ${visSql}
     GROUP BY e.id
     ORDER BY e.valid_at DESC, e.id`,
    p.values,
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
  options: { at?: Date; maxDepth?: number; principal?: MemoryPrincipal } = {},
): Promise<string[] | null> {
  const maxDepth = options.maxDepth ?? 6;
  const p = new SqlParams();
  const vis = bindVisibility(options.principal, p);
  const fromP = p.add(from);
  const toP = p.add(to);
  const atP = options.at ? p.add(options.at.toISOString()) : null;
  const visSql = vis ? `AND ${vis.edgeVisible('e')}` : '';
  const rows = await exec.query<{ path: string[] }>(
    `WITH RECURSIVE walk(node_id, path, depth) AS (
       SELECT ${fromP}::text, ARRAY[${fromP}::text], 0
       UNION ALL
       SELECT nxt, w.path || nxt, w.depth + 1
       FROM walk w
       JOIN LATERAL (
         SELECT CASE WHEN e.source_id = w.node_id THEN e.target_id ELSE e.source_id END AS nxt
         FROM kg_edges e
         WHERE (e.source_id = w.node_id OR e.target_id = w.node_id)
           AND (${edgeTemporalClause('e', atP)})
           ${visSql}
       ) step ON true
       WHERE w.depth < ${maxDepth} AND NOT (nxt = ANY(w.path)) AND w.node_id <> ${toP}::text
     )
     SELECT path FROM walk WHERE node_id = ${toP}::text ORDER BY depth LIMIT 1`,
    p.values,
  );
  return rows[0]?.path ?? null;
}
