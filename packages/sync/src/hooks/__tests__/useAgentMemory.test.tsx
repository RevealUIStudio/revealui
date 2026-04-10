import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ElectricProvider } from '../../provider/index.js';
import { useAgentMemory } from '../useAgentMemory.js';

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

describe('useAgentMemory', () => {
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

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return memory data for valid agentId', () => {
    const mockData = [
      {
        id: 'mem-1',
        agent_id: 'agent-123',
        content: 'some memory',
        type: 'episodic',
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        expires_at: null,
      },
    ];
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should handle loading state', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: true, error: null });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle error state from shape', () => {
    const mockError = new Error('Shape fetch failed');
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: mockError });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toEqual([]);
    expect(result.current.error).toBe(mockError);
  });

  it('should call useShape with agentId param for valid id', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useAgentMemory('my-agent_01'));

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-memories',
      params: { agent_id: 'my-agent_01' },
      fetchClient: expect.any(Function),
    });
  });

  it('should return error immediately for empty agentId without calling shape with bad param', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory(''));

    expect(result.current.memories).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error?.message).toMatch(/Invalid agentId/);
    // Shape is still called (rules of hooks) but with UUID sentinel that matches no rows
    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-memories',
      params: { agent_id: '00000000-0000-0000-0000-000000000000' },
      fetchClient: expect.any(Function),
    });
  });

  it('should return error for agentId with special characters', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent/bad;id'));

    expect(result.current.error?.message).toMatch(/Invalid agentId/);
    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-memories',
      params: { agent_id: '00000000-0000-0000-0000-000000000000' },
      fetchClient: expect.any(Function),
    });
  });

  it('should use proxyBaseUrl from ElectricProvider when provided', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectricProvider proxyBaseUrl="https://admin.example.com">{children}</ElectricProvider>
    );

    renderHook(() => useAgentMemory('agent-123'), { wrapper });

    expect(mockUseShape).toHaveBeenCalledWith({
      url: 'https://admin.example.com/api/shapes/agent-memories',
      params: { agent_id: 'agent-123' },
      fetchClient: expect.any(Function),
    });
  });

  it('should handle non-array data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: 'invalid' as unknown,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toEqual([]);
  });

  it('should return mutation functions (create, update, remove)', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(typeof result.current.create).toBe('function');
    expect(typeof result.current.update).toBe('function');
    expect(typeof result.current.remove).toBe('function');
  });

  it('should return mutation functions even for invalid agentId', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory(''));

    expect(typeof result.current.create).toBe('function');
    expect(typeof result.current.update).toBe('function');
    expect(typeof result.current.remove).toBe('function');
  });

  // -----------------------------------------------------------------------
  // Additional coverage: agentId validation edge cases
  // -----------------------------------------------------------------------
  it('should accept purely numeric agentId', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('12345'));

    expect(result.current.error).toBeNull();
    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-memories',
      params: { agent_id: '12345' },
      fetchClient: expect.any(Function),
    });
  });

  it('should accept agentId with underscores and hyphens', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('my_agent-v2'));

    expect(result.current.error).toBeNull();
    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-memories',
      params: { agent_id: 'my_agent-v2' },
      fetchClient: expect.any(Function),
    });
  });

  it('should reject agentId with spaces', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent 123'));

    expect(result.current.error?.message).toMatch(/Invalid agentId/);
  });

  it('should reject agentId with dots', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent.v2'));

    expect(result.current.error?.message).toMatch(/Invalid agentId/);
  });

  it('should reject agentId with SQL injection attempt', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory("'; DROP TABLE--"));

    expect(result.current.error?.message).toMatch(/Invalid agentId/);
    expect(mockUseShape).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { agent_id: '00000000-0000-0000-0000-000000000000' },
      }),
    );
  });

  it('should call useSyncMutations with correct endpoint', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useAgentMemory('agent-123'));

    expect(mockUseSyncMutations).toHaveBeenCalledWith('agent-memories');
  });

  it('should return the mutation fns from useSyncMutations', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.create).toBe(mockCreate);
    expect(result.current.update).toBe(mockUpdate);
    expect(result.current.remove).toBe(mockRemove);
  });

  it('should return multiple memory records when data is an array', () => {
    const mockData = [
      {
        id: 'mem-1',
        agent_id: 'agent-123',
        content: 'first memory',
        type: 'episodic',
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        expires_at: null,
      },
      {
        id: 'mem-2',
        agent_id: 'agent-123',
        content: 'second memory',
        type: 'semantic',
        metadata: { source: 'user' },
        created_at: '2024-01-02T00:00:00Z',
        expires_at: '2024-12-31T00:00:00Z',
      },
    ];
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toHaveLength(2);
    expect(result.current.memories[0].id).toBe('mem-1');
    expect(result.current.memories[1].id).toBe('mem-2');
  });

  it('should handle empty array data correctly', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle object data (non-array) gracefully', () => {
    mockUseShape.mockReturnValue({
      data: { id: 'not-an-array' } as unknown,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toEqual([]);
  });

  it('should handle number data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: 42 as unknown,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAgentMemory('agent-123'));

    expect(result.current.memories).toEqual([]);
  });

  it('should set isLoading to false when invalid agentId regardless of shape loading state', () => {
    // Even if the shape hook says it's loading, invalid agentId short-circuits to isLoading: false
    mockUseShape.mockReturnValue({ data: null, isLoading: true, error: null });

    const { result } = renderHook(() => useAgentMemory(''));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error?.message).toMatch(/Invalid agentId/);
  });

  it('should reject agentId with unicode characters', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('agent\u00E9'));

    expect(result.current.error?.message).toMatch(/Invalid agentId/);
  });

  it('should reject agentId with path traversal', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useAgentMemory('../etc/passwd'));

    expect(result.current.error?.message).toMatch(/Invalid agentId/);
  });
});
