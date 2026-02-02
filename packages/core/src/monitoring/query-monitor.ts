/**
 * Database Query Performance Monitoring
 *
 * Tracks query execution time and logs slow queries
 */

interface QueryMetric {
  name: string
  duration: number
  success: boolean
  error?: unknown
  timestamp: number
}

interface SlowQueryLog {
  query: string
  duration: number
  parameters?: unknown[]
  timestamp: number
  stackTrace?: string
}

const queryMetrics: QueryMetric[] = []
const slowQueryLogs: SlowQueryLog[] = []

// Configuration
const SLOW_QUERY_THRESHOLD = 100 // milliseconds
const MAX_METRICS_STORED = 1000
const MAX_SLOW_QUERIES_STORED = 100

/**
 * Monitor a database query execution
 */
export async function monitorQuery<T>(
  name: string,
  queryFn: () => Promise<T>,
): Promise<T> {
  const start = Date.now()

  try {
    const result = await queryFn()
    const duration = Date.now() - start

    recordQueryMetric({
      name,
      duration,
      success: true,
      timestamp: start,
    })

    if (duration > SLOW_QUERY_THRESHOLD) {
      console.warn(`[SLOW QUERY] ${name} took ${duration}ms`)
    }

    return result
  } catch (error) {
    const duration = Date.now() - start

    recordQueryMetric({
      name,
      duration,
      success: false,
      error,
      timestamp: start,
    })

    throw error
  }
}

/**
 * Record query metric
 */
function recordQueryMetric(metric: QueryMetric): void {
  queryMetrics.push(metric)

  // Limit stored metrics
  if (queryMetrics.length > MAX_METRICS_STORED) {
    queryMetrics.shift()
  }
}

/**
 * Log slow query
 */
export function logSlowQuery(
  query: string,
  duration: number,
  parameters?: unknown[],
): void {
  const log: SlowQueryLog = {
    query,
    duration,
    parameters,
    timestamp: Date.now(),
    stackTrace: new Error().stack,
  }

  slowQueryLogs.push(log)

  // Limit stored logs
  if (slowQueryLogs.length > MAX_SLOW_QUERIES_STORED) {
    slowQueryLogs.shift()
  }

  console.warn('[SLOW QUERY]', {
    query,
    duration: `${duration}ms`,
    parameters,
  })
}

/**
 * Get query statistics
 */
export function getQueryStats() {
  if (queryMetrics.length === 0) {
    return {
      totalQueries: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: 0,
      successRate: 0,
      slowQueries: 0,
    }
  }

  const durations = queryMetrics.map((m) => m.duration)
  const successCount = queryMetrics.filter((m) => m.success).length
  const slowQueriesCount = queryMetrics.filter(
    (m) => m.duration > SLOW_QUERY_THRESHOLD,
  ).length

  return {
    totalQueries: queryMetrics.length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
    successRate: (successCount / queryMetrics.length) * 100,
    slowQueries: slowQueriesCount,
    slowQueryRate: (slowQueriesCount / queryMetrics.length) * 100,
  }
}

/**
 * Get slow query logs
 */
export function getSlowQueries(): SlowQueryLog[] {
  return [...slowQueryLogs].sort((a, b) => b.duration - a.duration)
}

/**
 * Get queries by name
 */
export function getQueriesByName(name: string): QueryMetric[] {
  return queryMetrics.filter((m) => m.name === name)
}

/**
 * Get query percentiles
 */
export function getQueryPercentiles() {
  if (queryMetrics.length === 0) {
    return { p50: 0, p95: 0, p99: 0 }
  }

  const sortedDurations = queryMetrics
    .map((m) => m.duration)
    .sort((a, b) => a - b)

  const p50Index = Math.floor(sortedDurations.length * 0.5)
  const p95Index = Math.floor(sortedDurations.length * 0.95)
  const p99Index = Math.floor(sortedDurations.length * 0.99)

  return {
    p50: sortedDurations[p50Index] || 0,
    p95: sortedDurations[p95Index] || 0,
    p99: sortedDurations[p99Index] || 0,
  }
}

/**
 * Clear all metrics
 */
export function clearQueryMetrics(): void {
  queryMetrics.length = 0
  slowQueryLogs.length = 0
}

/**
 * Get query report
 */
export function getQueryReport() {
  const stats = getQueryStats()
  const percentiles = getQueryPercentiles()
  const slowQueries = getSlowQueries().slice(0, 10) // Top 10 slowest

  return {
    summary: {
      ...stats,
      percentiles,
    },
    slowQueries,
    topQueries: getTopQueriesByDuration(),
  }
}

/**
 * Get top queries by total duration
 */
function getTopQueriesByDuration() {
  const queryGroups = new Map<string, { count: number; totalDuration: number }>()

  for (const metric of queryMetrics) {
    const existing = queryGroups.get(metric.name) || {
      count: 0,
      totalDuration: 0,
    }
    queryGroups.set(metric.name, {
      count: existing.count + 1,
      totalDuration: existing.totalDuration + metric.duration,
    })
  }

  return Array.from(queryGroups.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalDuration: data.totalDuration,
      avgDuration: data.totalDuration / data.count,
    }))
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, 10)
}

/**
 * Create query wrapper with automatic monitoring
 */
export function createMonitoredQuery<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  queryFn: T,
): T {
  return (async (...args: unknown[]) => {
    return monitorQuery(name, () => queryFn(...args))
  }) as T
}

/**
 * Measure query execution time
 */
export async function measureQuery<T>(
  query: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  const start = Date.now()
  const result = await query()
  const duration = Date.now() - start

  return { result, duration }
}

/**
 * Export metrics for external monitoring
 */
export function exportMetrics() {
  return {
    queries: {
      ...getQueryStats(),
      percentiles: getQueryPercentiles(),
    },
    slowQueries: getSlowQueries().length,
    timestamp: Date.now(),
  }
}
