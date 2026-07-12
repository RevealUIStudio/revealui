/**
 * Core shared types for the fleet knowledge graph.
 *
 * The library operates over a minimal `KgExecutor` query interface rather than a
 * concrete driver, so the same ingest/search code runs against Neon (via a `pg`
 * pool) in production and PGlite in tests. Retrieval-heavy paths use raw SQL;
 * this keeps pgvector / tsvector / recursive-CTE features accessible without
 * fighting the ORM.
 */

import type { EdgeRelation, NodeKind } from './ontology/index.js';

/**
 * Minimal query surface. `pg.Pool` and `PGlite` both satisfy this via a thin
 * adapter (see `db/executor.ts`).
 *
 * `transaction` runs `fn` with an executor bound to a single BEGIN/COMMIT
 * session: on success the session commits, on a thrown error it rolls back
 * and the error propagates. Spec §6 requires per-episode transactional
 * application, so `applyScan`/`ingestEpisode` wrap their op-batch (including
 * outbox writes) in one; embedding backfill is best-effort derived data and
 * always runs outside the transaction.
 */
export interface KgExecutor {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: KgExecutor) => Promise<T>): Promise<T>;
}

/** A reference to a node by its ontology kind + natural key (ids are derived, never assigned). */
export interface NodeRef {
  kind: NodeKind;
  naturalKey: string;
}

/** Candidate node emitted by an extractor / episode. */
export interface NodeInput {
  kind: NodeKind;
  name: string;
  naturalKey: string;
  repo?: string | null;
  summary?: string | null;
  attributes?: Record<string, unknown>;
}

/** Candidate edge emitted by an extractor / episode; endpoints given by natural key. */
export interface EdgeInput {
  source: NodeRef;
  target: NodeRef;
  relation: EdgeRelation;
  fact: string;
  repo?: string | null;
  /** When the fact became true. Defaults to the episode's reference time. */
  validAt?: Date;
  attributes?: Record<string, unknown>;
}

export type EpisodeType =
  | 'code-scan'
  | 'git-commit'
  | 'doc'
  | 'agent-fact'
  | 'memory'
  | 'json'
  | 'manual';

/** An immutable provenance unit. Its id is content-addressed (see `deriveEpisodeId`). */
export interface EpisodeInput {
  episodeType: EpisodeType;
  source: string;
  siteId: string;
  content?: string | null;
  contentRef?: Record<string, unknown>;
  referenceTime: Date;
}

/**
 * The convergent, serializable graph mutation primitives (class 1/2, spec §8.1).
 * Every op is idempotent + commutative — replaying an op-set in any interleaving
 * from any site reaches identical state. These are what `kg_outbox` stores.
 */
export type KgOp =
  | { t: 'episode'; id: string; row: EpisodeRow }
  | { t: 'node'; id: string; row: NodeRow }
  | { t: 'edge'; id: string; row: EdgeRow; episodeIds: string[] }
  | { t: 'invalidate'; edgeId: string; invalidAt: string }
  | { t: 'expire'; edgeId: string; expiredAt: string }
  | { t: 'alias'; alias: string; nodeId: string };

export interface EpisodeRow {
  id: string;
  episode_type: EpisodeType;
  source: string;
  site_id: string;
  content: string | null;
  content_ref: Record<string, unknown>;
  reference_time: string;
}

export interface NodeRow {
  id: string;
  kind: NodeKind;
  name: string;
  natural_key: string;
  repo: string | null;
  summary: string | null;
  /**
   * Derived (class 3): normalized rendering of name + naturalKey + summary
   * (separators → spaces, camelCase boundaries → spaces) that the generated
   * `search` tsvector indexes — word-level FTS queries match file/host-type
   * tokens like `electric-proxy.ts`. See `search/normalize-text.ts`.
   */
  search_text: string;
  attributes: Record<string, unknown>;
  first_seen_at: string;
  last_confirmed_at: string;
  deleted_at: string | null;
}

export interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  relation: EdgeRelation;
  fact: string;
  repo: string | null;
  attributes: Record<string, unknown>;
  valid_at: string;
  invalid_at: string | null;
  expired_at: string | null;
}

/** Signature of the injected embedding function (default: none — embeddings deferred). */
export type Embedder = (text: string) => Promise<number[]>;

/** Result of a scan-style ingestion. */
export interface ScanApplyResult {
  episodeId: string;
  nodeCount: number;
  edgeCount: number;
  invalidatedEdgeIds: string[];
  ops: KgOp[];
}
