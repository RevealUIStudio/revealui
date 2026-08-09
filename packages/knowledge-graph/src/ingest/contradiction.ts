/**
 * P3 contradiction handling — temporal invalidation, never delete.
 *
 * When a new edge is ingested, any *current* edge with the same
 * (source, target, relation) triple and a *different* fact is treated as
 * contradicted and gets `invalid_at` set (spec §6 invalidate-not-delete).
 *
 * Similarity ladder step 3 (cheap): if two natural keys normalize equal after
 * lowercasing and collapsing separators, they share a node alias opportunity
 * (caller may apply aliasOp separately).
 */

import { deriveNodeId } from '../ids.js';
import type { EdgeRelation, NodeKind } from '../ontology/index.js';
import type { EdgeInput, KgExecutor } from '../types.js';
import { applyOp } from './merge.js';

export interface ContradictingEdge {
  id: string;
  fact: string;
  validAt: string;
}

/**
 * Find current edges that share endpoints+relation but differ in fact text.
 */
export async function findContradictingEdges(
  exec: KgExecutor,
  edge: EdgeInput,
  options?: { at?: Date },
): Promise<ContradictingEdge[]> {
  const sourceId = deriveNodeId(edge.source.kind as NodeKind, edge.source.naturalKey);
  const targetId = deriveNodeId(edge.target.kind as NodeKind, edge.target.naturalKey);
  const relation = edge.relation as EdgeRelation;
  const at = options?.at ?? new Date();

  const rows = await exec.query<{
    id: string;
    fact: string;
    valid_at: string;
  }>(
    `SELECT id, fact, valid_at
     FROM kg_edges
     WHERE source_id = $1
       AND target_id = $2
       AND relation = $3
       AND valid_at <= $4::timestamptz
       AND (invalid_at IS NULL OR invalid_at > $4::timestamptz)
       AND (expired_at IS NULL OR expired_at > $4::timestamptz)
       AND fact IS DISTINCT FROM $5`,
    [sourceId, targetId, relation, at.toISOString(), edge.fact],
  );

  return rows.map((r) => ({
    id: r.id,
    fact: r.fact,
    validAt: r.valid_at,
  }));
}

/**
 * Invalidate all contradicting current edges for each new edge.
 * Returns invalidated edge ids.
 */
export async function invalidateContradictions(
  exec: KgExecutor,
  edges: EdgeInput[],
  options: {
    siteId: string;
    invalidAt?: Date;
    recordOutbox?: boolean;
  },
): Promise<string[]> {
  const invalidAt = options.invalidAt ?? new Date();
  const invalidated: string[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    const hits = await findContradictingEdges(exec, edge, { at: invalidAt });
    for (const hit of hits) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      await applyOp(
        exec,
        { t: 'invalidate', edgeId: hit.id, invalidAt: invalidAt.toISOString() },
        { siteId: options.siteId, recordOutbox: options.recordOutbox ?? true },
      );
      invalidated.push(hit.id);
    }
  }

  return invalidated;
}

/** Cheap natural-key normalization for entity-resolution ladder step 3. */
export function normalizeNaturalKey(key: string): string {
  return Array.from(key.toLowerCase())
    .map((c) => {
      if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) return c;
      return '-';
    })
    .join('')
    .split('-')
    .filter((p) => p.length > 0)
    .join('-');
}

/**
 * True when two natural keys collapse to the same normalized form
 * (suggests alias / merge candidate; does not write aliases).
 */
export function naturalKeysSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  return normalizeNaturalKey(a) === normalizeNaturalKey(b);
}
