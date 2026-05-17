import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskSubmissions } from '../useTaskSubmissions.js';

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

describe('useTaskSubmissions', () => {
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

    const { result } = renderHook(() => useTaskSubmissions());

    expect(result.current.submissions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return submission records', () => {
    const mockData = [
      {
        id: 'task-1',
        submitter_id: 'user-abc',
        agent_id: null,
        skill_name: 'code-review',
        input: {},
        output: null,
        artifacts: [],
        status: 'pending',
        priority: 3,
        cost_usdc: null,
        payment_method: null,
        execution_meta: null,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() => useTaskSubmissions());

    expect(result.current.submissions).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should handle loading state', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: true, error: null });

    const { result } = renderHook(() => useTaskSubmissions());

    expect(result.current.submissions).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle error state', () => {
    const mockError = new Error('Shape fetch failed');
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: mockError });

    const { result } = renderHook(() => useTaskSubmissions());

    expect(result.current.submissions).toEqual([]);
    expect(result.current.error).toBe(mockError);
  });

  it('should call useShape with the task-submissions proxy url', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useTaskSubmissions());

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/task-submissions',
      fetchClient: expect.any(Function),
    });
  });

  it('should call useSyncMutations with task-submissions endpoint', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    renderHook(() => useTaskSubmissions());

    expect(mockUseSyncMutations).toHaveBeenCalledWith('task-submissions');
  });

  it('should return mutation functions', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useTaskSubmissions());

    expect(result.current.create).toBe(mockCreate);
    expect(result.current.update).toBe(mockUpdate);
    expect(result.current.remove).toBe(mockRemove);
  });

  it('should handle non-array data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: 'invalid' as unknown,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useTaskSubmissions());

    expect(result.current.submissions).toEqual([]);
  });

  it('should return multiple submissions', () => {
    const mockData = [
      {
        id: 'task-1',
        submitter_id: 'user-abc',
        agent_id: 'agent-1',
        skill_name: 'code-review',
        input: {},
        output: null,
        artifacts: [],
        status: 'completed',
        priority: 3,
        cost_usdc: '0.50',
        payment_method: 'x402',
        execution_meta: null,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
      },
      {
        id: 'task-2',
        submitter_id: 'user-abc',
        agent_id: null,
        skill_name: 'summarize',
        input: { text: 'hello' },
        output: null,
        artifacts: [],
        status: 'running',
        priority: 5,
        cost_usdc: null,
        payment_method: null,
        execution_meta: null,
        error_message: null,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() => useTaskSubmissions());

    expect(result.current.submissions).toHaveLength(2);
    expect(result.current.submissions[0].id).toBe('task-1');
    expect(result.current.submissions[1].id).toBe('task-2');
  });
});
