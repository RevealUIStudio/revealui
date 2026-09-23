import { capsForPurpose } from './config.js';
import type { DiagramEdge, DiagramNode, DiagramPurpose, DiagramSnapshot } from './types.js';

const SEED_KIND_RANK: Readonly<Record<string, number>> = {
  repo: 0,
  app: 1,
  package: 2,
  workflow: 3,
  route: 4,
  'db-table': 5,
  agent: 6,
};

function kindRank(kind: string): number {
  return SEED_KIND_RANK[kind] ?? 50;
}

function sortNodes(nodes: readonly DiagramNode[]): DiagramNode[] {
  return [...nodes].sort((a, b) => {
    const rank = kindRank(a.kind) - kindRank(b.kind);
    if (rank !== 0) return rank;
    const name = a.name.localeCompare(b.name);
    if (name !== 0) return name;
    return a.id.localeCompare(b.id);
  });
}

function adjacency(edges: readonly DiagramEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (from: string, to: string): void => {
    const bucket = map.get(from) ?? new Set<string>();
    bucket.add(to);
    map.set(from, bucket);
  };
  for (const edge of edges) {
    add(edge.sourceId, edge.targetId);
    add(edge.targetId, edge.sourceId);
  }
  return map;
}

/**
 * Select a bounded subgraph for a diagram job.
 *
 * Consultation sketches cap depth and node count. Launch architecture uses
 * the larger licensed cap. When `selection` is set, BFS starts there;
 * otherwise high-level kinds (repo/app/package) seed the walk.
 */
export function selectDiagramSubgraph(
  nodes: readonly DiagramNode[],
  edges: readonly DiagramEdge[],
  options: {
    purpose: DiagramPurpose;
    selection?: readonly string[];
    maxNodes?: number;
    maxDepth?: number;
  },
): DiagramSnapshot {
  const caps = capsForPurpose(options.purpose);
  const maxNodes = options.maxNodes ?? caps.maxNodes;
  const maxDepth = options.maxDepth ?? caps.maxDepth;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const neighbors = adjacency(edges);

  const seeds: string[] = [];
  if (options.selection && options.selection.length > 0) {
    for (const id of options.selection) {
      if (byId.has(id)) seeds.push(id);
    }
  }
  if (seeds.length === 0) {
    for (const node of sortNodes(nodes)) {
      seeds.push(node.id);
      if (seeds.length >= maxNodes) break;
    }
  }

  const kept = new Map<string, DiagramNode>();
  const queue: Array<{ id: string; depth: number }> = seeds.map((id) => ({ id, depth: 0 }));
  const queued = new Set(seeds);

  while (queue.length > 0 && kept.size < maxNodes) {
    const current = queue.shift();
    if (!current) break;
    const node = byId.get(current.id);
    if (!node) continue;
    kept.set(node.id, node);
    if (current.depth >= maxDepth) continue;
    const nextIds = neighbors.get(current.id);
    if (!nextIds) continue;
    for (const nextId of nextIds) {
      if (queued.has(nextId) || !byId.has(nextId)) continue;
      queued.add(nextId);
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }

  const keptIds = new Set(kept.keys());
  const keptEdges = edges.filter(
    (edge) => keptIds.has(edge.sourceId) && keptIds.has(edge.targetId),
  );
  const truncated = nodes.length > kept.size || edges.length > keptEdges.length;

  return {
    nodes: sortNodes([...kept.values()]),
    edges: [...keptEdges].sort((a, b) => a.id.localeCompare(b.id)),
    truncated,
  };
}
