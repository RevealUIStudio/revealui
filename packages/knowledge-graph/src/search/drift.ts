/**
 * Doc-currency drift detection (design spec §8.5).
 *
 * `documents` edges make the code-over-docs rule (`~/.claude/rules/code-over-docs.md`)
 * queryable: a doc node that documents a code node is drifting when the code node
 * was confirmed by a scan AFTER the doc node's own last confirmation. `kgDrift`
 * walks every CURRENT `documents` edge and reports the ones where that holds,
 * sorted by staleness delta (largest first) so the worst drift surfaces first.
 *
 * Direction convention (no extractor emits `documents` edges yet as of P4 —
 * this is Tier-2/manual-episode territory per spec §6 Tier 2 and the P3 rider
 * list — so this is a documented assumption, not an empirically-observed
 * convention): `source` is the DOC node, `target` is the CODE node, matching
 * the spec's literal wording ("any doc node whose `documents` edge TARGETS a
 * code node"). `kgAddEpisode` / `kg_add_episode` callers that emit `documents`
 * edges must follow this direction for `revkg drift` to report them correctly.
 *
 * Read-only: no writes, no invalidation. Feeds the `doc-code-reconciliation`
 * lane and the doc-currency stale-fact scanner with grounded, per-claim
 * candidates instead of full-file heuristics.
 */

import type { KgExecutor } from '../types.js';

export interface DriftCandidate {
  edgeId: string;
  docNaturalKey: string;
  docKind: string;
  docLastConfirmedAt: string;
  codeNaturalKey: string;
  codeKind: string;
  codeLastConfirmedAt: string;
  /** Seconds by which the code node's last confirmation is newer than the doc's. */
  deltaSeconds: number;
  episodeIds: string[];
}

export interface KgDriftOptions {
  /** Restrict to `documents` edges stamped with this repo (edge.repo). Omit for fleet-wide. */
  repo?: string;
}

interface DriftRow {
  edge_id: string;
  doc_natural_key: string;
  doc_kind: string;
  doc_last_confirmed_at: string;
  code_natural_key: string;
  code_kind: string;
  code_last_confirmed_at: string;
  delta_seconds: number;
  episode_ids: string[] | null;
}

/**
 * Doc-currency drift candidates from current `documents` edges, sorted by
 * staleness delta descending. A candidate exists only when the code node's
 * `last_confirmed_at` is strictly newer than the doc node's (the `HAVING`
 * clause) — a doc confirmed at or after its code is not drifting.
 */
export async function kgDrift(
  exec: KgExecutor,
  options: KgDriftOptions = {},
): Promise<DriftCandidate[]> {
  const params: unknown[] = options.repo ? [options.repo] : [];
  const repoClause = options.repo ? `AND e.repo = $1` : '';

  const rows = await exec.query<DriftRow>(
    `SELECT
       e.id AS edge_id,
       doc.natural_key AS doc_natural_key,
       doc.kind AS doc_kind,
       doc.last_confirmed_at AS doc_last_confirmed_at,
       code.natural_key AS code_natural_key,
       code.kind AS code_kind,
       code.last_confirmed_at AS code_last_confirmed_at,
       EXTRACT(EPOCH FROM (code.last_confirmed_at - doc.last_confirmed_at)) AS delta_seconds,
       coalesce(array_agg(ee.episode_id) FILTER (WHERE ee.episode_id IS NOT NULL), '{}') AS episode_ids
     FROM kg_edges e
     JOIN kg_nodes doc ON doc.id = e.source_id
     JOIN kg_nodes code ON code.id = e.target_id
     LEFT JOIN kg_edge_episodes ee ON ee.edge_id = e.id
     WHERE e.relation = 'documents'
       AND e.invalid_at IS NULL AND e.expired_at IS NULL
       ${repoClause}
     GROUP BY e.id, doc.natural_key, doc.kind, doc.last_confirmed_at,
              code.natural_key, code.kind, code.last_confirmed_at
     HAVING code.last_confirmed_at > doc.last_confirmed_at
     ORDER BY delta_seconds DESC, e.id`,
    params,
  );

  return rows.map((r) => ({
    edgeId: r.edge_id,
    docNaturalKey: r.doc_natural_key,
    docKind: r.doc_kind,
    docLastConfirmedAt: r.doc_last_confirmed_at,
    codeNaturalKey: r.code_natural_key,
    codeKind: r.code_kind,
    codeLastConfirmedAt: r.code_last_confirmed_at,
    deltaSeconds: Number(r.delta_seconds),
    episodeIds: r.episode_ids ?? [],
  }));
}
