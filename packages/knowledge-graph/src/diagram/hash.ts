import { createHash } from 'node:crypto';
import type { DiagramEdge, DiagramNode } from './types.js';

/**
 * Content hash of a diagram snapshot. Clients invalidate derived SVG/PNG
 * when this changes (graph wins over slide edits).
 */
export function hashDiagramSnapshot(
  nodes: readonly DiagramNode[],
  edges: readonly DiagramEdge[],
): string {
  const nodeKey = [...nodes]
    .map((node) =>
      [node.id, node.kind, node.name, node.naturalKey, node.lastConfirmedAt ?? ''].join('\u001F'),
    )
    .sort()
    .join('\n');
  const edgeKey = [...edges]
    .map((edge) =>
      [edge.id, edge.sourceId, edge.targetId, edge.relation, edge.validAt ?? ''].join('\u001F'),
    )
    .sort()
    .join('\n');
  return createHash('sha256').update(`${nodeKey}\n${edgeKey}`, 'utf8').digest('hex');
}

/** Latest confirmation / valid-time in the snapshot, or epoch if empty. */
export function snapshotGraphVersion(
  nodes: readonly DiagramNode[],
  edges: readonly DiagramEdge[],
): string {
  let latest = '';
  for (const node of nodes) {
    const at = node.lastConfirmedAt ?? '';
    if (at > latest) latest = at;
  }
  for (const edge of edges) {
    const at = edge.validAt ?? '';
    if (at > latest) latest = at;
  }
  return latest.length > 0 ? latest : '1970-01-01T00:00:00.000Z';
}
