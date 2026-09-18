/**
 * Load a current-graph snapshot for the RevMind diagram job.
 *
 * Rows are scoped by optional `repo` (required for licensed-operator callers
 * at the route). Soft-deleted nodes and invalid/expired edges are excluded.
 */

import type { Database } from '@revealui/db/client';
import { kgEdges, kgNodes } from '@revealui/db/schema';
import type { DiagramEdge, DiagramNode } from '@revealui/knowledge-graph/diagram';
import { getDiagramJobConfig } from '@revealui/knowledge-graph/diagram';
import { and, eq, isNull } from 'drizzle-orm';

export interface LoadKgDiagramRowsOptions {
  repo: string | null;
}

export async function loadKgDiagramRows(
  db: Database,
  options: LoadKgDiagramRowsOptions,
): Promise<{ nodes: DiagramNode[]; edges: DiagramEdge[] }> {
  const limit = getDiagramJobConfig().snapshotRowLimit;
  const nodeWhere =
    options.repo === null
      ? isNull(kgNodes.deletedAt)
      : and(isNull(kgNodes.deletedAt), eq(kgNodes.repo, options.repo));
  const edgeWhere =
    options.repo === null
      ? and(isNull(kgEdges.invalidAt), isNull(kgEdges.expiredAt))
      : and(isNull(kgEdges.invalidAt), isNull(kgEdges.expiredAt), eq(kgEdges.repo, options.repo));

  const nodeRows = await db
    .select({
      id: kgNodes.id,
      kind: kgNodes.kind,
      name: kgNodes.name,
      naturalKey: kgNodes.naturalKey,
      repo: kgNodes.repo,
      lastConfirmedAt: kgNodes.lastConfirmedAt,
    })
    .from(kgNodes)
    .where(nodeWhere)
    .limit(limit);

  const edgeRows = await db
    .select({
      id: kgEdges.id,
      sourceId: kgEdges.sourceId,
      targetId: kgEdges.targetId,
      relation: kgEdges.relation,
      fact: kgEdges.fact,
      validAt: kgEdges.validAt,
    })
    .from(kgEdges)
    .where(edgeWhere)
    .limit(limit);

  const nodes: DiagramNode[] = nodeRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    naturalKey: row.naturalKey,
    repo: row.repo,
    lastConfirmedAt: row.lastConfirmedAt ? row.lastConfirmedAt.toISOString() : null,
  }));

  const edges: DiagramEdge[] = edgeRows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
    relation: row.relation,
    fact: row.fact,
    validAt: row.validAt.toISOString(),
  }));

  return { nodes, edges };
}
