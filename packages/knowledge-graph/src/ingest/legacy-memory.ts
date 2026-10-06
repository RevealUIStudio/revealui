/** Read-only inventory for KG-LEGACY-MEMORY-SCOPE-MIGRATION.
 * Never infer authored metadata from merged nodes or neighboring outbox rows.
 * This report deliberately cannot authorize or execute reconstruction.
 */
import { deriveEdgeId, deriveEpisodeId, deriveNodeId } from '../ids.js';
import { MEMORY_SCHEMA } from '../memory/types.js';
import { parseKgOp } from '../replica/ops.js';
import type { EpisodeRow, KgExecutor } from '../types.js';

export interface LegacyMemoryFinding {
  episodeId: string;
  blocker:
    | 'missing-authoritative-snapshot'
    | 'invalid-authoritative-snapshot'
    | 'reconstruction-required';
  /** Counts only; authored payloads and scope identities are never printed. */
  snapshotNodes: number;
  snapshotEdges: number;
  connectedNodes: number;
}

export interface LegacyMemoryAudit {
  workId: 'KG-LEGACY-MEMORY-SCOPE-MIGRATION';
  readOnly: true;
  legacyEpisodes: number;
  findings: LegacyMemoryFinding[];
}

function snapshotCounts(
  row: EpisodeRow,
): Pick<LegacyMemoryFinding, 'blocker' | 'snapshotNodes' | 'snapshotEdges'> {
  const empty = { snapshotNodes: 0, snapshotEdges: 0 };
  const raw = row.content_ref.ingestSnapshot;
  if (raw === undefined) return { ...empty, blocker: 'missing-authoritative-snapshot' };
  try {
    const snapshot = raw as { version?: unknown; nodes?: unknown; edges?: unknown };
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges))
      throw new Error('unsupported snapshot');
    // Hash validation ties the snapshot to the immutable episode identifier.
    if (
      deriveEpisodeId({
        episodeType: row.episode_type,
        source: row.source,
        contentRef: row.content_ref,
        referenceTime: new Date(row.reference_time),
      }) !== row.id
    )
      throw new Error('snapshot does not match episode');
    const nodes = snapshot.nodes.map((value) => {
      const op = parseKgOp({ t: 'node', id: (value as { id?: unknown })?.id, row: value });
      if (op.t !== 'node' || deriveNodeId(op.row.kind, op.row.natural_key) !== op.id)
        throw new Error('invalid snapshot node');
      return op.id;
    });
    const nodeIds = new Set(nodes);
    if (nodeIds.size !== nodes.length) throw new Error('duplicate snapshot node');
    const edges = snapshot.edges.map((value) => {
      const op = parseKgOp({
        t: 'edge',
        id: (value as { id?: unknown })?.id,
        row: value,
        episodeIds: [row.id],
      });
      if (
        op.t !== 'edge' ||
        !nodeIds.has(op.row.source_id) ||
        !nodeIds.has(op.row.target_id) ||
        deriveEdgeId(
          op.row.source_id,
          op.row.target_id,
          op.row.relation,
          new Date(op.row.valid_at),
        ) !== op.id
      )
        throw new Error('incomplete snapshot edge');
      return op.id;
    });
    if (new Set(edges).size !== edges.length) throw new Error('duplicate snapshot edge');
    return {
      blocker: 'reconstruction-required',
      snapshotNodes: nodes.length,
      snapshotEdges: edges.length,
    };
  } catch {
    return { ...empty, blocker: 'invalid-authoritative-snapshot' };
  }
}

export async function auditLegacyMemory(exec: KgExecutor): Promise<LegacyMemoryAudit> {
  // One statement gives a consistent inventory without locks or mutation.
  // Connected-node counts describe quarantine impact, never metadata ownership.
  const rows = await exec.query<EpisodeRow & { connected_nodes: number | string }>(
    `SELECT ep.id, ep.episode_type, ep.source, ep.site_id, NULL::text AS content,
       ep.content_ref, ep.reference_time,
       (SELECT count(DISTINCT endpoint.id) FROM kg_edge_episodes ee
        JOIN kg_edges e ON e.id = ee.edge_id
        CROSS JOIN LATERAL (VALUES (e.source_id), (e.target_id)) endpoint(id)
        WHERE ee.episode_id = ep.id) AS connected_nodes
     FROM kg_episodes ep
     WHERE ep.content_ref->>'schema' = $1
       AND ep.content_ref->>'keyScopeVersion' IS DISTINCT FROM '1'
     ORDER BY ep.id`,
    [MEMORY_SCHEMA],
  );
  return {
    workId: 'KG-LEGACY-MEMORY-SCOPE-MIGRATION',
    readOnly: true,
    legacyEpisodes: rows.length,
    findings: rows.map((row) => ({
      episodeId: row.id,
      ...snapshotCounts(row),
      connectedNodes: Number(row.connected_nodes),
    })),
  };
}
