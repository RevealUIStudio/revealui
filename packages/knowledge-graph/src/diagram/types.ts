export const DIAGRAM_PURPOSES = ['consultation_sketch', 'launch_architecture'] as const;
export type DiagramPurpose = (typeof DIAGRAM_PURPOSES)[number];

export const DIAGRAM_VIEWS = ['2d', '3d'] as const;
export type DiagramView = (typeof DIAGRAM_VIEWS)[number];

export const DIAGRAM_THEMES = ['minimal', 'rev'] as const;
export type DiagramTheme = (typeof DIAGRAM_THEMES)[number];

export const DIAGRAM_FORMATS = ['mermaid', 'svg', 'png'] as const;
export type DiagramFormat = (typeof DIAGRAM_FORMATS)[number];

export interface DiagramNode {
  id: string;
  kind: string;
  name: string;
  naturalKey: string;
  repo: string | null;
  lastConfirmedAt?: string | null;
}

export interface DiagramEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  fact?: string;
  validAt?: string;
}

export interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  truncated: boolean;
}

export interface DiagramRenderResult {
  mermaid: string;
  svg: string;
  graphHash: string;
  graphVersion: string;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  purpose: DiagramPurpose;
  view: '2d';
  theme: DiagramTheme;
}

/** Safe honesty line — RevMind diagrams are not a public Architecture SKU. */
export const DIAGRAM_HONESTY =
  'architecture from your knowledge graph; not a public Architecture SKU' as const;
