import { mermaidLabel, mermaidNodeId } from './sanitize.js';
import type { DiagramEdge, DiagramNode } from './types.js';

/**
 * Mermaid flowchart SoT. Theme-agnostic structure — SVG/PNG apply theme.
 */
export function renderMermaid(
  nodes: readonly DiagramNode[],
  edges: readonly DiagramEdge[],
): string {
  const lines = ['flowchart TD'];
  if (nodes.length === 0) {
    lines.push('  empty["No nodes in snapshot"]');
    return `${lines.join('\n')}\n`;
  }

  const idByNode = new Map<string, string>();
  nodes.forEach((node, index) => {
    const mid = mermaidNodeId(index);
    idByNode.set(node.id, mid);
    const label = mermaidLabel(`${node.name} (${node.kind})`);
    lines.push(`  ${mid}["${label}"]`);
  });

  for (const edge of edges) {
    const from = idByNode.get(edge.sourceId);
    const to = idByNode.get(edge.targetId);
    if (!(from && to)) continue;
    const rel = mermaidLabel(edge.relation);
    lines.push(`  ${from} -->|"${rel}"| ${to}`);
  }

  return `${lines.join('\n')}\n`;
}
