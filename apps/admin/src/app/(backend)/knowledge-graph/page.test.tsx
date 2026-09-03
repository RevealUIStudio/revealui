// @vitest-environment jsdom

import type { KgEdgeRecord, KgNodeRecord, UseKgViewDocumentResult } from '@revealui/sync';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/components/LicenseGate', () => ({
  LicenseGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@revealui/sync', () => ({
  ClientOnly: ({ children }: { children: React.ReactNode }) => children,
  useKnowledgeGraph: vi.fn(),
  useKgViewDocument: vi.fn(),
}));

import { useKgViewDocument, useKnowledgeGraph } from '@revealui/sync';
import KnowledgeGraphPage from './page';

const mockUseKnowledgeGraph = vi.mocked(useKnowledgeGraph);
const mockUseKgViewDocument = vi.mocked(useKgViewDocument);

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

function overlayStub(partial: Partial<UseKgViewDocumentResult> = {}): UseKgViewDocumentResult {
  return {
    documentId: 'kg-view-fleet',
    state: {
      annotations: new Map(),
      pins: new Set(),
      layout: new Map(),
      presence: new Map(),
    },
    connectedClients: 0,
    isLoading: false,
    error: null,
    annotate: vi.fn(),
    setPinned: vi.fn(),
    setLayout: vi.fn(),
    touchPresence: vi.fn(),
    ...partial,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ repos: ['revealui'] }) }),
    ),
  );
  mockUseKgViewDocument.mockReturnValue(overlayStub());
});

describe('KnowledgeGraphPage canvas', () => {
  it('keeps list/detail and adds a visual graph for Electric nodes', async () => {
    const nodes = [node({ id: 'n1', name: 'alpha.ts' }), node({ id: 'n2', name: 'beta.ts' })];
    const edges: KgEdgeRecord[] = [
      {
        id: 'e1',
        source_id: 'n1',
        target_id: 'n2',
        relation: 'depends-on',
        fact: 'alpha depends on beta',
        repo: 'revealui',
        attributes: {},
        embedding: null,
        valid_at: '2026-01-01T00:00:00.000Z',
        invalid_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        expired_at: null,
      },
    ];
    mockUseKnowledgeGraph.mockReturnValue({
      nodes,
      edges,
      edgeEpisodes: [],
      isLoading: false,
      error: null,
    });

    render(<KnowledgeGraphPage />);

    expect(await screen.findByRole('img', { name: /knowledge graph with 2 nodes/i })).toBeDefined();
    expect(screen.getByRole('button', { name: 'file alpha.ts' })).toBeInTheDocument();
    // Canvas label + list row both show the name — list/detail stayed.
    expect(screen.getAllByText('alpha.ts').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('No node selected')).toBeInTheDocument();
  });

  it('does not invent nodes when Electric errors', async () => {
    mockUseKnowledgeGraph.mockReturnValue({
      nodes: [],
      edges: [],
      edgeEpisodes: [],
      isLoading: false,
      error: new Error('shape failed'),
    });

    render(<KnowledgeGraphPage />);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toHaveTextContent('shape failed');
    expect(screen.queryByRole('img', { name: /knowledge graph/i })).toBeNull();
  });
});
