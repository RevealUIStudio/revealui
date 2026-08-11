/**
 * Repo decommission — invalidate-not-delete for a retired fleet repo.
 *
 * GAP-349 plan residual: `revkg decommission <repo>` sets `invalid_at` on every
 * *current* edge partitioned under that repo at the ice date. Point-in-time
 * queries before the ice date still return pre-decommission facts (spec §6).
 * Nodes are left in place so natural-key identity survives a future return;
 * re-scan creates fresh validity windows.
 */

import type { KgExecutor, KgOp } from '../types.js';
import { applyOps } from './merge.js';

export interface DecommissionOptions {
  /** Fleet repo partition key (e.g. `revealcoin`, `revealui`). */
  repo: string;
  /** Ice timestamp — default now. Stored as edge.invalid_at (min-wins). */
  invalidAt?: Date;
  /** Site id for optional outbox recording. */
  siteId: string;
  /** When true, append invalidate ops to kg_outbox. Default true. */
  recordOutbox?: boolean;
  /**
   * When true, compute the edge id set and return counts without writing.
   * Default false.
   */
  dryRun?: boolean;
}

export interface DecommissionResult {
  repo: string;
  invalidAt: string;
  edgeIds: string[];
  dryRun: boolean;
}

/**
 * Invalidate every current edge with `repo = options.repo`.
 * Empty / whitespace repo is rejected (fail closed — never mass-invalidate).
 */
export async function decommissionRepo(
  exec: KgExecutor,
  options: DecommissionOptions,
): Promise<DecommissionResult> {
  const repo = options.repo.trim();
  if (!repo) {
    throw new Error('decommission requires a non-empty repo name');
  }

  const invalidAt = options.invalidAt ?? new Date();
  const invalidAtIso = invalidAt.toISOString();
  const dryRun = options.dryRun === true;

  // Current = valid_at <= ice AND (invalid_at null or > ice) AND (expired null or > ice).
  // At the ice instant we mark invalid_at = ice so point-in-time *before* ice still sees them.
  const rows = await exec.query<{ id: string }>(
    `SELECT id
     FROM kg_edges
     WHERE repo = $1
       AND valid_at <= $2::timestamptz
       AND (invalid_at IS NULL OR invalid_at > $2::timestamptz)
       AND (expired_at IS NULL OR expired_at > $2::timestamptz)
     ORDER BY id`,
    [repo, invalidAtIso],
  );

  const edgeIds = rows.map((r) => r.id);
  if (edgeIds.length === 0 || dryRun) {
    return { repo, invalidAt: invalidAtIso, edgeIds, dryRun };
  }

  const ops: KgOp[] = edgeIds.map((edgeId) => ({
    t: 'invalidate',
    edgeId,
    invalidAt: invalidAtIso,
  }));

  await applyOps(exec, ops, {
    siteId: options.siteId,
    recordOutbox: options.recordOutbox ?? true,
  });

  return { repo, invalidAt: invalidAtIso, edgeIds, dryRun: false };
}
