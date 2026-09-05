/**
 * Budgeted context assembly for kg_context (product and compat).
 * Lives in the MIT package so the RevDev bridge does not import @revealui/mcp.
 */

import type { MemoryPrincipal } from '../memory/types.js';
import type { KgExecutor } from '../types.js';
import { kgNeighbors } from './index.js';

interface ContextNode {
  id: string;
  kind: string;
  name: string;
  naturalKey: string;
  summary: string | null;
  distance: number;
}

interface ContextFact {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  fact: string;
  mentions: number;
  episodeIds: string[];
}

export interface AssembledContext {
  context: string;
  anchor: { id: string; naturalKey: string };
  nodeCount: number;
  factCount: number;
  charBudget: number;
  charsUsed: number;
  truncated: boolean;
}

export interface AssembleContextOptions {
  charBudget: number;
  depth: number;
  at?: Date;
  principal?: MemoryPrincipal;
}

export async function assembleContext(
  exec: KgExecutor,
  anchorId: string,
  opts: AssembleContextOptions,
): Promise<AssembledContext> {
  const neighbors = await kgNeighbors(exec, anchorId, {
    depth: opts.depth,
    at: opts.at,
    principal: opts.principal,
  });

  const nodeIds = neighbors.nodes.map((n): string => n.id);
  const summaryRows = nodeIds.length
    ? await exec.query<{ id: string; summary: string | null }>(
        `SELECT id, summary FROM kg_nodes WHERE id = ANY($1::text[])`,
        [nodeIds],
      )
    : [];
  const summaryById = new Map<string, string | null>(summaryRows.map((r) => [r.id, r.summary]));

  const rankedNodes: ContextNode[] = neighbors.nodes
    .map(
      (n): ContextNode => ({
        id: n.id,
        kind: n.kind,
        name: n.name,
        naturalKey: n.naturalKey,
        summary: summaryById.get(n.id) ?? null,
        distance: n.distance,
      }),
    )
    .sort((a, b) =>
      a.distance - b.distance !== 0
        ? a.distance - b.distance
        : a.naturalKey < b.naturalKey
          ? -1
          : 1,
    );
  const distanceById = new Map<string, number>(rankedNodes.map((n) => [n.id, n.distance]));

  const edgeIds = neighbors.edges.map((e): string => e.id);
  const mentionRows = edgeIds.length
    ? await exec.query<{ id: string; mentions: number; episode_ids: string[] | null }>(
        `SELECT e.id, count(ee.episode_id)::int AS mentions,
                coalesce(array_agg(ee.episode_id) FILTER (WHERE ee.episode_id IS NOT NULL), '{}') AS episode_ids
         FROM kg_edges e
         LEFT JOIN kg_edge_episodes ee ON ee.edge_id = e.id
         WHERE e.id = ANY($1::text[])
         GROUP BY e.id`,
        [edgeIds],
      )
    : [];
  const mentionById = new Map<string, { mentions: number; episodeIds: string[] }>(
    mentionRows.map((r) => [
      r.id,
      { mentions: Number(r.mentions), episodeIds: r.episode_ids ?? [] },
    ]),
  );

  interface RankedFactCandidate extends ContextFact {
    rankDistance: number;
  }

  const rankedFacts: ContextFact[] = neighbors.edges
    .map((e): RankedFactCandidate => {
      const m = mentionById.get(e.id) ?? { mentions: 0, episodeIds: [] };
      const nearDistance = Math.min(
        distanceById.get(e.sourceId) ?? Number.POSITIVE_INFINITY,
        distanceById.get(e.targetId) ?? Number.POSITIVE_INFINITY,
      );
      return {
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        relation: e.relation,
        fact: e.fact,
        mentions: m.mentions,
        episodeIds: m.episodeIds,
        rankDistance: nearDistance,
      };
    })
    .sort((a, b) => {
      if (b.mentions - a.mentions !== 0) return b.mentions - a.mentions;
      if (a.rankDistance - b.rankDistance !== 0) return a.rankDistance - b.rankDistance;
      return a.id < b.id ? -1 : 1;
    })
    .map(({ rankDistance: _rankDistance, ...fact }): ContextFact => fact);

  const lines: string[] = [`# Context for ${anchorId} (depth=${opts.depth})`, '', '## Nodes'];
  for (const n of rankedNodes) {
    const summaryPart = n.summary ? ` — ${n.summary}` : '';
    lines.push(`- [${n.kind}] ${n.naturalKey} (${n.distance} hop)${summaryPart}`);
  }
  lines.push('', '## Facts');
  for (const f of rankedFacts) {
    const provenance = f.episodeIds.length > 0 ? f.episodeIds.join(', ') : 'none';
    lines.push(`- (${f.relation}) ${f.fact} [episodes: ${provenance}]`);
  }

  let charsUsed = 0;
  let truncated = false;
  const packed: string[] = [];
  for (const line of lines) {
    const addedLength = line.length + 1;
    if (charsUsed + addedLength > opts.charBudget) {
      truncated = true;
      break;
    }
    packed.push(line);
    charsUsed += addedLength;
  }

  return {
    context: packed.join('\n'),
    anchor: {
      id: anchorId,
      naturalKey: rankedNodes.find((n) => n.id === anchorId)?.naturalKey ?? anchorId,
    },
    nodeCount: rankedNodes.length,
    factCount: rankedFacts.length,
    charBudget: opts.charBudget,
    charsUsed,
    truncated,
  };
}
