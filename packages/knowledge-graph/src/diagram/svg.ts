import { svgText } from './sanitize.js';
import type { DiagramNode, DiagramTheme } from './types.js';

export interface ThemePalette {
  background: string;
  edge: string;
  text: string;
  mutedText: string;
  nodeStroke: string;
  /** Fallback fill when a kind has no mapping. */
  nodeFill: string;
  fillsByKind: Readonly<Record<string, string>>;
}

/** Print/email-safe muted greys. */
export const MINIMAL_PALETTE: ThemePalette = {
  background: '#ffffff',
  edge: '#9a9a9a',
  text: '#2a2a2a',
  mutedText: '#6b6b6b',
  nodeStroke: '#6b6b6b',
  nodeFill: '#e8e8e8',
  fillsByKind: {
    repo: '#d9d9d9',
    app: '#d0d0d0',
    package: '#d4d4d4',
    file: '#e8e8e8',
    symbol: '#ececec',
    route: '#e0e0e0',
    'db-table': '#dedede',
    gap: '#cfcfcf',
    agent: '#d6d6d6',
    concept: '#e6e6e6',
  },
};

/**
 * Circuit-R navy / frost / amber. Color by node type — presentation only,
 * not a second architecture claim.
 */
export const REV_PALETTE: ThemePalette = {
  background: '#0b1f3a',
  edge: '#8aa0b8',
  text: '#f4f7fa',
  mutedText: '#d7e8f5',
  nodeStroke: '#d7e8f5',
  nodeFill: '#16325a',
  fillsByKind: {
    repo: '#0b1f3a',
    app: '#123056',
    package: '#16325a',
    file: '#2a4a6e',
    symbol: '#2f567c',
    route: '#1c3d64',
    'db-table': '#1a3558',
    workflow: '#c48a00',
    gap: '#eeb300',
    lane: '#d9a200',
    adr: '#c48a00',
    agent: '#3d6a8c',
    'mcp-tool': '#3d6a8c',
    skill: '#4a7a9c',
    rule: '#4a7a9c',
    hook: '#2a4a6e',
    dependency: '#1a3558',
    'secret-path': '#16325a',
    concept: '#2a4a6e',
  },
};

export function paletteForTheme(theme: DiagramTheme): ThemePalette {
  return theme === 'rev' ? REV_PALETTE : MINIMAL_PALETTE;
}

const SVG_WIDTH = 960;
const SVG_HEIGHT = 640;
const ROW_GAP = 110;
const COL_GAP = 160;
const NODE_RX = 14;
const NODE_WIDTH = 140;
const NODE_HEIGHT = 44;
const PAD_X = 48;
const PAD_Y = 56;

interface LaidOutNode {
  node: DiagramNode;
  x: number;
  y: number;
}

function layoutNodes(nodes: readonly DiagramNode[]): LaidOutNode[] {
  const byKind = new Map<string, DiagramNode[]>();
  for (const node of nodes) {
    const bucket = byKind.get(node.kind) ?? [];
    bucket.push(node);
    byKind.set(node.kind, bucket);
  }
  const kinds = [...byKind.keys()].sort();
  const laid: LaidOutNode[] = [];
  kinds.forEach((kind, row) => {
    const rowNodes = byKind.get(kind) ?? [];
    const rowWidth = Math.max(rowNodes.length - 1, 0) * COL_GAP;
    const startX = Math.max(PAD_X, (SVG_WIDTH - rowWidth) / 2);
    rowNodes.forEach((node, col) => {
      laid.push({
        node,
        x: startX + col * COL_GAP,
        y: PAD_Y + row * ROW_GAP,
      });
    });
  });
  return laid;
}

function fillFor(kind: string, palette: ThemePalette): string {
  return palette.fillsByKind[kind] ?? palette.nodeFill;
}

function revMotionCss(): string {
  return [
    '<style>',
    '@keyframes rev-edge-draw { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }',
    '@keyframes rev-node-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.82; } }',
    '.rev-edge { stroke-dasharray: 6 4; animation: rev-edge-draw 1.2s ease-out both; }',
    '.rev-node { animation: rev-node-pulse 2.4s ease-in-out infinite; }',
    '@media (prefers-reduced-motion: reduce) {',
    '  .rev-edge, .rev-node { animation: none; }',
    '}',
    '</style>',
  ].join('');
}

/**
 * Themed 2D SVG derived from the same snapshot as the Mermaid SoT.
 */
export function renderDiagramSvg(
  nodes: readonly DiagramNode[],
  edges: readonly { id: string; sourceId: string; targetId: string }[],
  theme: DiagramTheme,
): string {
  const palette = paletteForTheme(theme);
  const laid = layoutNodes(nodes);
  const pos = new Map(laid.map((item) => [item.node.id, item]));
  const height = Math.max(SVG_HEIGHT, PAD_Y * 2 + Math.max(laid.length > 0 ? 1 : 0, 1) * ROW_GAP);

  const edgeLines = edges
    .map((edge) => {
      const from = pos.get(edge.sourceId);
      const to = pos.get(edge.targetId);
      if (!(from && to)) return '';
      const cls = theme === 'rev' ? ' class="rev-edge"' : '';
      return `<line${cls} x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${palette.edge}" stroke-width="1.5" fill="none"/>`;
    })
    .filter((line) => line.length > 0);

  const nodeShapes = laid.map((item) => {
    const fill = fillFor(item.node.kind, palette);
    const cls = theme === 'rev' ? ' class="rev-node"' : '';
    const name = svgText(
      item.node.name.length > 18 ? `${item.node.name.slice(0, 16)}…` : item.node.name,
    );
    const kind = svgText(item.node.kind);
    const x = item.x - NODE_WIDTH / 2;
    const y = item.y - NODE_HEIGHT / 2;
    return [
      `<g${cls} data-node-id="${svgText(item.node.id)}" data-kind="${kind}">`,
      `<rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="${NODE_RX}" fill="${fill}" stroke="${palette.nodeStroke}" stroke-width="1.5"/>`,
      `<text x="${item.x}" y="${item.y - 2}" text-anchor="middle" fill="${palette.text}" font-size="12" font-family="Inter, system-ui, sans-serif">${name}</text>`,
      `<text x="${item.x}" y="${item.y + 14}" text-anchor="middle" fill="${palette.mutedText}" font-size="10" font-family="Inter, system-ui, sans-serif">${kind}</text>`,
      '</g>',
    ].join('');
  });

  const motion = theme === 'rev' ? revMotionCss() : '';

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${height}" width="${SVG_WIDTH}" height="${height}" role="img" aria-label="RevMind architecture from your knowledge graph">`,
    motion,
    `<rect width="100%" height="100%" fill="${palette.background}"/>`,
    ...edgeLines,
    ...nodeShapes,
    '</svg>',
  ].join('');
}
