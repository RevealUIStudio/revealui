import { afterEach, describe, expect, it } from 'vitest';
import {
  capsForPurpose,
  configureDiagramJob,
  DIAGRAM_HONESTY,
  hashDiagramSnapshot,
  paletteForTheme,
  renderDiagram,
  renderMermaid,
  resetDiagramJobConfig,
  selectDiagramSubgraph,
} from '../index.js';
import type { DiagramEdge, DiagramNode } from '../types.js';

afterEach(() => {
  resetDiagramJobConfig();
});

function node(
  partial: Partial<DiagramNode> & Pick<DiagramNode, 'id' | 'name' | 'kind'>,
): DiagramNode {
  return {
    naturalKey: `nk:${partial.id}`,
    repo: 'revealui',
    lastConfirmedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function edge(
  partial: Partial<DiagramEdge> & Pick<DiagramEdge, 'id' | 'sourceId' | 'targetId'>,
): DiagramEdge {
  return {
    relation: 'depends-on',
    validAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function chain(count: number): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes = Array.from({ length: count }, (_, i) =>
    node({ id: `n${i}`, name: `Node ${i}`, kind: i === 0 ? 'app' : 'file' }),
  );
  const edges = Array.from({ length: count - 1 }, (_, i) =>
    edge({ id: `e${i}`, sourceId: `n${i}`, targetId: `n${i + 1}` }),
  );
  return { nodes, edges };
}

describe('consultation cap', () => {
  it('caps consultation_sketch below the launch node budget', () => {
    const consult = capsForPurpose('consultation_sketch');
    const launch = capsForPurpose('launch_architecture');
    expect(consult.maxNodes).toBeLessThan(launch.maxNodes);
    expect(consult.maxDepth).toBeLessThan(launch.maxDepth);
    expect(consult.maxNodes).toBe(24);
  });

  it('truncates a consultation sketch at the node cap', () => {
    configureDiagramJob({ consultationMaxNodes: 5, consultationMaxDepth: 8 });
    const { nodes, edges } = chain(20);
    const snapshot = selectDiagramSubgraph(nodes, edges, { purpose: 'consultation_sketch' });
    expect(snapshot.nodes.length).toBe(5);
    expect(snapshot.truncated).toBe(true);
  });

  it('walks only maxDepth hops from a selection', () => {
    configureDiagramJob({ consultationMaxNodes: 50, consultationMaxDepth: 1 });
    const { nodes, edges } = chain(6);
    const snapshot = selectDiagramSubgraph(nodes, edges, {
      purpose: 'consultation_sketch',
      selection: ['n0'],
    });
    const ids = snapshot.nodes.map((n) => n.id);
    expect(ids).toContain('n0');
    expect(ids).toContain('n1');
    expect(ids).not.toContain('n3');
  });
});

describe('mermaid SoT + themes', () => {
  it('always emits a mermaid flowchart from the snapshot', () => {
    const nodes = [
      node({ id: 'app-1', name: 'admin', kind: 'app' }),
      node({ id: 'pkg-1', name: '@revealui/core', kind: 'package' }),
    ];
    const edges = [
      edge({ id: 'e1', sourceId: 'app-1', targetId: 'pkg-1', relation: 'depends-on' }),
    ];
    const mermaid = renderMermaid(nodes, edges);
    expect(mermaid.startsWith('flowchart TD')).toBe(true);
    expect(mermaid).toContain('admin (app)');
    expect(mermaid).toContain('depends-on');
  });

  it('keeps mermaid present on a themed render and colors rev vs minimal', () => {
    const nodes = [
      node({ id: 'app-1', name: 'admin', kind: 'app' }),
      node({ id: 'gap-1', name: 'GAP-1', kind: 'gap' }),
    ];
    const minimal = renderDiagram(nodes, [], {
      purpose: 'consultation_sketch',
      theme: 'minimal',
      truncated: false,
    });
    const rev = renderDiagram(nodes, [], {
      purpose: 'consultation_sketch',
      theme: 'rev',
      truncated: false,
    });
    expect(minimal.mermaid.startsWith('flowchart TD')).toBe(true);
    expect(rev.mermaid).toBe(minimal.mermaid);
    expect(minimal.svg).toContain('#ffffff');
    expect(rev.svg).toContain('#0b1f3a');
    expect(rev.svg).toContain('eeb300');
    expect(rev.svg).toContain('prefers-reduced-motion');
    expect(paletteForTheme('minimal').background).toBe('#ffffff');
    expect(paletteForTheme('rev').fillsByKind.gap).toBe('#eeb300');
  });

  it('changes graphHash when the snapshot changes', () => {
    const a = [node({ id: 'a', name: 'A', kind: 'app' })];
    const b = [node({ id: 'b', name: 'B', kind: 'app' })];
    expect(hashDiagramSnapshot(a, [])).not.toBe(hashDiagramSnapshot(b, []));
    expect(DIAGRAM_HONESTY).toContain('not a public Architecture SKU');
  });
});
