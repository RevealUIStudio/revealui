/**
 * @revealui/ai - React Hooks for Observability
 *
 * React hooks for accessing and displaying agent events and metrics.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentEventLogger } from '../../observability/logger.js';
import type { AgentMetricsCollector } from '../../observability/metrics.js';
import { AgentEventQuery } from '../../observability/query.js';
import type {
  AgentMetrics,
  AnyAgentEvent,
  EventFilter,
  MetricsSummary,
} from '../../observability/types.js';

/**
 * Hook for accessing agent events with real-time updates
 */
export function useAgentEvents(
  logger: AgentEventLogger,
  filter?: EventFilter,
  options?: {
    refreshInterval?: number; // ms
    autoRefresh?: boolean;
  },
) {
  const [events, setEvents] = useState<AnyAgentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshInterval = options?.refreshInterval ?? 5000;
  const autoRefresh = options?.autoRefresh ?? true;

  const refresh = useCallback(() => {
    setLoading(true);
    const newEvents = logger.getEvents(filter);
    setEvents(newEvents);
    setLoading(false);
  }, [logger, filter]);

  useEffect(() => {
    refresh();

    if (autoRefresh) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refresh, autoRefresh, refreshInterval]);

  return {
    events,
    loading,
    refresh,
    count: events.length,
  };
}

/**
 * Hook for accessing agent metrics with real-time updates
 */
export function useAgentMetrics(
  collector: AgentMetricsCollector,
  agentId: string,
  options?: {
    refreshInterval?: number;
    autoRefresh?: boolean;
  },
) {
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshInterval = options?.refreshInterval ?? 5000;
  const autoRefresh = options?.autoRefresh ?? true;

  const refresh = useCallback(() => {
    setLoading(true);
    const newMetrics = collector.getMetrics(agentId);
    setMetrics(newMetrics);
    setLoading(false);
  }, [collector, agentId]);

  useEffect(() => {
    refresh();

    if (autoRefresh) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refresh, autoRefresh, refreshInterval]);

  return {
    metrics,
    loading,
    refresh,
  };
}

/**
 * Hook for accessing metrics summary
 */
export function useMetricsSummary(
  collector: AgentMetricsCollector,
  filter?: EventFilter,
  options?: {
    refreshInterval?: number;
    autoRefresh?: boolean;
  },
) {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshInterval = options?.refreshInterval ?? 5000;
  const autoRefresh = options?.autoRefresh ?? true;

  const refresh = useCallback(() => {
    setLoading(true);
    const newSummary = collector.getMetricsSummary(filter);
    setSummary(newSummary);
    setLoading(false);
  }, [collector, filter]);

  useEffect(() => {
    refresh();

    if (autoRefresh) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refresh, autoRefresh, refreshInterval]);

  return {
    summary,
    loading,
    refresh,
  };
}

/**
 * Hook for querying events with advanced filters
 */
export function useEventQuery(logger: AgentEventLogger) {
  const query = useMemo(() => new AgentEventQuery(logger), [logger]);

  const getRecentEvents = useCallback(
    (milliseconds: number, count?: number) => {
      return query.getRecentEvents(milliseconds, count);
    },
    [query],
  );

  const getEventsForAgent = useCallback(
    (agentId: string) => {
      return query.getEventsForAgent(agentId);
    },
    [query],
  );

  const getEventsForSession = useCallback(
    (sessionId: string) => {
      return query.getEventsForSession(sessionId);
    },
    [query],
  );

  const searchEvents = useCallback(
    (searchText: string, filter?: EventFilter) => {
      return query.searchEvents(searchText, filter);
    },
    [query],
  );

  const paginateEvents = useCallback(
    (page: number, pageSize: number, filter?: EventFilter) => {
      return query.paginateEvents(page, pageSize, filter);
    },
    [query],
  );

  return {
    query,
    getRecentEvents,
    getEventsForAgent,
    getEventsForSession,
    searchEvents,
    paginateEvents,
  };
}

/**
 * Hook for tool usage statistics
 */
export function useToolUsageStats(
  collector: AgentMetricsCollector,
  options?: {
    refreshInterval?: number;
    autoRefresh?: boolean;
  },
) {
  const [stats, setStats] = useState<
    Array<{
      toolName: string;
      metrics: {
        totalCalls: number;
        successCount: number;
        failureCount: number;
        averageDurationMs: number;
        lastUsed: number;
      };
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const refreshInterval = options?.refreshInterval ?? 5000;
  const autoRefresh = options?.autoRefresh ?? true;

  const refresh = useCallback(() => {
    setLoading(true);
    const newStats = collector.getToolUsageStats();
    setStats(newStats);
    setLoading(false);
  }, [collector]);

  useEffect(() => {
    refresh();

    if (autoRefresh) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refresh, autoRefresh, refreshInterval]);

  return {
    stats,
    loading,
    refresh,
  };
}

/**
 * Hook for LLM usage statistics
 */
export function useLLMUsageStats(
  collector: AgentMetricsCollector,
  options?: {
    refreshInterval?: number;
    autoRefresh?: boolean;
  },
) {
  const [stats, setStats] = useState<{
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCost: number;
    averageDurationMs: number;
    cacheHitRate: number;
    modelUsage: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshInterval = options?.refreshInterval ?? 5000;
  const autoRefresh = options?.autoRefresh ?? true;

  const refresh = useCallback(() => {
    setLoading(true);
    const newStats = collector.getLLMUsageStats();
    setStats(newStats);
    setLoading(false);
  }, [collector]);

  useEffect(() => {
    refresh();

    if (autoRefresh) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refresh, autoRefresh, refreshInterval]);

  return {
    stats,
    loading,
    refresh,
  };
}

/**
 * Hook for real-time event stream
 */
export function useEventStream(
  logger: AgentEventLogger,
  options?: {
    maxEvents?: number;
    filter?: EventFilter;
  },
) {
  const [events, setEvents] = useState<AnyAgentEvent[]>([]);
  const maxEvents = options?.maxEvents ?? 100;

  useEffect(() => {
    const interval = setInterval(() => {
      const newEvents = logger.getEvents(options?.filter);
      setEvents(newEvents.slice(-maxEvents));
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [logger, maxEvents, options?.filter]);

  return {
    events,
    latestEvent: events[events.length - 1],
  };
}

/**
 * Hook for paginated events
 */
export function usePaginatedEvents(
  logger: AgentEventLogger,
  initialPageSize = 20,
  filter?: EventFilter,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const query = useMemo(() => new AgentEventQuery(logger), [logger]);

  const result = useMemo(() => {
    return query.paginateEvents(page, pageSize, filter);
  }, [query, page, pageSize, filter]);

  const nextPage = useCallback(() => {
    if (page < result.totalPages) {
      setPage(page + 1);
    }
  }, [page, result.totalPages]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, newPage));
  }, []);

  const changePageSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset to first page
  }, []);

  return {
    ...result,
    nextPage,
    prevPage,
    goToPage,
    changePageSize,
    hasNextPage: page < result.totalPages,
    hasPrevPage: page > 1,
  };
}
