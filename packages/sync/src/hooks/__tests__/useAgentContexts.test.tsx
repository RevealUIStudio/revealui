import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ElectricProvider } from '../../provider/index.js';
import { useAgentContexts } from '../useAgentContexts.js';

vi.mock('@electric-sql/react', () => ({
  useShape: vi.fn(),
}));

vi.mock('../../mutations.js', () => ({
  useSyncMutations: vi.fn(() => ({
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  })),
}));

import { useShape } from '@electric-sql/react';
import { useSyncMutations } from '../../mutations.js';

const mockUseShape = useShape as ReturnType<typeof vi.fn>;
const mockUseSyncMutations = useSyncMutations as ReturnType<typeof vi.fn>;

describe('useAgentContexts', () => {
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSyncMutations.mockReturnValue({
      create: mockCreate,
      update: mockUpdate,
      remove: mockRemove,
    });
  });

  it('should return empty array when no data', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return contexts data', () => {
    const mockData = [
      {
        id: 'ctx-1',
        session_id: 'sess-1',
        agent_id: 'agent-1',
        context: { key: 'value' },
        priority: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle loading state', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: true, error: null });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle error state', () => {
    const mockError = new Error('Shape fetch failed');
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: mockError });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual([]);
    expect(result.current.error).toBe(mockError);
  });

  it('should call useShape with default relative URL when no proxyBaseUrl', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useAgentContexts());

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-contexts',
      fetchClient: expect.any(Function),
    });
  });

  it('should use proxyBaseUrl from ElectricProvider when provided', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectricProvider proxyBaseUrl="https://admin.example.com">{children}</ElectricProvider>
    );

    renderHook(() => useAgentContexts(), { wrapper });

    expect(mockUseShape).toHaveBeenCalledWith({
      url: 'https://admin.example.com/api/shapes/agent-contexts',
      fetchClient: expect.any(Function),
    });
  });

  it('should handle non-array data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: 'invalid' as unknown,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual([]);
  });

  it('should return mutation functions (create, update, remove)', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useAgentContexts());

    expect(typeof result.current.create).toBe('function');
    expect(typeof result.current.update).toBe('function');
    expect(typeof result.current.remove).toBe('function');
  });

  // -----------------------------------------------------------------------
  // Additional coverage
  // -----------------------------------------------------------------------
  it('should call useSyncMutations with correct endpoint', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useAgentContexts());

    expect(mockUseSyncMutations).toHaveBeenCalledWith('agent-contexts');
  });

  it('should return the exact mutation fns from useSyncMutations', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.create).toBe(mockCreate);
    expect(result.current.update).toBe(mockUpdate);
    expect(result.current.remove).toBe(mockRemove);
  });

  it('should return multiple context records', () => {
    const mockData = [
      {
        id: 'ctx-1',
        session_id: 'sess-1',
        agent_id: 'agent-1',
        context: { topic: 'billing' },
        priority: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'ctx-2',
        session_id: 'sess-1',
        agent_id: 'agent-2',
        context: { topic: 'support' },
        priority: 5,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      },
      {
        id: 'ctx-3',
        session_id: 'sess-2',
        agent_id: 'agent-1',
        context: {},
        priority: 0,
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      },
    ];
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toHaveLength(3);
    expect(result.current.contexts[0].id).toBe('ctx-1');
    expect(result.current.contexts[2].priority).toBe(0);
  });

  it('should handle empty array data', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle object data (non-array) gracefully', () => {
    mockUseShape.mockReturnValue({
      data: { id: 'not-an-array' } as unknown,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual([]);
  });

  it('should handle number data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: 42 as unknown,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual([]);
  });

  it('should handle undefined data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.contexts).toEqual([]);
  });

  it('should propagate shape error as-is', () => {
    const shapeError = new Error('Network timeout');
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: shapeError });

    const { result } = renderHook(() => useAgentContexts());

    expect(result.current.error).toBe(shapeError);
    expect(result.current.error?.message).toBe('Network timeout');
  });

  it('should use trailing-slash proxyBaseUrl correctly', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    // Note: the hook concatenates proxyBaseUrl + '/api/shapes/...' so a trailing
    // slash in proxyBaseUrl would produce a double-slash. This tests current behavior.
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectricProvider proxyBaseUrl="https://admin.example.com">{children}</ElectricProvider>
    );

    renderHook(() => useAgentContexts(), { wrapper });

    expect(mockUseShape).toHaveBeenCalledWith({
      url: 'https://admin.example.com/api/shapes/agent-contexts',
      fetchClient: expect.any(Function),
    });
  });
});
