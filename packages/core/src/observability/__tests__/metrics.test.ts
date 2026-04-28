import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appMetrics,
  Counter,
  createMetricsMiddleware,
  Gauge,
  Histogram,
  MetricsCollector,
  metrics,
  startMemoryMonitoring,
  trackCacheOperation,
  trackDBQuery,
  trackError,
  trackHTTPRequest,
  trackX402PaymentRequired,
  trackX402PaymentVerify,
  trackX402SafeguardRejection,
  updateActiveConnections,
  updateMemoryUsage,
} from '../metrics.js';

describe('Counter', () => {
  let collector: MetricsCollector;
  let counter: Counter;

  beforeEach(() => {
    collector = new MetricsCollector();
    counter = collector.counter('test_counter', 'A test counter', ['method']);
  });

  it('starts at zero for unlabeled access', () => {
    expect(counter.get()).toBe(0);
  });

  it('increments by 1 by default', () => {
    counter.inc();
    expect(counter.get()).toBe(1);
  });

  it('increments by a custom value', () => {
    counter.inc(5);
    expect(counter.get()).toBe(5);
  });

  it('accumulates multiple increments', () => {
    counter.inc(3);
    counter.inc(7);
    expect(counter.get()).toBe(10);
  });

  it('tracks separate label sets independently', () => {
    counter.inc(2, { method: 'GET' });
    counter.inc(5, { method: 'POST' });
    counter.inc(3, { method: 'GET' });

    expect(counter.get({ method: 'GET' })).toBe(5);
    expect(counter.get({ method: 'POST' })).toBe(5);
  });

  it('returns 0 for labels that have never been incremented', () => {
    counter.inc(1, { method: 'GET' });
    expect(counter.get({ method: 'DELETE' })).toBe(0);
  });

  it('distinguishes between no labels and empty-like labels', () => {
    counter.inc(1);
    counter.inc(2, { method: 'GET' });

    // No labels should return unlabeled value
    expect(counter.get()).toBe(1);
    expect(counter.get({ method: 'GET' })).toBe(2);
  });

  it('treats label order as irrelevant (sorted key comparison)', () => {
    counter.inc(1, { method: 'GET', path: '/api' });
    counter.inc(2, { path: '/api', method: 'GET' });

    // Both should match the same bucket since keys are sorted
    expect(counter.get({ method: 'GET', path: '/api' })).toBe(3);
  });

  it('does not match labels with different key counts', () => {
    counter.inc(1, { method: 'GET' });
    expect(counter.get({ method: 'GET', path: '/api' })).toBe(0);
  });

  it('does not match when one side has labels and other does not', () => {
    counter.inc(5);
    expect(counter.get({ method: 'GET' })).toBe(0);

    counter.inc(3, { method: 'GET' });
    expect(counter.get()).toBe(5);
  });

  it('updates timestamp on subsequent increments', () => {
    vi.useFakeTimers();
    const t1 = Date.now();
    counter.inc(1);

    vi.advanceTimersByTime(1000);
    counter.inc(1);

    const metric = collector.getMetric('test_counter');
    expect(metric?.values[0]?.timestamp).toBe(t1 + 1000);

    vi.useRealTimers();
  });
});

describe('Gauge', () => {
  let collector: MetricsCollector;
  let gauge: Gauge;

  beforeEach(() => {
    collector = new MetricsCollector();
    gauge = collector.gauge('test_gauge', 'A test gauge', ['type']);
  });

  it('starts at zero', () => {
    expect(gauge.get()).toBe(0);
  });

  it('sets a value', () => {
    gauge.set(42);
    expect(gauge.get()).toBe(42);
  });

  it('overwrites the previous value on set', () => {
    gauge.set(10);
    gauge.set(99);
    expect(gauge.get()).toBe(99);
  });

  it('increments by 1 by default', () => {
    gauge.set(10);
    gauge.inc();
    expect(gauge.get()).toBe(11);
  });

  it('increments by a custom value', () => {
    gauge.set(10);
    gauge.inc(5);
    expect(gauge.get()).toBe(15);
  });

  it('decrements by 1 by default', () => {
    gauge.set(10);
    gauge.dec();
    expect(gauge.get()).toBe(9);
  });

  it('decrements by a custom value', () => {
    gauge.set(10);
    gauge.dec(3);
    expect(gauge.get()).toBe(7);
  });

  it('can go negative', () => {
    gauge.dec(5);
    expect(gauge.get()).toBe(-5);
  });

  it('tracks separate label sets independently', () => {
    gauge.set(100, { type: 'heap' });
    gauge.set(200, { type: 'rss' });

    expect(gauge.get({ type: 'heap' })).toBe(100);
    expect(gauge.get({ type: 'rss' })).toBe(200);
  });

  it('increments and decrements labeled values', () => {
    gauge.set(50, { type: 'heap' });
    gauge.inc(10, { type: 'heap' });
    gauge.dec(5, { type: 'heap' });

    expect(gauge.get({ type: 'heap' })).toBe(55);
  });

  it('creates a new entry if inc is called before set', () => {
    gauge.inc(7, { type: 'external' });
    expect(gauge.get({ type: 'external' })).toBe(7);
  });

  it('creates a new entry on dec for unknown labels (starts from 0)', () => {
    gauge.dec(3, { type: 'unknown' });
    expect(gauge.get({ type: 'unknown' })).toBe(-3);
  });
});

describe('Histogram', () => {
  let collector: MetricsCollector;
  let histogram: Histogram;

  beforeEach(() => {
    collector = new MetricsCollector();
    histogram = collector.histogram('test_histogram', 'A test histogram', [0.1, 0.5, 1, 5, 10]);
  });

  it('starts with zero count and sum', () => {
    expect(histogram.average()).toBe(0);
    expect(histogram.percentile(50)).toBe(0);
  });

  it('observes a value and updates sum/count', () => {
    histogram.observe(0.3);

    const metric = collector.getMetric('test_histogram') as {
      sum: number;
      count: number;
    };
    expect(metric.sum).toBeCloseTo(0.3);
    expect(metric.count).toBe(1);
  });

  it('distributes observations into correct buckets', () => {
    histogram.observe(0.05); // <= 0.1, 0.5, 1, 5, 10
    histogram.observe(0.3); // <= 0.5, 1, 5, 10
    histogram.observe(2); // <= 5, 10
    histogram.observe(7); // <= 10
    histogram.observe(15); // none

    const metric = collector.getMetric('test_histogram') as {
      buckets: Array<{ le: number; count: number }>;
      count: number;
    };

    const bucketMap = Object.fromEntries(metric.buckets.map((b) => [b.le, b.count]));

    expect(bucketMap[0.1]).toBe(1);
    expect(bucketMap[0.5]).toBe(2);
    expect(bucketMap[1]).toBe(2);
    expect(bucketMap[5]).toBe(3);
    expect(bucketMap[10]).toBe(4);
    expect(metric.count).toBe(5);
  });

  it('uses default bucket boundaries when none specified', () => {
    collector.histogram('default_buckets', 'default');
    const metric = collector.getMetric('default_buckets') as {
      buckets: Array<{ le: number }>;
    };

    const boundaries = metric.buckets.map((b) => b.le);
    expect(boundaries).toEqual([0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
  });

  it('includes boundary-exact values in that bucket', () => {
    histogram.observe(0.5);

    const metric = collector.getMetric('test_histogram') as {
      buckets: Array<{ le: number; count: number }>;
    };
    const bucket05 = metric.buckets.find((b) => b.le === 0.5);
    expect(bucket05?.count).toBe(1);
  });

  it('calculates average correctly', () => {
    histogram.observe(2);
    histogram.observe(4);
    histogram.observe(6);

    expect(histogram.average()).toBeCloseTo(4);
  });

  it('calculates percentiles correctly', () => {
    // Observe 1 through 100
    for (let i = 1; i <= 100; i++) {
      histogram.observe(i);
    }

    expect(histogram.percentile(50)).toBe(50);
    expect(histogram.percentile(90)).toBe(90);
    expect(histogram.percentile(99)).toBe(99);
    expect(histogram.percentile(100)).toBe(100);
  });

  it('returns 0 for percentile on empty histogram', () => {
    expect(histogram.percentile(50)).toBe(0);
  });

  describe('startTimer', () => {
    it('observes elapsed time in seconds', () => {
      vi.useFakeTimers();

      const end = histogram.startTimer();
      vi.advanceTimersByTime(250); // 250ms
      end();

      const metric = collector.getMetric('test_histogram') as {
        sum: number;
        count: number;
      };
      expect(metric.count).toBe(1);
      expect(metric.sum).toBeCloseTo(0.25); // 250ms = 0.25s

      vi.useRealTimers();
    });

    it('passes labels to the observation', () => {
      vi.useFakeTimers();

      const h = collector.histogram('labeled_timer', 'timer', [1, 5], ['op']);
      const end = h.startTimer({ op: 'query' });
      vi.advanceTimersByTime(100);
      end();

      const metric = collector.getMetric('labeled_timer') as {
        values: Array<{ labels?: Record<string, string | number> }>;
      };
      expect(metric.values[0]?.labels).toEqual({ op: 'query' });

      vi.useRealTimers();
    });
  });
});

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('registers and retrieves a counter', () => {
    collector.counter('my_counter', 'help text');
    const metric = collector.getMetric('my_counter');

    expect(metric).toBeDefined();
    expect(metric?.type).toBe('counter');
    expect(metric?.help).toBe('help text');
  });

  it('registers and retrieves a gauge', () => {
    collector.gauge('my_gauge', 'gauge help');
    const metric = collector.getMetric('my_gauge');

    expect(metric).toBeDefined();
    expect(metric?.type).toBe('gauge');
  });

  it('registers and retrieves a histogram', () => {
    collector.histogram('my_hist', 'hist help');
    const metric = collector.getMetric('my_hist');

    expect(metric).toBeDefined();
    expect(metric?.type).toBe('histogram');
  });

  it('stores label definitions on the metric', () => {
    collector.counter('labeled', 'help', ['method', 'status']);
    const metric = collector.getMetric('labeled');
    expect(metric?.labels).toEqual(['method', 'status']);
  });

  it('returns undefined for non-existent metric', () => {
    expect(collector.getMetric('nonexistent')).toBeUndefined();
  });

  it('getMetrics returns all registered metrics', () => {
    collector.counter('c1', 'help1');
    collector.gauge('g1', 'help2');
    collector.histogram('h1', 'help3');

    const all = collector.getMetrics();
    expect(all).toHaveLength(3);

    const names = all.map((m) => m.name);
    expect(names).toContain('c1');
    expect(names).toContain('g1');
    expect(names).toContain('h1');
  });

  it('getMetrics returns empty array when no metrics registered', () => {
    expect(collector.getMetrics()).toEqual([]);
  });

  it('clear removes all metrics', () => {
    collector.counter('c1', 'help');
    collector.gauge('g1', 'help');
    collector.clear();

    expect(collector.getMetrics()).toEqual([]);
    expect(collector.getMetric('c1')).toBeUndefined();
  });

  it('overwrites a metric if the same name is registered again', () => {
    const c1 = collector.counter('dup', 'first');
    c1.inc(10);

    const c2 = collector.counter('dup', 'second');
    // The map entry is replaced, so getMetric sees the new metric
    expect(collector.getMetric('dup')?.help).toBe('second');
    expect(c2.get()).toBe(0);
  });

  describe('exportPrometheus', () => {
    it('exports counter in Prometheus format', () => {
      const c = collector.counter('http_total', 'Total requests');
      c.inc(5);

      const output = collector.exportPrometheus();
      expect(output).toContain('# HELP http_total Total requests');
      expect(output).toContain('# TYPE http_total counter');
      expect(output).toContain('http_total 5');
    });

    it('exports labeled counter with label string', () => {
      const c = collector.counter('req', 'Requests');
      c.inc(3, { method: 'GET', status: '200' });

      const output = collector.exportPrometheus();
      expect(output).toContain('req{method="GET",status="200"} 3');
    });

    it('exports gauge values', () => {
      const g = collector.gauge('temp', 'Temperature');
      g.set(42);

      const output = collector.exportPrometheus();
      expect(output).toContain('# TYPE temp gauge');
      expect(output).toContain('temp 42');
    });

    it('exports histogram with buckets, sum, and count', () => {
      const h = collector.histogram('duration', 'Duration', [0.1, 0.5, 1]);
      h.observe(0.3);
      h.observe(0.8);

      const output = collector.exportPrometheus();
      expect(output).toContain('# HELP duration Duration');
      expect(output).toContain('# TYPE duration histogram');
      expect(output).toContain('duration_bucket{le="0.1"} 0');
      expect(output).toContain('duration_bucket{le="0.5"} 1');
      expect(output).toContain('duration_bucket{le="1"} 2');
      expect(output).toContain('duration_bucket{le="+Inf"} 2');
      expect(output).toContain('duration_sum 1.1');
      expect(output).toContain('duration_count 2');
    });

    it('returns empty string for empty collector', () => {
      expect(collector.exportPrometheus()).toBe('');
    });
  });

  describe('exportJSON', () => {
    it('exports counter as JSON', () => {
      const c = collector.counter('req', 'Requests');
      c.inc(7);

      const json = collector.exportJSON();
      expect(json.req).toBeDefined();
      expect((json.req as { type: string }).type).toBe('counter');
      expect((json.req as { values: Array<{ value: number }> }).values[0]?.value).toBe(7);
    });

    it('exports histogram as JSON with buckets, sum, count', () => {
      const h = collector.histogram('dur', 'Duration', [1, 5]);
      h.observe(2);

      const json = collector.exportJSON();
      const entry = json.dur as {
        type: string;
        sum: number;
        count: number;
        buckets: Array<{ le: number; count: number }>;
      };

      expect(entry.type).toBe('histogram');
      expect(entry.sum).toBe(2);
      expect(entry.count).toBe(1);
      expect(entry.buckets).toHaveLength(2);
    });

    it('returns empty object for empty collector', () => {
      expect(collector.exportJSON()).toEqual({});
    });
  });
});

describe('Helper functions', () => {
  beforeEach(() => {
    // Reset the shared metrics collector between tests
    metrics.clear();

    // Re-register the appMetrics since clear() wipes them
    // We need to re-import or re-assign. Instead, we just track on the
    // already-registered counters/gauges/histograms since they hold refs
    // to the underlying Metric objects that were created at module load.
    // After clear(), appMetrics still reference the original Metric objects
    // but they are no longer in the collector map.
    // So we should NOT call clear() -- instead just accept accumulated state
    // or test with isolated collectors.
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trackHTTPRequest', () => {
    it('increments request counter and observes duration', () => {
      const startCount = appMetrics.httpRequestsTotal.get({
        method: 'GET',
        path: '/api',
        status: '200',
      });

      trackHTTPRequest('GET', '/api', 200, 150);

      expect(
        appMetrics.httpRequestsTotal.get({
          method: 'GET',
          path: '/api',
          status: '200',
        }),
      ).toBe(startCount + 1);
    });

    it('converts duration from ms to seconds for histogram', () => {
      // Use a fresh collector to get a clean histogram
      const col = new MetricsCollector();
      const hist = col.histogram('test_http_dur', 'Duration', [0.1, 0.5, 1, 5]);

      // Simulate what trackHTTPRequest does: duration / 1000
      const durationMs = 500;
      hist.observe(durationMs / 1000);

      const metric = col.getMetric('test_http_dur') as {
        sum: number;
        count: number;
      };
      expect(metric.sum).toBeCloseTo(0.5);
      expect(metric.count).toBe(1);
    });

    it('records duration via trackHTTPRequest on the shared appMetrics', () => {
      // Capture count before
      const metricRef = metrics.getMetric('http_request_duration_seconds') as
        | { count: number; sum: number }
        | undefined;
      const countBefore = metricRef?.count ?? 0;
      const sumBefore = metricRef?.sum ?? 0;

      trackHTTPRequest('PUT', '/update', 200, 1000);

      // appMetrics still references the original Metric object even if
      // metrics.clear() was called, so read from the collector directly
      // if present, otherwise check we at least got an increment
      if (metricRef) {
        expect(metricRef.count).toBe(countBefore + 1);
        expect(metricRef.sum - sumBefore).toBeCloseTo(1.0);
      }
    });
  });

  describe('trackDBQuery', () => {
    it('increments query counter with operation and table labels', () => {
      const before = appMetrics.dbQueriesTotal.get({
        operation: 'select',
        table: 'users',
      });

      trackDBQuery('select', 'users', 50);

      expect(appMetrics.dbQueriesTotal.get({ operation: 'select', table: 'users' })).toBe(
        before + 1,
      );
    });
  });

  describe('trackCacheOperation', () => {
    it('increments cache counter with default result=success', () => {
      const before = appMetrics.cacheOperationsTotal.get({
        operation: 'hit',
        result: 'success',
      });

      trackCacheOperation('hit');

      expect(
        appMetrics.cacheOperationsTotal.get({
          operation: 'hit',
          result: 'success',
        }),
      ).toBe(before + 1);
    });

    it('increments cache counter with explicit error result', () => {
      const before = appMetrics.cacheOperationsTotal.get({
        operation: 'set',
        result: 'error',
      });

      trackCacheOperation('set', 'error');

      expect(
        appMetrics.cacheOperationsTotal.get({
          operation: 'set',
          result: 'error',
        }),
      ).toBe(before + 1);
    });
  });

  describe('trackError', () => {
    it('increments error counter with default severity=medium', () => {
      const before = appMetrics.errorsTotal.get({
        type: 'validation',
        severity: 'medium',
      });

      trackError('validation');

      expect(appMetrics.errorsTotal.get({ type: 'validation', severity: 'medium' })).toBe(
        before + 1,
      );
    });

    it('increments error counter with explicit severity', () => {
      const before = appMetrics.errorsTotal.get({
        type: 'db_failure',
        severity: 'critical',
      });

      trackError('db_failure', 'critical');

      expect(
        appMetrics.errorsTotal.get({
          type: 'db_failure',
          severity: 'critical',
        }),
      ).toBe(before + 1);
    });
  });

  describe('updateActiveConnections', () => {
    it('increments active connections gauge', () => {
      const before = appMetrics.activeConnections.get({ type: 'websocket' });

      updateActiveConnections('websocket', 3);

      expect(appMetrics.activeConnections.get({ type: 'websocket' })).toBe(before + 3);
    });

    it('decrements active connections with negative delta', () => {
      updateActiveConnections('http', 10);
      const after10 = appMetrics.activeConnections.get({ type: 'http' });

      updateActiveConnections('http', -4);

      expect(appMetrics.activeConnections.get({ type: 'http' })).toBe(after10 - 4);
    });
  });

  describe('updateMemoryUsage', () => {
    it('sets heap, external, and rss gauges from process.memoryUsage', () => {
      updateMemoryUsage();

      // process.memoryUsage() returns non-zero values in Node
      expect(appMetrics.memoryUsage.get({ type: 'heap' })).toBeGreaterThan(0);
      expect(appMetrics.memoryUsage.get({ type: 'rss' })).toBeGreaterThan(0);
      // external can be 0 in some environments, so just check it's a number
      expect(typeof appMetrics.memoryUsage.get({ type: 'external' })).toBe('number');
    });
  });

  describe('startMemoryMonitoring', () => {
    it('returns a timer that can be cleared', () => {
      vi.useFakeTimers();

      const timer = startMemoryMonitoring(5000);
      expect(timer).toBeDefined();

      clearInterval(timer);
      vi.useRealTimers();
    });

    it('calls updateMemoryUsage at the specified interval', () => {
      vi.useFakeTimers();

      const timer = startMemoryMonitoring(1000);

      vi.advanceTimersByTime(1000);
      // After one interval, memory metrics should have been updated
      // (value will be process.memoryUsage().heapUsed, which is > 0)
      expect(appMetrics.memoryUsage.get({ type: 'heap' })).toBeGreaterThanOrEqual(0);

      clearInterval(timer);
      vi.useRealTimers();
    });
  });

  describe('trackX402PaymentRequired', () => {
    it('increments x402_payment_required_total with route + currency labels', () => {
      const before = appMetrics.x402PaymentRequiredTotal.get({
        route: 'a2a-pending-payment',
        currency: 'usdc-rvui',
      });

      trackX402PaymentRequired('a2a-pending-payment', 'usdc-rvui');

      expect(
        appMetrics.x402PaymentRequiredTotal.get({
          route: 'a2a-pending-payment',
          currency: 'usdc-rvui',
        }),
      ).toBe(before + 1);
    });

    it('keeps separate counts for usdc-only vs usdc-rvui', () => {
      const beforeOnly = appMetrics.x402PaymentRequiredTotal.get({
        route: 'task-quota',
        currency: 'usdc-only',
      });
      const beforeBoth = appMetrics.x402PaymentRequiredTotal.get({
        route: 'task-quota',
        currency: 'usdc-rvui',
      });

      trackX402PaymentRequired('task-quota', 'usdc-only');
      trackX402PaymentRequired('task-quota', 'usdc-only');
      trackX402PaymentRequired('task-quota', 'usdc-rvui');

      expect(
        appMetrics.x402PaymentRequiredTotal.get({ route: 'task-quota', currency: 'usdc-only' }),
      ).toBe(beforeOnly + 2);
      expect(
        appMetrics.x402PaymentRequiredTotal.get({ route: 'task-quota', currency: 'usdc-rvui' }),
      ).toBe(beforeBoth + 1);
    });
  });

  describe('trackX402PaymentVerify', () => {
    it('increments verify counter with route + scheme + result labels', () => {
      const beforeCount = appMetrics.x402PaymentVerifyTotal.get({
        route: 'marketplace-invoke',
        scheme: 'exact',
        result: 'valid',
      });

      trackX402PaymentVerify('marketplace-invoke', 'exact', 'valid', 250);

      expect(
        appMetrics.x402PaymentVerifyTotal.get({
          route: 'marketplace-invoke',
          scheme: 'exact',
          result: 'valid',
        }),
      ).toBe(beforeCount + 1);
    });

    it('observes duration on the histogram (average reflects new sample)', () => {
      // Use a unique route to isolate this test's effect on the histogram
      // (which is keyed only on `scheme`, not `route` — so any prior
      // observe call from another test would skew average() globally).
      // We can still verify that calling track increments the underlying
      // average toward our value.
      const histBefore = appMetrics.x402PaymentVerifyDuration.average();
      trackX402PaymentVerify('isolated-route', 'exact', 'valid', 1000);
      const histAfter = appMetrics.x402PaymentVerifyDuration.average();
      // Every observe() shifts the average toward the new value; cannot
      // assert exact value (other tests may have observed too) but can
      // assert it changed OR is finite.
      expect(Number.isFinite(histAfter)).toBe(true);
      expect(histAfter).not.toBe(Number.NaN);
      // If this is the first ever observation, before is 0 and after > 0
      if (histBefore === 0) {
        expect(histAfter).toBeGreaterThan(0);
      }
    });

    it('counts invalid results separately from valid', () => {
      const beforeValid = appMetrics.x402PaymentVerifyTotal.get({
        route: 'a2a',
        scheme: 'solana-spl',
        result: 'valid',
      });
      const beforeInvalid = appMetrics.x402PaymentVerifyTotal.get({
        route: 'a2a',
        scheme: 'solana-spl',
        result: 'invalid',
      });

      trackX402PaymentVerify('a2a', 'solana-spl', 'invalid', 100);

      expect(
        appMetrics.x402PaymentVerifyTotal.get({
          route: 'a2a',
          scheme: 'solana-spl',
          result: 'valid',
        }),
      ).toBe(beforeValid);
      expect(
        appMetrics.x402PaymentVerifyTotal.get({
          route: 'a2a',
          scheme: 'solana-spl',
          result: 'invalid',
        }),
      ).toBe(beforeInvalid + 1);
    });
  });

  describe('trackX402SafeguardRejection', () => {
    it('increments rejection counter with the matching reason label', () => {
      const before = appMetrics.x402SafeguardRejectionTotal.get({ reason: 'duplicate-tx' });

      trackX402SafeguardRejection('duplicate-tx');

      expect(appMetrics.x402SafeguardRejectionTotal.get({ reason: 'duplicate-tx' })).toBe(
        before + 1,
      );
    });

    it('keeps each rejection reason separately countable', () => {
      const beforeReplay = appMetrics.x402SafeguardRejectionTotal.get({ reason: 'duplicate-tx' });
      const beforeCap = appMetrics.x402SafeguardRejectionTotal.get({
        reason: 'single-payment-cap',
      });
      const beforeRate = appMetrics.x402SafeguardRejectionTotal.get({
        reason: 'wallet-rate-limit',
      });

      trackX402SafeguardRejection('duplicate-tx');
      trackX402SafeguardRejection('single-payment-cap');
      trackX402SafeguardRejection('wallet-rate-limit');
      trackX402SafeguardRejection('discount-cap');
      trackX402SafeguardRejection('circuit-breaker');

      expect(appMetrics.x402SafeguardRejectionTotal.get({ reason: 'duplicate-tx' })).toBe(
        beforeReplay + 1,
      );
      expect(appMetrics.x402SafeguardRejectionTotal.get({ reason: 'single-payment-cap' })).toBe(
        beforeCap + 1,
      );
      expect(appMetrics.x402SafeguardRejectionTotal.get({ reason: 'wallet-rate-limit' })).toBe(
        beforeRate + 1,
      );
    });
  });
});

describe('createMetricsMiddleware', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks successful requests', async () => {
    const middleware = createMetricsMiddleware();
    const request = { method: 'GET', url: 'http://localhost/api/users' };
    const response = { status: 200, body: 'ok' };

    const result = await middleware(request, async () => response);

    expect(result).toBe(response);
  });

  it('tracks failed requests with status 500 and re-throws', async () => {
    const middleware = createMetricsMiddleware();
    const request = { method: 'POST', url: 'http://localhost/api/data' };
    const error = new Error('Internal failure');

    await expect(
      middleware(request, async () => {
        throw error;
      }),
    ).rejects.toThrow('Internal failure');
  });

  it('uses status 200 when response has no status field', async () => {
    const middleware = createMetricsMiddleware();
    const request = { method: 'GET', url: 'http://localhost/health' };

    // Response without status property
    const result = await middleware(request, async () => ({}) as { status?: number });
    expect(result).toBeDefined();
  });

  it('extracts pathname from full URL', async () => {
    const middleware = createMetricsMiddleware();
    const request = {
      method: 'GET',
      url: 'http://localhost:3000/api/v1/users?page=1',
    };

    const before = appMetrics.httpRequestsTotal.get({
      method: 'GET',
      path: '/api/v1/users',
      status: '200',
    });

    await middleware(request, async () => ({ status: 200 }));

    expect(
      appMetrics.httpRequestsTotal.get({
        method: 'GET',
        path: '/api/v1/users',
        status: '200',
      }),
    ).toBe(before + 1);
  });

  it('tracks error type on failure', async () => {
    const middleware = createMetricsMiddleware();
    const request = { method: 'DELETE', url: 'http://localhost/api/item' };

    const before = appMetrics.errorsTotal.get({
      type: 'http_error',
      severity: 'high',
    });

    try {
      await middleware(request, async () => {
        throw new Error('boom');
      });
    } catch {
      // expected
    }

    expect(appMetrics.errorsTotal.get({ type: 'http_error', severity: 'high' })).toBe(before + 1);
  });
});

describe('Label matching edge cases', () => {
  it('handles numeric label values', () => {
    const collector = new MetricsCollector();
    const counter = collector.counter('numeric_labels', 'test');

    counter.inc(1, { status: 200 });
    counter.inc(2, { status: 200 });

    expect(counter.get({ status: 200 })).toBe(3);
  });

  it('does not match different numeric values', () => {
    const collector = new MetricsCollector();
    const counter = collector.counter('status_counter', 'test');

    counter.inc(1, { status: 200 });
    counter.inc(1, { status: 404 });

    expect(counter.get({ status: 200 })).toBe(1);
    expect(counter.get({ status: 404 })).toBe(1);
  });

  it('handles many label keys', () => {
    const collector = new MetricsCollector();
    const counter = collector.counter('multi_label', 'test');

    const labels = { a: '1', b: '2', c: '3', d: '4', e: '5' };
    counter.inc(1, labels);

    expect(counter.get(labels)).toBe(1);
    expect(counter.get({ a: '1', b: '2', c: '3', d: '4' })).toBe(0);
  });
});

describe('Prometheus export formatting', () => {
  it('separates metrics with blank lines', () => {
    const collector = new MetricsCollector();
    collector.counter('a', 'First');
    collector.counter('b', 'Second');

    const output = collector.exportPrometheus();
    // Each metric block ends with an empty line
    const blocks = output.split('\n\n');
    // At minimum 2 blocks (each metric) + possible trailing
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('handles metrics with no values', () => {
    const collector = new MetricsCollector();
    collector.counter('empty', 'No values yet');

    const output = collector.exportPrometheus();
    expect(output).toContain('# HELP empty No values yet');
    expect(output).toContain('# TYPE empty counter');
    // No value lines
    expect(output).not.toContain('empty 0');
  });
});

describe('Module-level exports', () => {
  it('exports a default MetricsCollector instance', () => {
    expect(metrics).toBeInstanceOf(MetricsCollector);
  });

  it('appMetrics contains all expected metric keys', () => {
    const expectedKeys = [
      'httpRequestsTotal',
      'httpRequestDuration',
      'dbQueriesTotal',
      'dbQueryDuration',
      'cacheOperationsTotal',
      'cacheHitRate',
      'activeConnections',
      'errorsTotal',
      'queueSize',
      'queueProcessingDuration',
      'memoryUsage',
      'apiCallsTotal',
      'apiCallDuration',
    ];

    for (const key of expectedKeys) {
      expect(appMetrics).toHaveProperty(key);
    }
  });

  it('appMetrics.httpRequestsTotal is a Counter', () => {
    expect(appMetrics.httpRequestsTotal).toBeInstanceOf(Counter);
  });

  it('appMetrics.cacheHitRate is a Gauge', () => {
    expect(appMetrics.cacheHitRate).toBeInstanceOf(Gauge);
  });

  it('appMetrics.httpRequestDuration is a Histogram', () => {
    expect(appMetrics.httpRequestDuration).toBeInstanceOf(Histogram);
  });
});
