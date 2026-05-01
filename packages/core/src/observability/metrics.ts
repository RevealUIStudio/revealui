/**
 * Metrics Collection System
 *
 * Collect and expose application metrics for monitoring
 */

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricLabels {
  [key: string]: string | number;
}

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: MetricLabels;
}

export interface Metric {
  name: string;
  type: MetricType;
  help: string;
  values: MetricValue[];
  labels?: string[];
}

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface HistogramMetric extends Metric {
  type: 'histogram';
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();

  /**
   * Register a counter metric
   */
  counter(name: string, help: string, labels?: string[]): Counter {
    const metric: Metric = {
      name,
      type: 'counter',
      help,
      values: [],
      labels,
    };

    this.metrics.set(name, metric);

    return new Counter(metric);
  }

  /**
   * Register a gauge metric
   */
  gauge(name: string, help: string, labels?: string[]): Gauge {
    const metric: Metric = {
      name,
      type: 'gauge',
      help,
      values: [],
      labels,
    };

    this.metrics.set(name, metric);

    return new Gauge(metric);
  }

  /**
   * Register a histogram metric
   */
  histogram(
    name: string,
    help: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    labels?: string[],
  ): Histogram {
    const metric: HistogramMetric = {
      name,
      type: 'histogram',
      help,
      values: [],
      labels,
      buckets: buckets.map((le) => ({ le, count: 0 })),
      sum: 0,
      count: 0,
    };

    this.metrics.set(name, metric);

    return new Histogram(metric);
  }

  /**
   * Get all metrics
   */
  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      // Add help text
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'histogram') {
        const histMetric = metric as HistogramMetric;

        // Export buckets
        for (const bucket of histMetric.buckets) {
          lines.push(`${metric.name}_bucket{le="${bucket.le}"} ${bucket.count}`);
        }

        lines.push(`${metric.name}_bucket{le="+Inf"} ${histMetric.count}`);
        lines.push(`${metric.name}_sum ${histMetric.sum}`);
        lines.push(`${metric.name}_count ${histMetric.count}`);
      } else {
        // Export regular metrics
        for (const value of metric.values) {
          const labelStr = value.labels
            ? Object.entries(value.labels)
                .map(([k, v]) => `${k}="${v}"`)
                .join(',')
            : '';

          const metricLine = labelStr
            ? `${metric.name}{${labelStr}} ${value.value}`
            : `${metric.name} ${value.value}`;

          lines.push(metricLine);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const metric of this.metrics.values()) {
      if (metric.type === 'histogram') {
        const histMetric = metric as HistogramMetric;
        result[metric.name] = {
          type: metric.type,
          count: histMetric.count,
          sum: histMetric.sum,
          buckets: histMetric.buckets,
        };
      } else {
        result[metric.name] = {
          type: metric.type,
          values: metric.values,
        };
      }
    }

    return result;
  }
}

/**
 * Counter metric
 */
export class Counter {
  constructor(private metric: Metric) {}

  /**
   * Increment counter
   */
  inc(value: number = 1, labels?: MetricLabels): void {
    const existing = this.findValue(labels);

    if (existing) {
      existing.value += value;
      existing.timestamp = Date.now();
    } else {
      this.metric.values.push({
        value,
        timestamp: Date.now(),
        labels,
      });
    }
  }

  /**
   * Get current value
   */
  get(labels?: MetricLabels): number {
    const value = this.findValue(labels);
    return value ? value.value : 0;
  }

  /**
   * Find value by labels
   */
  private findValue(labels?: MetricLabels): MetricValue | undefined {
    return this.metric.values.find((v) => this.labelsMatch(v.labels, labels));
  }

  /**
   * Check if labels match
   */
  private labelsMatch(a?: MetricLabels, b?: MetricLabels): boolean {
    if (!(a || b)) return true;
    if (!(a && b)) return false;

    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every((key, i) => key === bKeys[i] && a[key] === b[key]);
  }
}

/**
 * Gauge metric
 */
export class Gauge {
  constructor(private metric: Metric) {}

  /**
   * Set gauge value
   */
  set(value: number, labels?: MetricLabels): void {
    const existing = this.findValue(labels);

    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
    } else {
      this.metric.values.push({
        value,
        timestamp: Date.now(),
        labels,
      });
    }
  }

  /**
   * Increment gauge
   */
  inc(value: number = 1, labels?: MetricLabels): void {
    const existing = this.findValue(labels);

    if (existing) {
      existing.value += value;
      existing.timestamp = Date.now();
    } else {
      this.metric.values.push({
        value,
        timestamp: Date.now(),
        labels,
      });
    }
  }

  /**
   * Decrement gauge
   */
  dec(value: number = 1, labels?: MetricLabels): void {
    this.inc(-value, labels);
  }

  /**
   * Get current value
   */
  get(labels?: MetricLabels): number {
    const value = this.findValue(labels);
    return value ? value.value : 0;
  }

  /**
   * Find value by labels
   */
  private findValue(labels?: MetricLabels): MetricValue | undefined {
    return this.metric.values.find((v) => this.labelsMatch(v.labels, labels));
  }

  /**
   * Check if labels match
   */
  private labelsMatch(a?: MetricLabels, b?: MetricLabels): boolean {
    if (!(a || b)) return true;
    if (!(a && b)) return false;

    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every((key, i) => key === bKeys[i] && a[key] === b[key]);
  }
}

/**
 * Histogram metric
 */
export class Histogram {
  constructor(private metric: HistogramMetric) {}

  /**
   * Observe a value
   */
  observe(value: number, labels?: MetricLabels): void {
    // Update buckets
    for (const bucket of this.metric.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }

    // Update sum and count
    this.metric.sum += value;
    this.metric.count++;

    // Store value
    this.metric.values.push({
      value,
      timestamp: Date.now(),
      labels,
    });
  }

  /**
   * Start a timer
   */
  startTimer(labels?: MetricLabels): () => void {
    const start = Date.now();

    return () => {
      const duration = (Date.now() - start) / 1000;
      this.observe(duration, labels);
    };
  }

  /**
   * Get percentile
   */
  percentile(p: number): number {
    if (this.metric.values.length === 0) return 0;

    const sorted = [...this.metric.values].sort((a, b) => a.value - b.value);
    const index = Math.ceil((p / 100) * sorted.length) - 1;

    return sorted[index]?.value || 0;
  }

  /**
   * Get average
   */
  average(): number {
    if (this.metric.count === 0) return 0;
    return this.metric.sum / this.metric.count;
  }
}

/**
 * Default metrics collector
 */
export const metrics = new MetricsCollector();

/**
 * Application metrics
 */
export const appMetrics = {
  // HTTP requests
  httpRequestsTotal: metrics.counter('http_requests_total', 'Total number of HTTP requests', [
    'method',
    'path',
    'status',
  ]),

  httpRequestDuration: metrics.histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    ['method', 'path'],
  ),

  // Database queries
  dbQueriesTotal: metrics.counter('db_queries_total', 'Total number of database queries', [
    'operation',
    'table',
  ]),

  dbQueryDuration: metrics.histogram(
    'db_query_duration_seconds',
    'Database query duration in seconds',
    [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5],
    ['operation', 'table'],
  ),

  // Cache operations
  cacheOperationsTotal: metrics.counter(
    'cache_operations_total',
    'Total number of cache operations',
    ['operation', 'result'],
  ),

  cacheHitRate: metrics.gauge('cache_hit_rate', 'Cache hit rate percentage'),

  // Active connections
  activeConnections: metrics.gauge('active_connections', 'Number of active connections', ['type']),

  // Errors
  errorsTotal: metrics.counter('errors_total', 'Total number of errors', ['type', 'severity']),

  // Queue metrics
  queueSize: metrics.gauge('queue_size', 'Current queue size', ['queue']),

  queueProcessingDuration: metrics.histogram(
    'queue_processing_duration_seconds',
    'Queue item processing duration',
    [0.1, 0.5, 1, 5, 10, 30],
    ['queue'],
  ),

  // Memory usage
  memoryUsage: metrics.gauge('memory_usage_bytes', 'Memory usage in bytes', ['type']),

  // API calls (external)
  apiCallsTotal: metrics.counter('api_calls_total', 'Total number of external API calls', [
    'service',
    'status',
  ]),

  apiCallDuration: metrics.histogram(
    'api_call_duration_seconds',
    'External API call duration',
    [0.1, 0.5, 1, 2, 5, 10],
    ['service'],
  ),

  // x402 micropayments (GAP-149 PR 5)
  x402PaymentRequiredTotal: metrics.counter(
    'x402_payment_required_total',
    'HTTP 402 Payment Required responses emitted by route + currency advertised',
    ['route', 'currency'],
  ),

  x402PaymentVerifyTotal: metrics.counter(
    'x402_payment_verify_total',
    'x402 payment verification attempts by route, scheme, and result',
    ['route', 'scheme', 'result'],
  ),

  x402PaymentVerifyDuration: metrics.histogram(
    'x402_payment_verify_duration_seconds',
    'x402 payment verification latency (Coinbase facilitator round-trip for USDC; Solana RPC + safeguards for RVUI)',
    [0.05, 0.1, 0.5, 1, 5, 10, 30],
    ['scheme'],
  ),

  x402SafeguardRejectionTotal: metrics.counter(
    'x402_safeguard_rejection_total',
    'RVUI safeguards pipeline rejections by reason (replay / cap / rate-limit / discount-cap / circuit-breaker)',
    ['reason'],
  ),
};

/**
 * Track HTTP request
 */
export function trackHTTPRequest(
  method: string,
  path: string,
  status: number,
  duration: number,
): void {
  appMetrics.httpRequestsTotal.inc(1, { method, path, status: String(status) });
  appMetrics.httpRequestDuration.observe(duration / 1000, { method, path });
}

/**
 * Track database query
 */
export function trackDBQuery(operation: string, table: string, duration: number): void {
  appMetrics.dbQueriesTotal.inc(1, { operation, table });
  appMetrics.dbQueryDuration.observe(duration / 1000, { operation, table });
}

/**
 * Track cache operation
 */
export function trackCacheOperation(
  operation: 'hit' | 'miss' | 'set' | 'delete',
  result: 'success' | 'error' = 'success',
): void {
  appMetrics.cacheOperationsTotal.inc(1, { operation, result });
}

/**
 * Track error
 */
export function trackError(
  type: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
): void {
  appMetrics.errorsTotal.inc(1, { type, severity });
}

/**
 * Update active connections
 */
export function updateActiveConnections(type: string, delta: number): void {
  appMetrics.activeConnections.inc(delta, { type });
}

/**
 * Track an x402 HTTP 402 emission at a route. Call when the route returns
 * 402 with `X-PAYMENT-REQUIRED`. `currency` is `'usdc-rvui'` when both are
 * advertised (RVUI_PAYMENTS_ENABLED + receiving wallet set) and `'usdc-only'`
 * otherwise.
 */
export function trackX402PaymentRequired(route: string, currency: 'usdc-only' | 'usdc-rvui'): void {
  appMetrics.x402PaymentRequiredTotal.inc(1, { route, currency });
}

/**
 * Track an x402 payment verification. Increments the result counter and
 * observes the duration histogram (latency includes Coinbase facilitator
 * round-trip for USDC OR Solana RPC + safeguards pipeline for RVUI).
 */
export function trackX402PaymentVerify(
  route: string,
  scheme: 'exact' | 'solana-spl',
  result: 'valid' | 'invalid',
  durationMs: number,
): void {
  appMetrics.x402PaymentVerifyTotal.inc(1, { route, scheme, result });
  appMetrics.x402PaymentVerifyDuration.observe(durationMs / 1000, { scheme });
}

/**
 * Track an RVUI safeguards pipeline rejection. Called from
 * `verifyRvuiPayment` when `validatePayment` returns disallowed. Reasons
 * are mapped from the safeguard's free-text reason at the call site to
 * keep wording coupling low.
 */
export type X402SafeguardRejectionReason =
  | 'duplicate-tx'
  | 'circuit-breaker'
  | 'single-payment-cap'
  | 'wallet-rate-limit'
  | 'discount-cap'
  | 'unknown';

export function trackX402SafeguardRejection(reason: X402SafeguardRejectionReason): void {
  appMetrics.x402SafeguardRejectionTotal.inc(1, { reason });
}

/**
 * Update memory usage
 */
export function updateMemoryUsage(): void {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage();

    appMetrics.memoryUsage.set(mem.heapUsed, { type: 'heap' });
    appMetrics.memoryUsage.set(mem.external, { type: 'external' });
    appMetrics.memoryUsage.set(mem.rss, { type: 'rss' });
  }
}

/**
 * Start memory monitoring
 */
export function startMemoryMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(updateMemoryUsage, intervalMs);
}

/**
 * Create metrics middleware
 */
export function createMetricsMiddleware<TRequest = unknown, TResponse = unknown>() {
  return async (
    request: TRequest & { method: string; url: string },
    next: () => Promise<TResponse & { status?: number }>,
  ): Promise<TResponse & { status?: number }> => {
    const startTime = Date.now();
    const method = request.method;
    const path = new URL(request.url).pathname;

    try {
      const response = await next();
      const duration = Date.now() - startTime;

      trackHTTPRequest(method, path, response.status ?? 200, duration);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      trackHTTPRequest(method, path, 500, duration);
      trackError('http_error', 'high');

      throw error;
    }
  };
}
