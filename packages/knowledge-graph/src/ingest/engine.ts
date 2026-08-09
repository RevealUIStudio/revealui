/**
 * Ingest engine — episode → extract → resolve → upsert → reconcile.
 *
 * `applyScan` is the deterministic-scan path (Tier-1 extractors): it computes
 * the desired edge set for a scope, upserts nodes, inserts new edges, and
 * invalidates edges from the previous scan of the same scope that are now absent
 * (`invalid_at = scan.referenceTime`, never deleted — spec §6). Presence is keyed
 * on the logical (source, target, relation) triple so re-scanning an unchanged
 * scope is a pure no-op and structural edges keep stable validity windows.
 *
 * `ingestEpisode` is the additive path (git commits, docs, agent facts): it adds
 * the episode, nodes, and edges without reconcile.
 *
 * Entity resolution is the cheap-first ladder (spec §6): deterministic natural
 * keys (Tier-1 collisions are impossible) then alias lookup. Similarity/LLM
 * adjudication (steps 3-4) are P3.
 *
 * Per spec §6, application is per-episode transactional: the op batch
 * (episode + node + edge + invalidation ops, and their outbox writes) commits
 * or rolls back as one unit via `KgExecutor.transaction`, so a crash mid-apply
 * never leaves a partially-applied scan (episode present, edges half-written,
 * stale edges not invalidated). Embedding backfill is best-effort derived data
 * and always runs OUTSIDE the transaction, after it commits.
 */

import { deriveEdgeId, deriveEpisodeId, deriveNodeId, SEP } from '../ids.js';
import { validateNodeAttributes } from '../ontology/index.js';
import { buildSearchText } from '../search/normalize-text.js';
import type {
  EdgeInput,
  Embedder,
  EpisodeInput,
  KgExecutor,
  KgOp,
  NodeInput,
  ScanApplyResult,
} from '../types.js';
import { invalidateContradictions as runInvalidateContradictions } from './contradiction.js';
import { backfillEdgeEmbedding, backfillNodeEmbedding } from './embed.js';
import { applyOps } from './merge.js';

export interface IngestOptions {
  /** Injected embedder (best-effort). Omit to defer embeddings. */
  embedder?: Embedder;
  /** Record every applied op into `kg_outbox` for offline replay. */
  recordOutbox?: boolean;
  /**
   * When true, after additive edge insert, invalidate any *current* edge with
   * the same (source, target, relation) triple and a different fact
   * (invalidate-not-delete; P3 contradiction ladder). Default false so MCP
   * agent-fact publish stays purely additive unless the caller opts in.
   */
  invalidateContradictions?: boolean;
}

export interface ScanInput {
  episode: EpisodeInput;
  nodes: NodeInput[];
  edges: EdgeInput[];
  /**
   * The scope this scan is authoritative for (drives diff invalidation). Scope
   * is keyed on (repo, extractor) — the extractor name is stamped into every
   * edge's `attributes.extractor` so two extractors that share a relation (e.g.
   * both `workspace` and `ts-project` emit `contains`) never invalidate each
   * other's edges on re-scan.
   */
  scope: { repo: string; extractor: string };
}

export interface EpisodeIngestInput {
  episode: EpisodeInput;
  nodes: NodeInput[];
  edges: EdgeInput[];
}

function nodeOp(node: NodeInput, referenceTime: Date): KgOp {
  const validation = validateNodeAttributes(node.kind, node.attributes);
  if (!validation.ok) {
    throw new Error(`kg_nodes ${node.kind}:${node.naturalKey}: ${validation.error}`);
  }
  const iso = referenceTime.toISOString();
  return {
    t: 'node',
    id: deriveNodeId(node.kind, node.naturalKey),
    row: {
      id: deriveNodeId(node.kind, node.naturalKey),
      kind: node.kind,
      name: node.name,
      natural_key: node.naturalKey,
      repo: node.repo ?? null,
      summary: node.summary ?? null,
      search_text: buildSearchText(node.name, node.naturalKey, node.summary),
      attributes: validation.data ?? {},
      first_seen_at: iso,
      last_confirmed_at: iso,
      deleted_at: null,
    },
  };
}

function edgeOp(
  edge: EdgeInput,
  episodeId: string,
  defaultValidAt: Date,
  repo: string | null,
  extractor: string | null,
): KgOp {
  const sourceId = deriveNodeId(edge.source.kind, edge.source.naturalKey);
  const targetId = deriveNodeId(edge.target.kind, edge.target.naturalKey);
  const validAt = edge.validAt ?? defaultValidAt;
  const id = deriveEdgeId(sourceId, targetId, edge.relation, validAt);
  const attributes = extractor
    ? { ...(edge.attributes ?? {}), extractor }
    : (edge.attributes ?? {});
  return {
    t: 'edge',
    id,
    episodeIds: [episodeId],
    row: {
      id,
      source_id: sourceId,
      target_id: targetId,
      relation: edge.relation,
      fact: edge.fact,
      repo: edge.repo ?? repo,
      attributes,
      valid_at: validAt.toISOString(),
      invalid_at: null,
      expired_at: null,
    },
  };
}

function episodeOp(episode: EpisodeInput): { id: string; op: KgOp } {
  const id = deriveEpisodeId(episode);
  return {
    id,
    op: {
      t: 'episode',
      id,
      row: {
        id,
        episode_type: episode.episodeType,
        source: episode.source,
        site_id: episode.siteId,
        content: episode.content ?? null,
        content_ref: episode.contentRef ?? {},
        reference_time: episode.referenceTime.toISOString(),
      },
    },
  };
}

async function applyEmbeddings(
  exec: KgExecutor,
  embedder: Embedder | undefined,
  nodeOps: KgOp[],
  edgeOps: KgOp[],
): Promise<void> {
  if (!embedder) return;
  for (const op of nodeOps) {
    if (op.t !== 'node') continue;
    const text = [op.row.name, op.row.summary].filter(Boolean).join('. ');
    await backfillNodeEmbedding(exec, embedder, op.id, text);
  }
  for (const op of edgeOps) {
    if (op.t !== 'edge') continue;
    await backfillEdgeEmbedding(exec, embedder, op.id, op.row.fact);
  }
}

interface CurrentEdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
}

/**
 * Deterministic-scan ingestion with re-scan diff invalidation.
 * Idempotent: applying the same scan twice yields no change.
 */
export async function applyScan(
  exec: KgExecutor,
  input: ScanInput,
  options: IngestOptions = {},
): Promise<ScanApplyResult> {
  const { referenceTime } = input.episode;
  const { id: episodeId, op: epOp } = episodeOp(input.episode);
  const nodeOps = input.nodes.map((n) => nodeOp(n, referenceTime));

  // Desired current triples for this scan.
  const desired = new Map<string, EdgeInput>();
  for (const edge of input.edges) {
    const sourceId = deriveNodeId(edge.source.kind, edge.source.naturalKey);
    const targetId = deriveNodeId(edge.target.kind, edge.target.naturalKey);
    desired.set([sourceId, targetId, edge.relation].join(SEP), edge);
  }

  // Existing current edges in this scope (repo + owning extractor).
  const existing = await exec.query<CurrentEdgeRow>(
    `SELECT id, source_id, target_id, relation FROM kg_edges
     WHERE invalid_at IS NULL AND expired_at IS NULL AND repo = $1
       AND attributes->>'extractor' = $2`,
    [input.scope.repo, input.scope.extractor],
  );

  const invalidateOps: KgOp[] = [];
  const seen = new Set<string>();
  for (const row of existing) {
    const key = [row.source_id, row.target_id, row.relation].join(SEP);
    if (desired.has(key)) {
      seen.add(key);
    } else {
      invalidateOps.push({
        t: 'invalidate',
        edgeId: row.id,
        invalidAt: referenceTime.toISOString(),
      });
    }
  }

  const edgeOps: KgOp[] = [];
  for (const [key, edge] of desired) {
    // Already current: the (source, target, relation) triple is unchanged, so
    // the existing row — including its `fact` text as templated at the scan
    // that first created it — is intentionally left in place. Tier-1 facts are
    // deterministic templates of the triple, so a later scan producing a
    // differently-worded `fact` for the same triple is not new information;
    // rewriting the row would churn a stable validity window for no semantic
    // gain. (Real fact changes come from a NEW triple, which is not "seen".)
    if (seen.has(key)) continue;
    edgeOps.push(edgeOp(edge, episodeId, referenceTime, input.scope.repo, input.scope.extractor));
  }

  const ops: KgOp[] = [epOp, ...nodeOps, ...edgeOps, ...invalidateOps];
  await exec.transaction((tx) =>
    applyOps(tx, ops, { siteId: input.episode.siteId, recordOutbox: options.recordOutbox }),
  );
  await applyEmbeddings(exec, options.embedder, nodeOps, edgeOps);

  return {
    episodeId,
    nodeCount: nodeOps.length,
    edgeCount: edgeOps.length,
    invalidatedEdgeIds: invalidateOps.flatMap((o) => (o.t === 'invalidate' ? [o.edgeId] : [])),
    ops,
  };
}

/** Additive ingestion (no reconcile) for git commits, docs, and agent facts. */
export async function ingestEpisode(
  exec: KgExecutor,
  input: EpisodeIngestInput,
  options: IngestOptions = {},
): Promise<ScanApplyResult> {
  const { referenceTime } = input.episode;
  const { id: episodeId, op: epOp } = episodeOp(input.episode);
  const nodeOps = input.nodes.map((n) => nodeOp(n, referenceTime));
  const edgeOps = input.edges.map((e) => edgeOp(e, episodeId, referenceTime, null, null));

  const ops: KgOp[] = [epOp, ...nodeOps, ...edgeOps];
  await exec.transaction((tx) =>
    applyOps(tx, ops, { siteId: input.episode.siteId, recordOutbox: options.recordOutbox }),
  );

  let invalidatedEdgeIds: string[] = [];
  if (options.invalidateContradictions && input.edges.length > 0) {
    invalidatedEdgeIds = await runInvalidateContradictions(exec, input.edges, {
      siteId: input.episode.siteId,
      invalidAt: referenceTime,
      recordOutbox: options.recordOutbox,
    });
  }

  await applyEmbeddings(exec, options.embedder, nodeOps, edgeOps);

  return {
    episodeId,
    nodeCount: nodeOps.length,
    edgeCount: edgeOps.length,
    invalidatedEdgeIds,
    ops,
  };
}
