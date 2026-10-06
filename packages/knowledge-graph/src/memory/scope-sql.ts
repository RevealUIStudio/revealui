/**
 * SQL-before-LIMIT visibility fragments for product memory reads.
 * Authenticated principals are restricted in SQL across hosted and studio-local
 * transports. Transport locality does not bypass memory scope.
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
 * (absent).
 */
export function bindVisibility(
  principal: MemoryPrincipal | undefined,
  params: SqlParams,
): BoundVisibility | null {
  if (!principal) return null;

  const tenant = params.add(principal.tenantId);
  const did = params.add(principal.did);
  const workspace = params.add(principal.workspaceId ?? null);
  const operator = principal.isFleetOperator;

  const memoryVisible = (ep: string): string => `
    ${ep}.content_ref->>'schema' = '${MEMORY_SCHEMA}'
    AND ${ep}.content_ref->>'keyScopeVersion' = '1'
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

  // Earlier writes could merge private/workspace metadata into one node.
  // Quarantine their connected nodes until the graph owner reconstructs
  // scoped provenance; an unscoped historical row cannot authorize a read.
  const legacyNode = (id: string): string => `EXISTS (
    SELECT 1 FROM kg_edges legacy_e
    JOIN kg_edge_episodes legacy_ee ON legacy_ee.edge_id = legacy_e.id
    JOIN kg_episodes legacy_ep ON legacy_ep.id = legacy_ee.episode_id
    WHERE (legacy_e.source_id = ${id} OR legacy_e.target_id = ${id})
      AND legacy_ep.content_ref->>'schema' = '${MEMORY_SCHEMA}'
      AND coalesce(legacy_ep.content_ref->>'keyScopeVersion', '') IS DISTINCT FROM '1'
  )`;

  const edgeVisible = (edgeAlias: string): string => `
    EXISTS (
      SELECT 1 FROM kg_edge_episodes vis_ee
      JOIN kg_episodes vis_ep ON vis_ep.id = vis_ee.episode_id
      WHERE vis_ee.edge_id = ${edgeAlias}.id
        AND (${episodeOk('vis_ep')})
    )
    AND NOT ${legacyNode(`${edgeAlias}.source_id`)}
    AND NOT ${legacyNode(`${edgeAlias}.target_id`)}`;

  const incidentToVisible = (nodeAlias: string): string => `
    EXISTS (
      SELECT 1 FROM kg_edges vis_n_e
      WHERE (vis_n_e.source_id = ${nodeAlias}.id OR vis_n_e.target_id = ${nodeAlias}.id)
        AND ${edgeVisible('vis_n_e')}
    )`;

  return {
    edgeVisible,
    memoryEpisodeVisible: memoryVisible,
    nodeVisible: (nodeAlias: string): string => `
      (
        (${nodeAlias}.kind = 'agent' AND ${nodeAlias}.natural_key = ${did})
        OR ${incidentToVisible(nodeAlias)}
      ) AND NOT ${legacyNode(`${nodeAlias}.id`)}`,
  };
}
