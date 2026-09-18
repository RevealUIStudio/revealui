import { hashDiagramSnapshot, snapshotGraphVersion } from './hash.js';
import { renderMermaid } from './mermaid.js';
import { renderDiagramSvg } from './svg.js';
import type {
  DiagramEdge,
  DiagramNode,
  DiagramPurpose,
  DiagramRenderResult,
  DiagramTheme,
} from './types.js';

export interface RenderDiagramOptions {
  purpose: DiagramPurpose;
  theme: DiagramTheme;
  truncated: boolean;
}

/** Mermaid is always SoT. SVG is the themed 2D derivation. */
export function renderDiagram(
  nodes: readonly DiagramNode[],
  edges: readonly DiagramEdge[],
  options: RenderDiagramOptions,
): DiagramRenderResult {
  const mermaid = renderMermaid(nodes, edges);
  const svg = renderDiagramSvg(nodes, edges, options.theme);
  return {
    mermaid,
    svg,
    graphHash: hashDiagramSnapshot(nodes, edges),
    graphVersion: snapshotGraphVersion(nodes, edges),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    truncated: options.truncated,
    purpose: options.purpose,
    view: '2d',
    theme: options.theme,
  };
}
