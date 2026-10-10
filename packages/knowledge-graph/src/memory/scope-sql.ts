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

  // Historical node-only writes have no edge that can identify their subjects.
  // In a dataset containing such incomplete provenance, an incident scan or a
  // later shared edge cannot attest the mutable metadata of either endpoint.
  const incompleteProvenance = `EXISTS (
    SELECT 1 FROM kg_episodes unknown_ep
    WHERE unknown_ep.content_ref->>'schema' = '${MEMORY_SCHEMA}'
      AND (
        coalesce(unknown_ep.content_ref->>'keyScopeVersion', '') <> '1'
        OR coalesce(unknown_ep.content_ref->'ingestSnapshot'->>'version', '') <> '1'
        OR coalesce(jsonb_typeof(unknown_ep.content_ref->'ingestSnapshot'->'nodes'), '') <> 'array'
        OR coalesce(jsonb_typeof(unknown_ep.content_ref->'ingestSnapshot'->'edges'), '') <> 'array'
      )
  )`;

  const authoredNodes = (node: string): string => `
    SELECT proof_node.payload
    FROM kg_episodes proof_ep
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(proof_ep.content_ref->'ingestSnapshot'->'nodes') = 'array'
        THEN proof_ep.content_ref->'ingestSnapshot'->'nodes' ELSE '[]'::jsonb END
    ) AS proof_node(payload)
    WHERE (${memoryVisible('proof_ep')})
      AND proof_ep.content_ref->'ingestSnapshot'->>'version' = '1'
      AND proof_node.payload->>'id' = ${node}.id
      AND proof_node.payload->>'kind' = ${node}.kind
      AND proof_node.payload->>'natural_key' = ${node}.natural_key`;

  const metadataAttested = (node: string): string => {
    const fields = ['name', 'repo', 'summary', 'search_text'];
    const scalars = fields.map(
      (field) => `EXISTS (
        SELECT 1 FROM (${authoredNodes(node)}) authored
        WHERE authored.payload->'${field}' = coalesce(to_jsonb(${node}.${field}), 'null'::jsonb)
      )`,
    );
    for (const field of ['first_seen_at', 'last_confirmed_at', 'deleted_at']) {
      scalars.push(`EXISTS (
        SELECT 1 FROM (${authoredNodes(node)}) authored
        WHERE (authored.payload->>'${field}')::timestamptz IS NOT DISTINCT FROM ${node}.${field}
      )`);
    }
    return `(${scalars.join(' AND ')} AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(${node}.attributes) current_attr
      WHERE NOT EXISTS (
        SELECT 1 FROM (${authoredNodes(node)}) authored
        WHERE authored.payload->'attributes'->current_attr.key = current_attr.value
      )
    ))`;
  };

  const safeMetadata = (node: string): string => `
    NOT ${legacyNode(`${node}.id`)}
    AND (NOT ${incompleteProvenance} OR ${metadataAttested(node)})`;

  const edgeVisible = (edgeAlias: string): string => `
    EXISTS (
      SELECT 1 FROM kg_edge_episodes vis_ee
      JOIN kg_episodes vis_ep ON vis_ep.id = vis_ee.episode_id
      WHERE vis_ee.edge_id = ${edgeAlias}.id
        AND (${episodeOk('vis_ep')})
        AND (
          (coalesce(vis_ep.content_ref->>'schema', '') IS DISTINCT FROM '${MEMORY_SCHEMA}'
            AND NOT ${incompleteProvenance})
          OR (
            vis_ep.content_ref->'ingestSnapshot'->>'version' = '1'
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(vis_ep.content_ref->'ingestSnapshot'->'edges') = 'array'
                  THEN vis_ep.content_ref->'ingestSnapshot'->'edges' ELSE '[]'::jsonb END
              ) authored_edge(payload)
              WHERE authored_edge.payload->>'id' = ${edgeAlias}.id
                AND authored_edge.payload->>'source_id' = ${edgeAlias}.source_id
                AND authored_edge.payload->>'target_id' = ${edgeAlias}.target_id
                AND authored_edge.payload->>'relation' = ${edgeAlias}.relation
                AND authored_edge.payload->>'fact' = ${edgeAlias}.fact
                AND authored_edge.payload->'repo' = coalesce(to_jsonb(${edgeAlias}.repo), 'null'::jsonb)
                AND authored_edge.payload->'attributes' = ${edgeAlias}.attributes
                AND (authored_edge.payload->>'valid_at')::timestamptz = ${edgeAlias}.valid_at
            )
          )
        )
    )
    AND EXISTS (SELECT 1 FROM kg_nodes source_node
      WHERE source_node.id = ${edgeAlias}.source_id AND (${safeMetadata('source_node')}))
    AND EXISTS (SELECT 1 FROM kg_nodes target_node
      WHERE target_node.id = ${edgeAlias}.target_id AND (${safeMetadata('target_node')}))`;

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
      ) AND (${safeMetadata(nodeAlias)})`,
  };
}
