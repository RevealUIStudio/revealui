/**
 * SQL-before-LIMIT visibility fragments for product memory reads.
 * Hosted principals are restricted in SQL; studio-local is unrestricted
 * (all episodes, single-operator).
 */

import { MEMORY_SCHEMA, type MemoryPrincipal } from './types.js';

export class SqlParams {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

export interface BoundVisibility {
  edgeVisible(edgeAlias: string): string;
  nodeVisible(nodeAlias: string): string;
  memoryEpisodeVisible(episodeAlias: string): string;
}

/**
 * Bind tenant/did/workspace placeholders onto `params` once, then reuse them
 * in EXISTS fragments. Returns null when the principal is unrestricted
 * (absent or studio-local).
 */
export function bindVisibility(
  principal: MemoryPrincipal | undefined,
  params: SqlParams,
): BoundVisibility | null {
  if (principal?.trustBoundary !== 'hosted') return null;

  const tenant = params.add(principal.tenantId);
  const did = params.add(principal.did);
  const workspace = params.add(principal.workspaceId ?? null);
  const operator = principal.isFleetOperator;

  const memoryVisible = (ep: string): string => `
    ${ep}.content_ref->>'schema' = '${MEMORY_SCHEMA}'
    AND ${ep}.content_ref->'scope'->>'tenantId' = ${tenant}
    AND (
      (
        ${ep}.content_ref->'scope'->>'classification' = 'workspace'
        AND (
          ${ep}.content_ref->'scope'->>'workspaceId' IS NULL
          OR (
            ${workspace}::text IS NOT NULL
            AND ${ep}.content_ref->'scope'->>'workspaceId' = ${workspace}
          )
        )
      )
      OR (
        ${ep}.content_ref->'scope'->>'classification' = 'private'
        AND ${ep}.content_ref->>'actorDid' = ${did}
      )
    )`;

  const episodeOk = (ep: string): string =>
    operator
      ? `(${memoryVisible(ep)} OR coalesce(${ep}.content_ref->>'schema', '') IS DISTINCT FROM '${MEMORY_SCHEMA}')`
      : memoryVisible(ep);

  const edgeVisible = (edgeAlias: string): string => `
    EXISTS (
      SELECT 1 FROM kg_edge_episodes vis_ee
      JOIN kg_episodes vis_ep ON vis_ep.id = vis_ee.episode_id
      WHERE vis_ee.edge_id = ${edgeAlias}.id
        AND (${episodeOk('vis_ep')})
    )`;

  const incidentToVisible = (nodeAlias: string): string => `
    EXISTS (
      SELECT 1 FROM kg_edges vis_n_e
      WHERE (vis_n_e.source_id = ${nodeAlias}.id OR vis_n_e.target_id = ${nodeAlias}.id)
        AND ${edgeVisible('vis_n_e')}
    )`;

  const isolatedNode = (nodeAlias: string): string => `
    NOT EXISTS (
      SELECT 1 FROM kg_edges isol_e
      WHERE isol_e.source_id = ${nodeAlias}.id OR isol_e.target_id = ${nodeAlias}.id
    )`;

  return {
    edgeVisible,
    memoryEpisodeVisible: memoryVisible,
    nodeVisible: (nodeAlias: string): string =>
      operator
        ? `
      (
        (${nodeAlias}.kind = 'agent' AND ${nodeAlias}.natural_key = ${did})
        OR ${incidentToVisible(nodeAlias)}
        OR ${isolatedNode(nodeAlias)}
      )`
        : `
      (
        (${nodeAlias}.kind = 'agent' AND ${nodeAlias}.natural_key = ${did})
        OR ${incidentToVisible(nodeAlias)}
      )`,
  };
}
