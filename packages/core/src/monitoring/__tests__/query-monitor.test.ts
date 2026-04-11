/**
 * Query Monitor Tests
 *
 * Covers: monitorQuery, getQueryStats, getSlowQueries, logSlowQuery,
 * getQueriesByName, getQueryPercentiles, clearQueryMetrics, getQueryReport,
 * createMonitoredQuery, measureQuery, exportMetrics
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../observability/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '../../observability/logger.js';
import {
  clearQueryMetrics,
  createMonitoredQuery,
  exportMetrics,
  getQueriesByName,
  getQueryPercentiles,
  getQueryReport,
  getQueryStats,
  getSlowQueries,
  logSlowQuery,
  measureQuery,
  monitorQuery,
} from '../query-monitor.js';

describe('QueryMonitor', () => {
  beforeEach(() => {
    clearQueryMetrics();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearQueryMetrics();
  });

  // ── monitorQuery ──────────────────────────────────────────────────

  describe('monitorQuery', () => {
    it('should return the result of the query function', async () => {
      const result = await monitorQuery('test-query', async () => 'hello');
      expect(result).toBe('hello');
    });

    it('should return complex results from the query function', async () => {
      const data = { id: 1, name: 'test', items: [1, 2, 3] };
      const result = await monitorQuery('complex-query', async () => data);
      expect(result).toEqual(data);
    });

    it('should record a successful query metric', async () => {
      await monitorQuery('select-users', async () => []);

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(1);
      expect(stats.successRate).toBe(100);
    });

    it('should record query duration', async () => {
      const now = 1000;
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(now) // start
        .mockReturnValueOnce(now + 50); // end

      await monitorQuery('timed-query', async () => 'done');

      const stats = getQueryStats();
      expect(stats.avgDuration).toBe(50);
    });

    it('should log a warning for slow queries (>100ms)', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1200); // 200ms elapsed

      await monitorQuery('slow-select', async () => null);

      expect(logger.warn).toHaveBeenCalledWith('Slow query detected', {
        query: 'slow-select',
        duration: 200,
      });
    });

    it('should not log a warning for fast queries (<=100ms)', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1050); // 50ms

      await monitorQuery('fast-select', async () => null);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not log a warning for exactly 100ms queries', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1100); // exactly 100ms  -  not > threshold

      await monitorQuery('borderline-query', async () => null);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should record a failed query metric and rethrow the error', async () => {
      const error = new Error('connection refused');

      await expect(
        monitorQuery('failing-query', async () => {
          throw error;
        }),
      ).rejects.toThrow('connection refused');

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should record duration even for failed queries', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1075); // 75ms

      try {
        await monitorQuery('fail-timed', async () => {
          throw new Error('timeout');
        });
      } catch {
        // expected
      }

      const stats = getQueryStats();
      expect(stats.avgDuration).toBe(75);
    });

    it('should preserve the error type when rethrowing', async () => {
      class DatabaseError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.code = code;
        }
      }

      const dbError = new DatabaseError('deadlock', 'DEADLOCK');

      try {
        await monitorQuery('deadlock-query', async () => {
          throw dbError;
        });
        expect.fail('should have thrown');
      } catch (caught) {
        expect(caught).toBe(dbError);
        expect((caught as DatabaseError).code).toBe('DEADLOCK');
      }
    });
  });

  // ── getQueryStats ─────────────────────────────────────────────────

  describe('getQueryStats', () => {
    it('should return zeroed stats when no queries recorded', () => {
      const stats = getQueryStats();
      expect(stats).toEqual({
        totalQueries: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        successRate: 0,
        slowQueries: 0,
      });
    });

    it('should compute correct stats for a single query', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1030);

      await monitorQuery('q1', async () => null);

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(1);
      expect(stats.avgDuration).toBe(30);
      expect(stats.maxDuration).toBe(30);
      expect(stats.minDuration).toBe(30);
      expect(stats.successRate).toBe(100);
      expect(stats.slowQueries).toBe(0);
    });

    it('should compute correct aggregate stats for multiple queries', async () => {
      const durations = [20, 50, 150, 80];
      const dateNowSpy = vi.spyOn(Date, 'now');

      let time = 1000;
      for (const d of durations) {
        dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + d);
        await monitorQuery(`q-${d}`, async () => null);
        time += 1000;
      }

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(4);
      expect(stats.avgDuration).toBe(75); // (20+50+150+80)/4
      expect(stats.maxDuration).toBe(150);
      expect(stats.minDuration).toBe(20);
      expect(stats.successRate).toBe(100);
      expect(stats.slowQueries).toBe(1); // only 150ms > 100ms
    });

    it('should include slowQueryRate in stats', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      // 2 slow, 2 fast
      const durations = [50, 200, 30, 150];
      let time = 1000;
      for (const d of durations) {
        dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + d);
        await monitorQuery(`q`, async () => null);
        time += 1000;
      }

      const stats = getQueryStats();
      expect(stats.slowQueryRate).toBe(50); // 2/4 * 100
    });

    it('should compute mixed success/failure rates', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      let time = 1000;

      // 2 successes
      for (let i = 0; i < 2; i++) {
        dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + 10);
        await monitorQuery('ok', async () => null);
        time += 100;
      }

      // 1 failure
      dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + 10);
      try {
        await monitorQuery('fail', async () => {
          throw new Error('err');
        });
      } catch {
        // expected
      }

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(3);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });
  });

  // ── getSlowQueries ────────────────────────────────────────────────

  describe('getSlowQueries', () => {
    it('should return empty array when no slow queries logged', () => {
      expect(getSlowQueries()).toEqual([]);
    });

    it('should return slow queries sorted by duration descending', () => {
      logSlowQuery('SELECT * FROM users', 200);
      logSlowQuery('SELECT * FROM posts', 500);
      logSlowQuery('SELECT * FROM comments', 150);

      const slow = getSlowQueries();
      expect(slow).toHaveLength(3);
      expect(slow[0].duration).toBe(500);
      expect(slow[1].duration).toBe(200);
      expect(slow[2].duration).toBe(150);
    });

    it('should return a copy (not the internal array)', () => {
      logSlowQuery('SELECT 1', 300);
      const a = getSlowQueries();
      const b = getSlowQueries();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  // ── logSlowQuery ──────────────────────────────────────────────────

  describe('logSlowQuery', () => {
    it('should record a slow query log entry', () => {
      logSlowQuery('SELECT * FROM orders', 250);

      const logs = getSlowQueries();
      expect(logs).toHaveLength(1);
      expect(logs[0].query).toBe('SELECT * FROM orders');
      expect(logs[0].duration).toBe(250);
    });

    it('should record parameters when provided', () => {
      logSlowQuery('SELECT * FROM users WHERE id = $1', 300, [42]);

      const logs = getSlowQueries();
      expect(logs[0].parameters).toEqual([42]);
    });

    it('should record a timestamp', () => {
      const now = 5000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      logSlowQuery('SELECT 1', 120);

      const logs = getSlowQueries();
      expect(logs[0].timestamp).toBe(5000);
    });

    it('should include a stack trace', () => {
      logSlowQuery('SELECT 1', 120);

      const logs = getSlowQueries();
      expect(logs[0].stackTrace).toBeDefined();
      expect(typeof logs[0].stackTrace).toBe('string');
    });

    it('should log a warning via the logger', () => {
      logSlowQuery('SELECT * FROM big_table', 400, ['param1']);

      expect(logger.warn).toHaveBeenCalledWith('Slow query logged', {
        query: 'SELECT * FROM big_table',
        duration: 400,
        parameters: ['param1'],
      });
    });

    it('should evict oldest entry when exceeding MAX_SLOW_QUERIES_STORED (100)', () => {
      for (let i = 0; i < 101; i++) {
        logSlowQuery(`query-${i}`, 200 + i);
      }

      const logs = getSlowQueries();
      expect(logs).toHaveLength(100);
      // query-0 should have been evicted
      const queries = logs.map((l) => l.query);
      expect(queries).not.toContain('query-0');
      expect(queries).toContain('query-1');
      expect(queries).toContain('query-100');
    });
  });

  // ── getQueriesByName ──────────────────────────────────────────────

  describe('getQueriesByName', () => {
    it('should return empty array for unknown query name', () => {
      expect(getQueriesByName('nonexistent')).toEqual([]);
    });

    it('should return only metrics matching the given name', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      let time = 1000;

      for (const name of ['find-user', 'find-post', 'find-user', 'find-comment']) {
        dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + 10);
        await monitorQuery(name, async () => null);
        time += 100;
      }

      const userQueries = getQueriesByName('find-user');
      expect(userQueries).toHaveLength(2);
      for (const m of userQueries) {
        expect(m.name).toBe('find-user');
      }
    });
  });

  // ── getQueryPercentiles ───────────────────────────────────────────

  describe('getQueryPercentiles', () => {
    it('should return zeroed percentiles when no queries recorded', () => {
      expect(getQueryPercentiles()).toEqual({ p50: 0, p95: 0, p99: 0 });
    });

    it('should compute percentiles for a set of queries', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      let time = 1000;

      // Add 100 queries with durations 1..100
      for (let i = 1; i <= 100; i++) {
        dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + i);
        await monitorQuery(`q-${i}`, async () => null);
        time += 200;
      }

      const percentiles = getQueryPercentiles();
      // p50 = index 50 -> duration 51
      expect(percentiles.p50).toBe(51);
      // p95 = index 95 -> duration 96
      expect(percentiles.p95).toBe(96);
      // p99 = index 99 -> duration 100
      expect(percentiles.p99).toBe(100);
    });

    it('should handle a single query', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1042);

      await monitorQuery('single', async () => null);

      const percentiles = getQueryPercentiles();
      expect(percentiles.p50).toBe(42);
      // With 1 element, all percentile indices floor to 0
      expect(percentiles.p95).toBe(42);
      expect(percentiles.p99).toBe(42);
    });
  });

  // ── clearQueryMetrics ─────────────────────────────────────────────

  describe('clearQueryMetrics', () => {
    it('should clear all query metrics', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1010);

      await monitorQuery('q1', async () => null);
      expect(getQueryStats().totalQueries).toBe(1);

      clearQueryMetrics();
      expect(getQueryStats().totalQueries).toBe(0);
    });

    it('should clear all slow query logs', () => {
      logSlowQuery('SELECT 1', 500);
      expect(getSlowQueries()).toHaveLength(1);

      clearQueryMetrics();
      expect(getSlowQueries()).toHaveLength(0);
    });
  });

  // ── Metric eviction (MAX_METRICS_STORED) ──────────────────────────

  describe('metric eviction', () => {
    it('should evict oldest metrics when exceeding MAX_METRICS_STORED (1000)', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      let time = 1000;

      for (let i = 0; i < 1001; i++) {
        dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + 10);
        await monitorQuery(`query-${i}`, async () => null);
        time += 100;
      }

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(1000);

      // The first query (query-0) should be evicted
      const byName = getQueriesByName('query-0');
      expect(byName).toHaveLength(0);

      // The last query should still be present
      const last = getQueriesByName('query-1000');
      expect(last).toHaveLength(1);
    });
  });

  // ── getQueryReport ────────────────────────────────────────────────

  describe('getQueryReport', () => {
    it('should return a complete report with empty metrics', () => {
      const report = getQueryReport();

      expect(report.summary.totalQueries).toBe(0);
      expect(report.summary.percentiles).toEqual({ p50: 0, p95: 0, p99: 0 });
      expect(report.slowQueries).toEqual([]);
      expect(report.topQueries).toEqual([]);
    });

    it('should aggregate stats, percentiles, slow queries, and top queries', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      let time = 1000;

      // Record some monitored queries
      for (const d of [10, 50, 200, 150]) {
        dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + d);
        await monitorQuery('report-query', async () => null);
        time += 1000;
      }

      // Record a slow query log
      dateNowSpy.mockReturnValue(time);
      logSlowQuery('SELECT heavy', 500);

      const report = getQueryReport();
      expect(report.summary.totalQueries).toBe(4);
      expect(report.summary.percentiles).toBeDefined();
      expect(report.slowQueries).toHaveLength(1);
      expect(report.topQueries).toHaveLength(1);
      expect(report.topQueries[0].name).toBe('report-query');
      expect(report.topQueries[0].count).toBe(4);
    });

    it('should limit slow queries to top 10 in report', () => {
      for (let i = 0; i < 15; i++) {
        logSlowQuery(`query-${i}`, 200 + i);
      }

      const report = getQueryReport();
      expect(report.slowQueries).toHaveLength(10);
      // Should be sorted by duration desc  -  the top 10 slowest
      expect(report.slowQueries[0].duration).toBe(214);
    });

    it('should limit top queries to 10', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      let time = 1000;

      for (let i = 0; i < 15; i++) {
        dateNowSpy.mockReturnValueOnce(time).mockReturnValueOnce(time + 10);
        await monitorQuery(`unique-query-${i}`, async () => null);
        time += 100;
      }

      const report = getQueryReport();
      expect(report.topQueries.length).toBeLessThanOrEqual(10);
    });
  });

  // ── createMonitoredQuery ──────────────────────────────────────────

  describe('createMonitoredQuery', () => {
    it('should wrap a query function with monitoring', async () => {
      const original = async (id: unknown) => ({ id, name: 'test' });
      const monitored = createMonitoredQuery('get-user', original);

      const result = await monitored(42);
      expect(result).toEqual({ id: 42, name: 'test' });

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(1);
    });

    it('should propagate errors from the wrapped function', async () => {
      const failing = async () => {
        throw new Error('db down');
      };
      const monitored = createMonitoredQuery('fail-query', failing);

      await expect(monitored()).rejects.toThrow('db down');

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should record the configured query name for all invocations', async () => {
      const fn = async () => 'ok';
      const monitored = createMonitoredQuery('named-query', fn);

      await monitored();
      await monitored();

      const byName = getQueriesByName('named-query');
      expect(byName).toHaveLength(2);
    });
  });

  // ── measureQuery ──────────────────────────────────────────────────

  describe('measureQuery', () => {
    it('should return the result and duration', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1075);

      const { result, duration } = await measureQuery(async () => 'measured');
      expect(result).toBe('measured');
      expect(duration).toBe(75);
    });

    it('should not record to the query metrics store', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1050);

      await measureQuery(async () => 'standalone');

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(0);
    });
  });

  // ── exportMetrics ─────────────────────────────────────────────────

  describe('exportMetrics', () => {
    it('should export current metrics with timestamp', () => {
      vi.spyOn(Date, 'now').mockReturnValue(9999);

      const exported = exportMetrics();
      expect(exported.timestamp).toBe(9999);
      expect(exported.queries.totalQueries).toBe(0);
      expect(exported.queries.percentiles).toEqual({ p50: 0, p95: 0, p99: 0 });
      expect(exported.slowQueries).toBe(0);
    });

    it('should reflect recorded data in the export', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1050);
      await monitorQuery('export-test', async () => null);

      logSlowQuery('slow one', 300);

      dateNowSpy.mockReturnValue(8000);
      const exported = exportMetrics();

      expect(exported.queries.totalQueries).toBe(1);
      expect(exported.slowQueries).toBe(1);
      expect(exported.timestamp).toBe(8000);
    });
  });

  // ── Concurrent monitoring ─────────────────────────────────────────

  describe('concurrent monitoring', () => {
    it('should correctly track multiple concurrent queries', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now');
      let callCount = 0;
      dateNowSpy.mockImplementation(() => {
        callCount++;
        // Simulate different start/end times for concurrent queries
        // Calls: start1, start2, start3, end1, end2, end3
        const times = [1000, 1000, 1000, 1020, 1050, 1080];
        return times[callCount - 1] ?? 2000;
      });

      const results = await Promise.all([
        monitorQuery('concurrent-1', async () => 'a'),
        monitorQuery('concurrent-2', async () => 'b'),
        monitorQuery('concurrent-3', async () => 'c'),
      ]);

      expect(results).toEqual(['a', 'b', 'c']);

      const stats = getQueryStats();
      expect(stats.totalQueries).toBe(3);
      expect(stats.successRate).toBe(100);
    });
  });
});
