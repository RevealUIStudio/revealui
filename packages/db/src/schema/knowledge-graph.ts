/**
 * Fleet Knowledge Graph — bi-temporal, content-addressed graph tables (GAP-340).
 *
 * A graphiti-style temporal knowledge graph of the fleet: episodes are immutable
 * provenance units, nodes are entities, edges are bi-temporal facts that are
 * never deleted (supersession sets `invalidAt`/`expiredAt`). Stored on the single
 * Neon primary alongside the pgvector extension.
 *
 * CRDT classification (design-spec §8.1) is annotated per column so the graph is
 * convergent by construction:
 *   - class 1 (G-Set, content-addressed): episodes, edges, edge-episode joins, aliases
 *   - class 2 (monotonic semilattice): validAt/invalidAt/expiredAt, firstSeenAt/
 *     lastConfirmedAt/deletedAt — merged with LEAST/GREATEST
 *   - class 3 (derived, never synced peer-to-peer): summary, embedding, the
 *     `search` tsvector generated column, mention counts — recomputed locally
 *
 * The `embedding` (pgvector) columns, the `search` tsvector generated columns,
 * the HNSW / GIN indexes, and the partial current-edge indexes are added by the
 * companion custom migration (`migrations/0021_knowledge_graph.sql`) because they
 * cannot be expressed in the Drizzle schema DSL. This module is the ORM-facing
 * source of truth for the columns Drizzle reads/writes.
 *
 * Embedding dimensions: 768 (nomic-embed-text via Ollama — policy default).
 */

import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { vector } from './_vector-type.js';

// =============================================================================
// kg_episodes — immutable provenance units (class 1: content-addressed G-Set)
// =============================================================================

export const kgEpisodes = pgTable(
  'kg_episodes',
  {
    /** Content-addressed SHA-256 UUID over (episodeType, source, contentRef, referenceTime). */
    id: text('id').primaryKey(),
    episodeType: text('episode_type').notNull(),
    /** Origin descriptor, e.g. `revealui`, `shared_facts:coord-abc123`, `claude-memory`. */
    source: text('source').notNull(),
    /** Originating replica/site (site registry). */
    siteId: text('site_id').notNull(),
    content: text('content'),
    contentRef: jsonb('content_ref').default({}),
    /** When the described state was true (commit time, scan time, fact time). */
    referenceTime: timestamp('reference_time', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('kg_episodes_source_idx').on(table.source),
    index('kg_episodes_reference_time_idx').on(table.referenceTime),
    check(
      'kg_episodes_type_check',
      sql`episode_type IN ('code-scan', 'git-commit', 'doc', 'agent-fact', 'memory', 'json', 'manual')`,
    ),
  ],
);

// =============================================================================
// kg_nodes — entities (deterministic id over kind + naturalKey)
// =============================================================================

export const kgNodes = pgTable(
  'kg_nodes',
  {
    /** Deterministic SHA-256 UUID over `kind + ':' + naturalKey`. */
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    /** Globally unique natural key, e.g. `revealui/packages/ai/src/llm/client.ts#getClient`. */
    naturalKey: text('natural_key').notNull(),
    /** Denormalized partition key for Electric shape filtering; null for cross-repo concepts. */
    repo: text('repo'),
    /** Derived (class 3): deterministic template first, LLM refinement later. */
    summary: text('summary'),
    /**
     * Derived (class 3, GAP-349): normalized rendering of name + naturalKey +
     * summary (separators → spaces, camelCase boundaries → spaces) that the
     * generated `search` tsvector indexes, so word-level FTS queries match
     * file/host-type tokens like `electric-proxy.ts`. Written by the ingest
     * engine on every node upsert; see `@revealui/knowledge-graph`
     * `search/normalize-text.ts`.
     */
    searchText: text('search_text').notNull().default(''),
    /** Zod-validated per kind. Mutable values are per-key LWW registers. */
    attributes: jsonb('attributes').default({}),
    /** Sibling clock for `attributes`: per-key `(timestamp, siteId)` LWW tiebreak. */
    attributesClock: jsonb('attributes_clock').default({}),
    /** Derived (class 3): embedding over name + summary; nullable for deferred backfill. */
    embedding: vector('embedding', { dimensions: 768 }),
    /** Monotonic (class 2): min-wins. */
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    /** Monotonic (class 2): max-wins. */
    lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }).notNull(),
    /** Monotonic (class 2): min-wins tombstone when the entity disappears from scans. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('kg_nodes_natural_key_idx').on(table.naturalKey),
    index('kg_nodes_kind_natural_key_idx').on(table.kind, table.naturalKey),
    index('kg_nodes_repo_idx').on(table.repo),
  ],
);

// =============================================================================
// kg_edges — bi-temporal facts (class 1 id; class 2 temporal columns)
// =============================================================================

export const kgEdges = pgTable(
  'kg_edges',
  {
    /** Deterministic SHA-256 UUID over (sourceId, targetId, relation, validAt). */
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => kgNodes.id, { onDelete: 'cascade' }),
    targetId: text('target_id')
      .notNull()
      .references(() => kgNodes.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull(),
    /** Human-readable sentence (graphiti-style). */
    fact: text('fact').notNull(),
    repo: text('repo'),
    attributes: jsonb('attributes').default({}),
    /** Derived (class 3): embedding over `fact`; nullable for deferred backfill. */
    embedding: vector('embedding', { dimensions: 768 }),
    /** Valid time. `validAt` NOT NULL; `invalidAt` min-wins on merge (class 2). */
    validAt: timestamp('valid_at', { withTimezone: true }).notNull(),
    invalidAt: timestamp('invalid_at', { withTimezone: true }),
    /** System time. `expiredAt` min-wins (class 2). */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiredAt: timestamp('expired_at', { withTimezone: true }),
  },
  (table) => [
    index('kg_edges_valid_at_idx').on(table.validAt),
    index('kg_edges_repo_idx').on(table.repo),
    index('kg_edges_target_idx').on(table.targetId, table.relation),
  ],
);

// =============================================================================
// kg_edge_episodes — provenance join (class 1: insert-only G-Set)
// =============================================================================

export const kgEdgeEpisodes = pgTable(
  'kg_edge_episodes',
  {
    edgeId: text('edge_id')
      .notNull()
      .references(() => kgEdges.id, { onDelete: 'cascade' }),
    episodeId: text('episode_id')
      .notNull()
      .references(() => kgEpisodes.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.edgeId, table.episodeId] })],
);

// =============================================================================
// kg_node_aliases — entity resolution (class 1: insert-only G-Set)
// =============================================================================

export const kgNodeAliases = pgTable(
  'kg_node_aliases',
  {
    alias: text('alias').notNull(),
    nodeId: text('node_id')
      .notNull()
      .references(() => kgNodes.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.alias, table.nodeId] })],
);

// =============================================================================
// kg_outbox — per-site op log for offline replay (class 1)
// =============================================================================

export const kgOutbox = pgTable(
  'kg_outbox',
  {
    seq: bigserial('seq', { mode: 'number' }).primaryKey(),
    siteId: text('site_id').notNull(),
    /** Serialized mutation (episode insert, node upsert, edge insert, invalidation, alias add). */
    op: jsonb('op').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    pushedAt: timestamp('pushed_at', { withTimezone: true }),
  },
  (table) => [index('kg_outbox_pushed_at_idx').on(table.pushedAt)],
);

// =============================================================================
// Type exports
// =============================================================================

export type KgEpisode = typeof kgEpisodes.$inferSelect;
export type NewKgEpisode = typeof kgEpisodes.$inferInsert;
export type KgNode = typeof kgNodes.$inferSelect;
export type NewKgNode = typeof kgNodes.$inferInsert;
export type KgEdge = typeof kgEdges.$inferSelect;
export type NewKgEdge = typeof kgEdges.$inferInsert;
export type KgEdgeEpisode = typeof kgEdgeEpisodes.$inferSelect;
export type NewKgEdgeEpisode = typeof kgEdgeEpisodes.$inferInsert;
export type KgNodeAlias = typeof kgNodeAliases.$inferSelect;
export type NewKgNodeAlias = typeof kgNodeAliases.$inferInsert;
export type KgOutboxEntry = typeof kgOutbox.$inferSelect;
export type NewKgOutboxEntry = typeof kgOutbox.$inferInsert;
