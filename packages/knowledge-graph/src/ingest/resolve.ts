/**
 * Entity resolution helpers (spec §6 ladder, steps 1-2).
 *
 * Step 1 (exact natural key) is implicit in the deterministic ids — Tier-1
 * extractors cannot collide. Step 2 is alias lookup: alternate names for the
 * same entity ("the daemon", `@revdev/daemon`) map to one node id. Steps 3-4
 * (similarity merge, LLM adjudication) are P3.
 */

import type { KgExecutor, KgOp } from '../types.js';

/** Build an alias op (class 1: insert-only). */
export function aliasOp(alias: string, nodeId: string): KgOp {
  return { t: 'alias', alias, nodeId };
}

/** Resolve an alias to node id(s). Empty when unknown. */
export async function resolveAlias(exec: KgExecutor, alias: string): Promise<string[]> {
  const rows = await exec.query<{ node_id: string }>(
    `SELECT node_id FROM kg_node_aliases WHERE alias = $1`,
    [alias],
  );
  return rows.map((r) => r.node_id);
}

/** Look up a node id by exact natural key (unique). */
export async function resolveNaturalKey(
  exec: KgExecutor,
  naturalKey: string,
): Promise<string | null> {
  const rows = await exec.query<{ id: string }>(
    `SELECT id FROM kg_nodes WHERE natural_key = $1 LIMIT 1`,
    [naturalKey],
  );
  return rows[0]?.id ?? null;
}
