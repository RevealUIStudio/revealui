/**
 * useAgentEvents Hook Tests
 *
 * Tests for the agent events and metrics hooks.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentEventLogger } from '../../../observability/logger.js';
import type { AgentMetricsCollector } from '../../../observability/metrics.js';
import type { AgentMetrics, AnyAgentEvent } from '../../../observability/types.js';
import { useAgentEvents, useAgentMetrics } from '../useAgentEvents.js';

describe('useAgentEvents', () => {
  let mockLogger: AgentEventLogger;
  const mockEvent: AnyAgentEvent = {
    type: 'tool_use',
    timestamp: '2024-01-01T00:00:00Z',
    agentId: 'agent-1',
    tool: 'search',
    params: { query: 'test' },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      getEvents: vi.fn().mockReturnValue([mockEvent]),
      log: vi.fn(),
      clear: vi.fn(),
    } as unknown as AgentEventLogger;
  });

  describe('Initial Load', () => {
    it('should load events on mount', async () => {
      const { result } = renderHook(() => useAgentEvents(mockLogger));

      // Hook completes synchronously, loading is false immediately
      expect(result.current.loading).toBe(false);
      expect(result.current.events).toEqual([mockEvent]);
      expect(result.current.count).toBe(1);
      expect(mockLogger.getEvents).toHaveBeenCalledWith(undefined);
    });

    it('should apply filter on mount', () => {
      const filter = { agentId: 'agent-1' };
      const { result } = renderHook(() => useAgentEvents(mockLogger, filter));

      expect(result.current.loading).toBe(false);
      expect(mockLogger.getEvents).toHaveBeenCalledWith(filter);
    });

    it('should handle empty events', () => {
      (mockLogger.getEvents as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const { result } = renderHook(() => useAgentEvents(mockLogger));

      expect(result.current.loading).toBe(false);
      expect(result.current.events).toEqual([]);
      expect(result.current.count).toBe(0);
    });
  });

  describe('Auto Refresh', () => {
    it('should auto-refresh by default', async () => {
      const { result } = renderHook(() =>
        useAgentEvents(mockLogger, undefined, {
          refreshInterval: 100, // Use shorter interval for testing
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect((mockLogger.getEvents as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

      // Wait for auto-refresh to trigger
      await waitFor(
        () => {
          expect(
            (mockLogger.getEvents as ReturnType<typeof vi.fn>).mock.calls.length,
          ).toBeGreaterThanOrEqual(2);
        },
        { timeout: 1000 },
      );
    });

    it('should respect custom refresh interval', async () => {
      const { result } = renderHook(() =>
        useAgentEvents(mockLogger, undefined, {
          refreshInterval: 100,
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await waitFor(
        () => {
          expect(
            (mockLogger.getEvents as ReturnType<typeof vi.fn>).mock.calls.length,
          ).toBeGreaterThanOrEqual(2);
        },
        { timeout: 1000 },
      );
    });

    it('should not auto-refresh when disabled', async () => {
      const { result } = renderHook(() =>
        useAgentEvents(mockLogger, undefined, {
          autoRefresh: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect((mockLogger.getEvents as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

      // Wait a bit to ensure no auto-refresh happens
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should still be 1
      expect((mockLogger.getEvents as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });
  });

  describe('Manual Refresh', () => {
    it('should manually refresh events', async () => {
      const { result } = renderHook(() =>
        useAgentEvents(mockLogger, undefined, { autoRefresh: false }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Update mock to return different events
      const newEvent: AnyAgentEvent = {
        type: 'completion',
        timestamp: '2024-01-02T00:00:00Z',
        agentId: 'agent-1',
        content: 'Done',
      };
      (mockLogger.getEvents as ReturnType<typeof vi.fn>).mockReturnValue([mockEvent, newEvent]);

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.events).toHaveLength(2);
      });

      expect(result.current.count).toBe(2);
    });
  });

  describe('Filter Changes', () => {
    it('should update events when filter changes', async () => {
      const { result, rerender } = renderHook(({ filter }) => useAgentEvents(mockLogger, filter), {
        initialProps: { filter: undefined },
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newFilter = { agentId: 'agent-2' };
      rerender({ filter: newFilter });

      await waitFor(() => {
        expect(mockLogger.getEvents).toHaveBeenCalledWith(newFilter);
      });
    });
  });
});

describe('useAgentMetrics', () => {
  let mockCollector: AgentMetricsCollector;
  const mockMetrics: AgentMetrics = {
    agentId: 'agent-1',
    totalRequests: 10,
    successfulRequests: 8,
    failedRequests: 2,
    avgResponseTime: 150,
    totalTokens: 5000,
    errors: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockCollector = {
      getMetrics: vi.fn().mockReturnValue(mockMetrics),
      recordRequest: vi.fn(),
      recordError: vi.fn(),
    } as unknown as AgentMetricsCollector;
  });

  describe('Initial Load', () => {
    it('should load metrics on mount', () => {
      const { result } = renderHook(() => useAgentMetrics(mockCollector, 'agent-1'));

      // Hook completes synchronously
      expect(result.current.loading).toBe(false);
      expect(result.current.metrics).toEqual(mockMetrics);
      expect(mockCollector.getMetrics).toHaveBeenCalledWith('agent-1');
    });

    it('should handle null metrics', async () => {
      (mockCollector.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const { result } = renderHook(() => useAgentMetrics(mockCollector, 'agent-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.metrics).toBeNull();
    });
  });

  describe('Auto Refresh', () => {
    it('should auto-refresh by default', async () => {
      const { result } = renderHook(() =>
        useAgentMetrics(mockCollector, 'agent-1', {
          refreshInterval: 100, // Use shorter interval for testing
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect((mockCollector.getMetrics as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

      await waitFor(
        () => {
          expect(
            (mockCollector.getMetrics as ReturnType<typeof vi.fn>).mock.calls.length,
          ).toBeGreaterThanOrEqual(2);
        },
        { timeout: 1000 },
      );
    });

    it('should respect custom refresh interval', async () => {
      const { result } = renderHook(() =>
        useAgentMetrics(mockCollector, 'agent-1', {
          refreshInterval: 100,
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await waitFor(
        () => {
          expect(
            (mockCollector.getMetrics as ReturnType<typeof vi.fn>).mock.calls.length,
          ).toBeGreaterThanOrEqual(2);
        },
        { timeout: 1000 },
      );
    });

    it('should not auto-refresh when disabled', async () => {
      const { result } = renderHook(() =>
        useAgentMetrics(mockCollector, 'agent-1', {
          autoRefresh: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Wait a bit to ensure no auto-refresh happens
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect((mockCollector.getMetrics as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });
  });

  describe('Manual Refresh', () => {
    it('should manually refresh metrics', async () => {
      const { result } = renderHook(() =>
        useAgentMetrics(mockCollector, 'agent-1', { autoRefresh: false }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Update mock to return different metrics
      const updatedMetrics: AgentMetrics = {
        ...mockMetrics,
        totalRequests: 20,
      };
      (mockCollector.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue(updatedMetrics);

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.metrics?.totalRequests).toBe(20);
      });
    });
  });

  describe('Agent ID Changes', () => {
    it('should update metrics when agentId changes', async () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentMetrics(mockCollector, agentId),
        {
          initialProps: { agentId: 'agent-1' },
        },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      rerender({ agentId: 'agent-2' });

      await waitFor(() => {
        expect(mockCollector.getMetrics).toHaveBeenCalledWith('agent-2');
      });
    });
  });
});
