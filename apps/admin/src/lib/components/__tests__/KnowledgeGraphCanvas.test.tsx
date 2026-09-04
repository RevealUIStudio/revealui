// @vitest-environment jsdom

import type { KgEdgeRecord, KgNodeRecord } from '@revealui/sync';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeGraphCanvas } from '../KnowledgeGraphCanvas';
import { MAX_CANVAS_NODES } from '../knowledge-graph/layout-positions';

afterEach(() => {
  cleanup();
});

function node(partial: Partial<KgNodeRecord> & Pick<KgNodeRecord, 'id' | 'name'>): KgNodeRecord {
  return {
    kind: 'file',
    natural_key: `nk:${partial.id}`,
    repo: 'revealui',
    summary: null,
    attributes: {},
    attributes_clock: {},
    embedding: null,
    first_seen_at: '2026-01-01T00:00:00.000Z',
    last_confirmed_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function edge(partial: Partial<KgEdgeRecord> & Pick<KgEdgeRecord, 'id'>): KgEdgeRecord {
  return {
    source_id: 'n1',
    target_id: 'n2',
    relation: 'depends-on',
    fact: 'n1 depends on n2',
    repo: 'revealui',
    attributes: {},
    embedding: null,
    valid_at: '2026-01-01T00:00:00.000Z',
    invalid_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    expired_at: null,
    ...partial,
  };
}

const twoNodes = [node({ id: 'n1', name: 'alpha.ts' }), node({ id: 'n2', name: 'beta.ts' })];

describe('KnowledgeGraphCanvas', () => {
  it('draws nodes from Electric records and uses overlay layout positions', () => {
    const layout = new Map([
      ['n1', { x: 120, y: 80 }],
      ['n2', { x: 400, y: 200 }],
    ]);
    render(
      <KnowledgeGraphCanvas
        nodes={twoNodes}
        edges={[edge({ id: 'e1' })]}
        selectedNodeId="n1"
        onSelectNode={vi.fn()}
        layout={layout}
        pins={new Set()}
        onSetLayout={vi.fn()}
        at={null}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByRole('img', { name: /knowledge graph with 2 nodes/i })).toBeInTheDocument();
    const alpha = screen.getByRole('button', { name: 'file alpha.ts' });
    expect(alpha.closest('g')?.getAttribute('transform')).toBe('translate(120 80)');
    expect(alpha.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-edge-id="e1"]')).not.toBeNull();
  });

  it('does not draw edges that are invalid at the point-in-time filter', () => {
    render(
      <KnowledgeGraphCanvas
        nodes={twoNodes}
        edges={[
          edge({
            id: 'old',
            valid_at: '2026-01-01T00:00:00.000Z',
            invalid_at: '2026-03-01T00:00:00.000Z',
          }),
        ]}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        layout={new Map()}
        pins={new Set()}
        onSetLayout={vi.fn()}
        at={new Date('2026-06-01T00:00:00.000Z')}
        isLoading={false}
        error={null}
      />,
    );
    expect(document.querySelector('[data-edge-id="old"]')).toBeNull();
  });

  it('selects a node on click and persists layout after a drag', () => {
    const onSelectNode = vi.fn();
    const onSetLayout = vi.fn();
    render(
      <KnowledgeGraphCanvas
        nodes={twoNodes}
        edges={[]}
        selectedNodeId={null}
        onSelectNode={onSelectNode}
        layout={new Map([['n1', { x: 120, y: 80 }]])}
        pins={new Set()}
        onSetLayout={onSetLayout}
        at={null}
        isLoading={false}
        error={null}
      />,
    );

    const alpha = screen.getByRole('button', { name: 'file alpha.ts' });
    fireEvent.pointerDown(alpha, { clientX: 120, clientY: 80, pointerId: 1 });
    expect(onSelectNode).toHaveBeenCalledWith('n1');
    fireEvent.pointerMove(alpha, { clientX: 180, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(alpha, { clientX: 180, clientY: 90, pointerId: 1 });
    expect(onSetLayout).toHaveBeenCalledWith('n1', 180, 90);
  });

  it('shows the Electric error instead of inventing nodes', () => {
    render(
      <KnowledgeGraphCanvas
        nodes={[]}
        edges={[]}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        layout={new Map()}
        pins={new Set()}
        onSetLayout={vi.fn()}
        at={null}
        isLoading={false}
        error={new Error('Electric unavailable')}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Electric unavailable');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows a loading status with visible text', () => {
    render(
      <KnowledgeGraphCanvas
        nodes={[]}
        edges={[]}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        layout={new Map()}
        pins={new Set()}
        onSetLayout={vi.fn()}
        at={null}
        isLoading={true}
        error={null}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading the graph.');
  });

  it('captions when the node set is truncated', () => {
    const nodes = Array.from({ length: MAX_CANVAS_NODES + 3 }, (_, i) =>
      node({ id: `n${i}`, name: `file-${i}.ts` }),
    );
    render(
      <KnowledgeGraphCanvas
        nodes={nodes}
        edges={[]}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        layout={new Map()}
        pins={new Set()}
        onSetLayout={vi.fn()}
        at={null}
        isLoading={false}
        error={null}
      />,
    );
    expect(
      screen.getByText(/Showing 200 of 203 nodes. Narrow the filter to see the rest/i),
    ).toBeInTheDocument();
  });
});
