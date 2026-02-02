/**
 * Database Query Performance Monitoring
 *
 * Tracks query execution time and logs slow queries
 */
interface QueryMetric {
    name: string;
    duration: number;
    success: boolean;
    error?: unknown;
    timestamp: number;
}
interface SlowQueryLog {
    query: string;
    duration: number;
    parameters?: unknown[];
    timestamp: number;
    stackTrace?: string;
}
/**
 * Monitor a database query execution
 */
export declare function monitorQuery<T>(name: string, queryFn: () => Promise<T>): Promise<T>;
/**
 * Log slow query
 */
export declare function logSlowQuery(query: string, duration: number, parameters?: unknown[]): void;
/**
 * Get query statistics
 */
export declare function getQueryStats(): {
    totalQueries: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
    successRate: number;
    slowQueries: number;
    slowQueryRate?: undefined;
} | {
    totalQueries: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
    successRate: number;
    slowQueries: number;
    slowQueryRate: number;
};
/**
 * Get slow query logs
 */
export declare function getSlowQueries(): SlowQueryLog[];
/**
 * Get queries by name
 */
export declare function getQueriesByName(name: string): QueryMetric[];
/**
 * Get query percentiles
 */
export declare function getQueryPercentiles(): {
    p50: number;
    p95: number;
    p99: number;
};
/**
 * Clear all metrics
 */
export declare function clearQueryMetrics(): void;
/**
 * Get query report
 */
export declare function getQueryReport(): {
    summary: {
        percentiles: {
            p50: number;
            p95: number;
            p99: number;
        };
        totalQueries: number;
        avgDuration: number;
        maxDuration: number;
        minDuration: number;
        successRate: number;
        slowQueries: number;
        slowQueryRate?: undefined;
    } | {
        percentiles: {
            p50: number;
            p95: number;
            p99: number;
        };
        totalQueries: number;
        avgDuration: number;
        maxDuration: number;
        minDuration: number;
        successRate: number;
        slowQueries: number;
        slowQueryRate: number;
    };
    slowQueries: SlowQueryLog[];
    topQueries: {
        name: string;
        count: number;
        totalDuration: number;
        avgDuration: number;
    }[];
};
/**
 * Create query wrapper with automatic monitoring
 */
export declare function createMonitoredQuery<T extends (...args: unknown[]) => Promise<unknown>>(name: string, queryFn: T): T;
/**
 * Measure query execution time
 */
export declare function measureQuery<T>(query: () => Promise<T>): Promise<{
    result: T;
    duration: number;
}>;
/**
 * Export metrics for external monitoring
 */
export declare function exportMetrics(): {
    queries: {
        percentiles: {
            p50: number;
            p95: number;
            p99: number;
        };
        totalQueries: number;
        avgDuration: number;
        maxDuration: number;
        minDuration: number;
        successRate: number;
        slowQueries: number;
        slowQueryRate?: undefined;
    } | {
        percentiles: {
            p50: number;
            p95: number;
            p99: number;
        };
        totalQueries: number;
        avgDuration: number;
        maxDuration: number;
        minDuration: number;
        successRate: number;
        slowQueries: number;
        slowQueryRate: number;
    };
    slowQueries: number;
    timestamp: number;
};
export {};
//# sourceMappingURL=query-monitor.d.ts.map