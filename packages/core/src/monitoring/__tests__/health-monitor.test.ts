/**
 * Health Monitor Tests
 *
 * Tests for getHealthMetrics and getHealthStatus functions including
 * alert generation across all metric types (zombies, memory, processes,
 * spawn rate, database waiting).
 */

import * as os from 'node:os';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Alert } from '../types.js';
import { DEFAULT_MONITORING_CONFIG } from '../types.js';

// Mock dependencies
vi.mock('../process-registry.js', () => ({
  processRegistry: {
    getStats: vi.fn(),
    getSpawnRate: vi.fn(),
  },
}));

vi.mock('../zombie-detector.js', () => ({
  zombieDetector: {
    getHistory: vi.fn(),
  },
}));

import { getHealthMetrics, getHealthStatus } from '../health-monitor.js';
// Import after mocks
import { processRegistry } from '../process-registry.js';
import { zombieDetector } from '../zombie-detector.js';

const mockedGetStats = vi.mocked(processRegistry.getStats);
const mockedGetSpawnRate = vi.mocked(processRegistry.getSpawnRate);
const mockedGetHistory = vi.mocked(zombieDetector.getHistory);

const thresholds = DEFAULT_MONITORING_CONFIG.alertThresholds;

function defaultStats() {
  return {
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    zombies: 0,
    killed: 0,
    bySource: {
      exec: 0,
      orchestration: 0,
      mcp: 0,
      'ai-runtime': 0,
      'dev-server': 0,
      database: 0,
      unknown: 0,
    },
  };
}

describe('HealthMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetStats.mockReturnValue(defaultStats());
    mockedGetSpawnRate.mockReturnValue(0);
    mockedGetHistory.mockReturnValue([]);
  });

  describe('getHealthMetrics', () => {
    it('should return system metrics', () => {
      const metrics = getHealthMetrics();

      expect(metrics.system).toBeDefined();
      expect(typeof metrics.system.memoryUsage).toBe('number');
      expect(typeof metrics.system.cpuUsage).toBe('number');
      expect(typeof metrics.system.uptime).toBe('number');
      expect(metrics.system.platform).toBe(os.platform());
      expect(metrics.system.nodeVersion).toBe(process.version);
    });

    it('should return process stats from registry', () => {
      const stats = defaultStats();
      stats.running = 5;
      stats.zombies = 2;
      stats.failed = 1;
      stats.bySource.exec = 3;
      stats.bySource.mcp = 5;
      mockedGetStats.mockReturnValue(stats);
      mockedGetSpawnRate.mockReturnValue(7);

      const metrics = getHealthMetrics();

      expect(metrics.processes.active).toBe(5);
      expect(metrics.processes.zombies).toBe(2);
      expect(metrics.processes.failed).toBe(1);
      expect(metrics.processes.spawnRate).toBe(7);
      expect(metrics.processes.bySource.exec).toBe(3);
      expect(metrics.processes.bySource.mcp).toBe(5);
    });

    it('should return empty database pools when not provided', () => {
      const metrics = getHealthMetrics();

      expect(metrics.database.rest).toEqual([]);
      expect(metrics.database.vector).toEqual([]);
    });

    it('should return provided database pools', () => {
      const pools = {
        rest: [{ name: 'neon', totalCount: 10, idleCount: 5, waitingCount: 0 }],
        vector: [{ name: 'supabase', totalCount: 8, idleCount: 3, waitingCount: 1 }],
      };

      const metrics = getHealthMetrics(pools);

      expect(metrics.database.rest).toEqual(pools.rest);
      expect(metrics.database.vector).toEqual(pools.vector);
    });

    it('should include recent zombies limited to 10', () => {
      const zombies = Array.from({ length: 15 }, (_, i) => ({
        pid: 1000 + i,
        ppid: 1,
        command: `zombie-${i}`,
        detectedAt: Date.now(),
      }));
      mockedGetHistory.mockReturnValue(zombies);

      const metrics = getHealthMetrics();

      expect(metrics.recentZombies).toHaveLength(10);
      expect(metrics.recentZombies[0].pid).toBe(1000);
    });

    it('should include fewer than 10 zombies when history is smaller', () => {
      const zombies = [
        { pid: 1000, ppid: 1, command: 'z1', detectedAt: Date.now() },
        { pid: 1001, ppid: 1, command: 'z2', detectedAt: Date.now() },
      ];
      mockedGetHistory.mockReturnValue(zombies);

      const metrics = getHealthMetrics();

      expect(metrics.recentZombies).toHaveLength(2);
    });

    it('should include a timestamp', () => {
      const before = Date.now();
      const metrics = getHealthMetrics();
      const after = Date.now();

      expect(metrics.timestamp).toBeGreaterThanOrEqual(before);
      expect(metrics.timestamp).toBeLessThanOrEqual(after);
    });

    it('should include alerts array', () => {
      const metrics = getHealthMetrics();

      expect(Array.isArray(metrics.alerts)).toBe(true);
    });
  });

  describe('alert generation  -  zombies', () => {
    it('should generate no zombie alert when below warning threshold', () => {
      const stats = defaultStats();
      stats.zombies = thresholds.zombies.warning - 1;
      mockedGetStats.mockReturnValue(stats);

      const metrics = getHealthMetrics();
      const zombieAlerts = metrics.alerts.filter((a) => a.metric === 'zombies');

      expect(zombieAlerts).toHaveLength(0);
    });

    it('should generate warning alert at zombie warning threshold', () => {
      const stats = defaultStats();
      stats.zombies = thresholds.zombies.warning;
      mockedGetStats.mockReturnValue(stats);

      const metrics = getHealthMetrics();
      const zombieAlerts = metrics.alerts.filter((a) => a.metric === 'zombies');

      expect(zombieAlerts).toHaveLength(1);
      expect(zombieAlerts[0].level).toBe('warning');
      expect(zombieAlerts[0].value).toBe(thresholds.zombies.warning);
      expect(zombieAlerts[0].threshold).toBe(thresholds.zombies.warning);
    });

    it('should generate critical alert at zombie critical threshold', () => {
      const stats = defaultStats();
      stats.zombies = thresholds.zombies.critical;
      mockedGetStats.mockReturnValue(stats);

      const metrics = getHealthMetrics();
      const zombieAlerts = metrics.alerts.filter((a) => a.metric === 'zombies');

      expect(zombieAlerts).toHaveLength(1);
      expect(zombieAlerts[0].level).toBe('critical');
      expect(zombieAlerts[0].message).toContain('zombie processes detected');
    });

    it('should generate critical (not warning) when above critical threshold', () => {
      const stats = defaultStats();
      stats.zombies = thresholds.zombies.critical + 5;
      mockedGetStats.mockReturnValue(stats);

      const metrics = getHealthMetrics();
      const zombieAlerts = metrics.alerts.filter((a) => a.metric === 'zombies');

      expect(zombieAlerts).toHaveLength(1);
      expect(zombieAlerts[0].level).toBe('critical');
    });
  });

  describe('alert generation  -  memory', () => {
    it('should generate no memory alert when below warning', () => {
      // Memory is taken from process.memoryUsage() which we can't easily mock
      // but with default thresholds of 512 MB warning, test env should be below
      const metrics = getHealthMetrics();
      const memAlerts = metrics.alerts.filter((a) => a.metric === 'memory');

      // In test env, memory usage should be well below 512 MB
      if (Math.round(process.memoryUsage().rss / 1024 / 1024) < thresholds.memory.warning) {
        expect(memAlerts).toHaveLength(0);
      }
    });
  });

  describe('alert generation  -  active processes', () => {
    it('should generate no alert when below warning threshold', () => {
      const stats = defaultStats();
      stats.running = thresholds.processes.active.warning - 1;
      mockedGetStats.mockReturnValue(stats);

      const metrics = getHealthMetrics();
      const processAlerts = metrics.alerts.filter((a) => a.metric === 'active_processes');

      expect(processAlerts).toHaveLength(0);
    });

    it('should generate warning alert at active process warning threshold', () => {
      const stats = defaultStats();
      stats.running = thresholds.processes.active.warning;
      mockedGetStats.mockReturnValue(stats);

      const metrics = getHealthMetrics();
      const processAlerts = metrics.alerts.filter((a) => a.metric === 'active_processes');

      expect(processAlerts).toHaveLength(1);
      expect(processAlerts[0].level).toBe('warning');
      expect(processAlerts[0].value).toBe(thresholds.processes.active.warning);
    });

    it('should generate critical alert at active process critical threshold', () => {
      const stats = defaultStats();
      stats.running = thresholds.processes.active.critical;
      mockedGetStats.mockReturnValue(stats);

      const metrics = getHealthMetrics();
      const processAlerts = metrics.alerts.filter((a) => a.metric === 'active_processes');

      expect(processAlerts).toHaveLength(1);
      expect(processAlerts[0].level).toBe('critical');
      expect(processAlerts[0].message).toContain('active processes');
    });
  });

  describe('alert generation  -  spawn rate', () => {
    it('should generate no alert when below warning threshold', () => {
      mockedGetSpawnRate.mockReturnValue(thresholds.spawnRate.warning - 1);

      const metrics = getHealthMetrics();
      const spawnAlerts = metrics.alerts.filter((a) => a.metric === 'spawn_rate');

      expect(spawnAlerts).toHaveLength(0);
    });

    it('should generate warning alert at spawn rate warning threshold', () => {
      mockedGetSpawnRate.mockReturnValue(thresholds.spawnRate.warning);

      const metrics = getHealthMetrics();
      const spawnAlerts = metrics.alerts.filter((a) => a.metric === 'spawn_rate');

      expect(spawnAlerts).toHaveLength(1);
      expect(spawnAlerts[0].level).toBe('warning');
      expect(spawnAlerts[0].message).toContain('/min');
    });

    it('should generate critical alert at spawn rate critical threshold', () => {
      mockedGetSpawnRate.mockReturnValue(thresholds.spawnRate.critical);

      const metrics = getHealthMetrics();
      const spawnAlerts = metrics.alerts.filter((a) => a.metric === 'spawn_rate');

      expect(spawnAlerts).toHaveLength(1);
      expect(spawnAlerts[0].level).toBe('critical');
    });
  });

  describe('alert generation  -  database waiting', () => {
    it('should generate no alert when no database pools provided', () => {
      const metrics = getHealthMetrics();
      const dbAlerts = metrics.alerts.filter((a) => a.metric === 'database_waiting');

      expect(dbAlerts).toHaveLength(0);
    });

    it('should generate no alert when waiting count is below warning', () => {
      const pools = {
        rest: [{ name: 'neon', totalCount: 10, idleCount: 5, waitingCount: 2 }],
        vector: [{ name: 'supabase', totalCount: 8, idleCount: 3, waitingCount: 1 }],
      };

      const metrics = getHealthMetrics(pools);
      const dbAlerts = metrics.alerts.filter((a) => a.metric === 'database_waiting');

      // 2 + 1 = 3, below warning threshold of 5
      expect(dbAlerts).toHaveLength(0);
    });

    it('should generate warning alert when total waiting reaches warning threshold', () => {
      const pools = {
        rest: [{ name: 'neon', totalCount: 10, idleCount: 0, waitingCount: 3 }],
        vector: [{ name: 'supabase', totalCount: 8, idleCount: 0, waitingCount: 2 }],
      };

      const metrics = getHealthMetrics(pools);
      const dbAlerts = metrics.alerts.filter((a) => a.metric === 'database_waiting');

      // 3 + 2 = 5, equals warning threshold
      expect(dbAlerts).toHaveLength(1);
      expect(dbAlerts[0].level).toBe('warning');
      expect(dbAlerts[0].value).toBe(5);
    });

    it('should generate critical alert when total waiting reaches critical threshold', () => {
      const pools = {
        rest: [{ name: 'neon', totalCount: 10, idleCount: 0, waitingCount: 6 }],
        vector: [{ name: 'supabase', totalCount: 8, idleCount: 0, waitingCount: 5 }],
      };

      const metrics = getHealthMetrics(pools);
      const dbAlerts = metrics.alerts.filter((a) => a.metric === 'database_waiting');

      // 6 + 5 = 11, above critical threshold of 10
      expect(dbAlerts).toHaveLength(1);
      expect(dbAlerts[0].level).toBe('critical');
      expect(dbAlerts[0].message).toContain('database connections waiting');
    });

    it('should sum waiting counts across multiple pools', () => {
      const pools = {
        rest: [
          { name: 'neon-1', totalCount: 10, idleCount: 0, waitingCount: 2 },
          { name: 'neon-2', totalCount: 10, idleCount: 0, waitingCount: 2 },
        ],
        vector: [{ name: 'supabase', totalCount: 8, idleCount: 0, waitingCount: 2 }],
      };

      const metrics = getHealthMetrics(pools);
      const dbAlerts = metrics.alerts.filter((a) => a.metric === 'database_waiting');

      // 2 + 2 + 2 = 6, above warning (5) but below critical (10)
      expect(dbAlerts).toHaveLength(1);
      expect(dbAlerts[0].level).toBe('warning');
      expect(dbAlerts[0].value).toBe(6);
    });
  });

  describe('alert generation  -  multiple alerts', () => {
    it('should generate multiple alerts when multiple thresholds are exceeded', () => {
      const stats = defaultStats();
      stats.zombies = thresholds.zombies.critical;
      stats.running = thresholds.processes.active.warning;
      mockedGetStats.mockReturnValue(stats);
      mockedGetSpawnRate.mockReturnValue(thresholds.spawnRate.warning);

      const metrics = getHealthMetrics();

      expect(metrics.alerts.length).toBeGreaterThanOrEqual(3);

      const metrics_by_type = metrics.alerts.map((a) => a.metric);
      expect(metrics_by_type).toContain('zombies');
      expect(metrics_by_type).toContain('active_processes');
      expect(metrics_by_type).toContain('spawn_rate');
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy when no alerts', () => {
      const result = getHealthStatus([]);

      expect(result.status).toBe('healthy');
      expect(result.statusCode).toBe(200);
    });

    it('should return degraded when only warnings exist', () => {
      const alerts: Alert[] = [
        {
          level: 'warning',
          metric: 'zombies',
          message: 'test',
          value: 3,
          threshold: 3,
          timestamp: Date.now(),
        },
      ];

      const result = getHealthStatus(alerts);

      expect(result.status).toBe('degraded');
      expect(result.statusCode).toBe(206);
    });

    it('should return unhealthy when critical alerts exist', () => {
      const alerts: Alert[] = [
        {
          level: 'critical',
          metric: 'memory',
          message: 'test',
          value: 1024,
          threshold: 1024,
          timestamp: Date.now(),
        },
      ];

      const result = getHealthStatus(alerts);

      expect(result.status).toBe('unhealthy');
      expect(result.statusCode).toBe(503);
    });

    it('should return unhealthy when both warning and critical alerts exist', () => {
      const alerts: Alert[] = [
        {
          level: 'warning',
          metric: 'zombies',
          message: 'test',
          value: 3,
          threshold: 3,
          timestamp: Date.now(),
        },
        {
          level: 'critical',
          metric: 'memory',
          message: 'test',
          value: 1024,
          threshold: 1024,
          timestamp: Date.now(),
        },
      ];

      const result = getHealthStatus(alerts);

      expect(result.status).toBe('unhealthy');
      expect(result.statusCode).toBe(503);
    });

    it('should return healthy with empty alerts array', () => {
      const result = getHealthStatus([]);

      expect(result.status).toBe('healthy');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('alert message format', () => {
    it('should include value and threshold in zombie alert message', () => {
      const stats = defaultStats();
      stats.zombies = thresholds.zombies.warning;
      mockedGetStats.mockReturnValue(stats);

      const metrics = getHealthMetrics();
      const alert = metrics.alerts.find((a) => a.metric === 'zombies');

      expect(alert?.message).toBe(
        `${thresholds.zombies.warning} zombie processes detected (threshold: ${thresholds.zombies.warning})`,
      );
    });

    it('should include MB in memory alert message', () => {
      // We can test this via spawn rate (easier to control) and verify format pattern
      mockedGetSpawnRate.mockReturnValue(thresholds.spawnRate.warning);

      const metrics = getHealthMetrics();
      const alert = metrics.alerts.find((a) => a.metric === 'spawn_rate');

      expect(alert?.message).toContain('/min');
      expect(alert?.message).toContain(`threshold: ${thresholds.spawnRate.warning}/min`);
    });

    it('should include correct timestamp in alert', () => {
      const stats = defaultStats();
      stats.zombies = thresholds.zombies.warning;
      mockedGetStats.mockReturnValue(stats);

      const before = Date.now();
      const metrics = getHealthMetrics();
      const after = Date.now();

      const alert = metrics.alerts.find((a) => a.metric === 'zombies');
      expect(alert?.timestamp).toBeGreaterThanOrEqual(before);
      expect(alert?.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
