/**
 * Convergent write API — applies the class-1/2 CRDT merge rules (spec §8.1).
 *
 * Every mutation is one of the `KgOp` primitives, and every primitive is
 * idempotent + commutative:
 *   - class 1 (G-Set): episode / edge / edge-episode / alias inserts use
 *     `ON CONFLICT DO NOTHING`.
 *   - class 2 (monotonic): `first_seen_at` min-wins (`LEAST`), `last_confirmed_at`
 *     max-wins (`GREATEST`), `deleted_at` / `invalid_at` / `expired_at` min-wins
 *     (`LEAST`, which ignores NULL — the first evidence sets it, later evidence
 *     can only move it earlier, and a re-confirm with NULL preserves it).
 *
 * Replaying any op-set in any interleaving from any site therefore reaches
 * identical state, which is what the convergence tests assert.
 */

import type { KgExecutor, KgOp } from '../types.js';

function json(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export interface ApplyOptions {
  /** When set, each applied op is appended to `kg_outbox` for offline push. */
  siteId?: string;
  recordOutbox?: boolean;
}

/** Apply a single convergent op. Safe to replay in any order. */
export async function applyOp(
  exec: KgExecutor,
  op: KgOp,
  options: ApplyOptions = {},
): Promise<void> {
  switch (op.t) {
    case 'episode': {
      const r = op.row;
      await exec.query(
        `INSERT INTO kg_episodes (id, episode_type, source, site_id, content, content_ref, reference_time)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.episode_type,
          r.source,
          r.site_id,
          r.content,
          json(r.content_ref),
          r.reference_time,
        ],
      );
      break;
    }
    case 'node': {
      const r = op.row;
      await exec.query(
        `INSERT INTO kg_nodes
           (id, kind, name, natural_key, repo, summary, attributes,
            first_seen_at, last_confirmed_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, $9::timestamptz, $10::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           repo = COALESCE(EXCLUDED.repo, kg_nodes.repo),
           summary = COALESCE(EXCLUDED.summary, kg_nodes.summary),
           attributes = kg_nodes.attributes || EXCLUDED.attributes,
           first_seen_at = LEAST(kg_nodes.first_seen_at, EXCLUDED.first_seen_at),
           last_confirmed_at = GREATEST(kg_nodes.last_confirmed_at, EXCLUDED.last_confirmed_at),
           deleted_at = LEAST(kg_nodes.deleted_at, EXCLUDED.deleted_at)`,
        [
          r.id,
          r.kind,
          r.name,
          r.natural_key,
          r.repo,
          r.summary,
          json(r.attributes),
          r.first_seen_at,
          r.last_confirmed_at,
          r.deleted_at,
        ],
      );
      break;
    }
    case 'edge': {
      if (op.episodeIds.length === 0) {
        throw new Error(`kg_edges ${op.id}: every edge must trace to at least one episode`);
      }
      const r = op.row;
      await exec.query(
        `INSERT INTO kg_edges
           (id, source_id, target_id, relation, fact, repo, attributes, valid_at, invalid_at, expired_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, $9::timestamptz, $10::timestamptz)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.source_id,
          r.target_id,
          r.relation,
          r.fact,
          r.repo,
          json(r.attributes),
          r.valid_at,
          r.invalid_at,
          r.expired_at,
        ],
      );
      for (const episodeId of op.episodeIds) {
        await exec.query(
          `INSERT INTO kg_edge_episodes (edge_id, episode_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [op.id, episodeId],
        );
      }
      break;
    }
    case 'invalidate': {
      await exec.query(
        `UPDATE kg_edges SET invalid_at = LEAST(invalid_at, $2::timestamptz) WHERE id = $1`,
        [op.edgeId, op.invalidAt],
      );
      break;
    }
    case 'expire': {
      await exec.query(
        `UPDATE kg_edges SET expired_at = LEAST(expired_at, $2::timestamptz) WHERE id = $1`,
        [op.edgeId, op.expiredAt],
      );
      break;
    }
    case 'alias': {
      await exec.query(
        `INSERT INTO kg_node_aliases (alias, node_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [op.alias, op.nodeId],
      );
      break;
    }
  }

  if (options.recordOutbox && options.siteId) {
    await exec.query(`INSERT INTO kg_outbox (site_id, op) VALUES ($1, $2::jsonb)`, [
      options.siteId,
      json(op),
    ]);
  }
}

/** Apply a sequence of ops in order. Order does not affect the final state. */
export async function applyOps(
  exec: KgExecutor,
  ops: KgOp[],
  options: ApplyOptions = {},
): Promise<void> {
  for (const op of ops) {
    await applyOp(exec, op, options);
  }
}
