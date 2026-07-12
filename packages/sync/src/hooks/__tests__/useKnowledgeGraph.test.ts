import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useKgEdgeEpisodes,
  useKgEdges,
  useKgNodes,
  useKnowledgeGraph,
} from '../useKnowledgeGraph.js';

vi.mock('@electric-sql/react', () => ({
  useShape: vi.fn(),
}));

import { useShape } from '@electric-sql/react';

const mockUseShape = useShape as ReturnType<typeof vi.fn>;

describe('useKgNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array when there is no data', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useKgNodes());

    expect(result.current.nodes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls useShape with no repo param when repo is omitted', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useKgNodes());

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/kg-nodes',
      params: {},
      fetchClient: expect.any(Function),
    });
  });

  it('calls useShape with the repo param when supplied', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useKgNodes('revealui'));

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/kg-nodes',
      params: { repo: 'revealui' },
      fetchClient: expect.any(Function),
    });
  });

  it('propagates loading and error state', () => {
    const mockError = new Error('shape error');
    mockUseShape.mockReturnValue({ data: null, isLoading: true, error: mockError });

    const { result } = renderHook(() => useKgNodes('revealui'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(mockError);
  });

  it('exposes no mutation functions (Electric sync is read-only for the graph)', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useKgNodes());

    expect(result.current).not.toHaveProperty('create');
    expect(result.current).not.toHaveProperty('update');
    expect(result.current).not.toHaveProperty('remove');
  });
});

describe('useKgEdges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transforms shape data into edge records', () => {
    const mockData = [
      { id: 'e1', source_id: 'n1', target_id: 'n2', relation: 'contains', fact: 'a contains b' },
    ];
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() => useKgEdges('revdev'));

    expect(result.current.edges).toEqual(mockData);
    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/kg-edges',
      params: { repo: 'revdev' },
      fetchClient: expect.any(Function),
    });
  });
});

describe('useKgEdgeEpisodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls useShape with no params (not repo-partitioned)', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useKgEdgeEpisodes());

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/kg-edge-episodes',
      fetchClient: expect.any(Function),
    });
  });
});

describe('useKnowledgeGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('composes nodes, edges, and edge-episodes with combined loading/error state', () => {
    mockUseShape
      .mockReturnValueOnce({ data: [{ id: 'n1' }], isLoading: false, error: null }) // nodes
      .mockReturnValueOnce({ data: [{ id: 'e1' }], isLoading: true, error: null }) // edges
      .mockReturnValueOnce({
        data: [{ edge_id: 'e1', episode_id: 'ep1' }],
        isLoading: false,
        error: null,
      }); // edge-episodes

    const { result } = renderHook(() => useKnowledgeGraph('revealui'));

    expect(result.current.nodes).toEqual([{ id: 'n1' }]);
    expect(result.current.edges).toEqual([{ id: 'e1' }]);
    expect(result.current.edgeEpisodes).toEqual([{ edge_id: 'e1', episode_id: 'ep1' }]);
    // edges hook was loading -> composite reflects it
    expect(result.current.isLoading).toBe(true);
  });
});
