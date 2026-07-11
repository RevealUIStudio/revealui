/**
 * PGlite-backed test harness for the knowledge graph.
 *
 * Builds the kg_* tables from the `portable` DDL variant (embedding as `real[]`,
 * no HNSW) so tsvector FTS, recursive-CTE traversal, temporal predicates, and
 * the class-1/2 merge SQL are exercised against real Postgres semantics without
 * the pgvector extension. The vector search channel is skipped when no query
 * embedding is supplied (the default in tests).
 */

import { PGlite } from '@electric-sql/pglite';
import { kgDdlStatements } from '../db/ddl.js';
import { makeExecutor } from '../db/executor.js';
import type { KgExecutor } from '../types.js';

export interface KgTestDb {
  exec: KgExecutor;
  pglite: PGlite;
  close(): Promise<void>;
}

export async function createKgTestDb(): Promise<KgTestDb> {
  const pglite = new PGlite();
  for (const statement of kgDdlStatements({ variant: 'portable' })) {
    await pglite.exec(statement);
  }
  return {
    exec: makeExecutor(pglite),
    pglite,
    async close() {
      await pglite.close();
    },
  };
}

/**
 * Full-table snapshot used by convergence assertions (order-independent).
 *
 * `created_at` (the row's `DEFAULT now()` insertion wall-clock) is dropped: it
 * is a purely local, per-site audit stamp — two sites insert at different
 * moments — so it is not part of the convergent logical state. Everything
 * load-bearing for the graph (content, provenance, and the monotonic temporal
 * columns valid_at/invalid_at/expired_at/first_seen_at/last_confirmed_at) IS
 * compared.
 */
export async function snapshot(exec: KgExecutor): Promise<Record<string, unknown[]>> {
  const tables = ['kg_episodes', 'kg_nodes', 'kg_edges', 'kg_edge_episodes', 'kg_node_aliases'];
  const result: Record<string, unknown[]> = {};
  for (const table of tables) {
    // Deterministic ordering so two convergent states compare equal.
    const orderBy = table === 'kg_edge_episodes' ? 'edge_id, episode_id' : 'id';
    const key = table === 'kg_node_aliases' ? 'alias, node_id' : orderBy;
    const rows = await exec.query<Record<string, unknown>>(
      `SELECT * FROM ${table} ORDER BY ${key}`,
    );
    result[table] = rows.map(({ created_at: _createdAt, ...rest }) => rest);
  }
  return result;
}
