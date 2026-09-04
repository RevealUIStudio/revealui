import type { KgExecutor } from '../types.js';
import { bindVisibility, SqlParams } from './scope-sql.js';
import type { MemoryPrincipal } from './types.js';

export type NodeVisibilityKind = 'missing' | 'full' | 'shell';

interface NodeVisibilityRow {
  kind: string;
  natural_key: string;
  has_visible_memory: boolean | null;
  has_non_memory: boolean | null;
}

/**
 * Defense-in-depth for kg_get_node. Hosted non-operators never see a
 * code-scan-only shell; mixed provenance returns name + naturalKey only.
 */
export async function inspectNodeVisibility(
  exec: KgExecutor,
  nodeId: string,
  principal: MemoryPrincipal | undefined,
): Promise<NodeVisibilityKind> {
  if (principal?.trustBoundary !== 'hosted') return 'full';

  const params = new SqlParams();
  const vis = bindVisibility(principal, params);
  if (!vis) return 'full';
  const idParam = params.add(nodeId);

  const rows = await exec.query<NodeVisibilityRow>(
    `SELECT n.kind, n.natural_key,
            bool_or(${vis.memoryEpisodeVisible('ep')}) AS has_visible_memory,
            bool_or(
              ep.id IS NOT NULL
              AND coalesce(ep.content_ref->>'schema', '') IS DISTINCT FROM 'revealui.memory.v1'
            ) AS has_non_memory
     FROM kg_nodes n
     LEFT JOIN kg_edges e ON e.source_id = n.id OR e.target_id = n.id
     LEFT JOIN kg_edge_episodes ee ON ee.edge_id = e.id
     LEFT JOIN kg_episodes ep ON ep.id = ee.episode_id
     WHERE n.id = ${idParam}
     GROUP BY n.id, n.kind, n.natural_key`,
    params.values,
  );
  const row = rows[0];
  if (!row) return 'missing';
  if (row.kind === 'agent' && row.natural_key === principal.did) return 'full';
  const memory = Boolean(row.has_visible_memory);
  const nonMemory = Boolean(row.has_non_memory);
  if (memory && nonMemory && !principal.isFleetOperator) return 'shell';
  if (memory) return 'full';
  if (principal.isFleetOperator && nonMemory) return 'full';
  return 'missing';
}

/**
 * Memory-schema fact hits that match the query text but fail the scope
 * predicate. Counted in SQL, independent of the in-scope LIMIT page.
 */
export async function countDeniedMemoryHits(
  exec: KgExecutor,
  query: string,
  principal: MemoryPrincipal | undefined,
): Promise<number> {
  if (principal?.trustBoundary !== 'hosted') return 0;

  const params = new SqlParams();
  const vis = bindVisibility(principal, params);
  if (!vis) return 0;
  const q = params.add(query);

  const rows = await exec.query<{ n: number }>(
    `SELECT count(*)::int AS n
     FROM kg_edges e
     WHERE e.search @@ websearch_to_tsquery('english', ${q})
       AND EXISTS (
         SELECT 1 FROM kg_edge_episodes ee
         JOIN kg_episodes ep ON ep.id = ee.episode_id
         WHERE ee.edge_id = e.id
           AND ep.content_ref->>'schema' = 'revealui.memory.v1'
       )
       AND NOT EXISTS (
         SELECT 1 FROM kg_edge_episodes ee
         JOIN kg_episodes ep ON ep.id = ee.episode_id
         WHERE ee.edge_id = e.id
           AND (${vis.memoryEpisodeVisible('ep')})
       )`,
    params.values,
  );
  return Number(rows[0]?.n ?? 0);
}
