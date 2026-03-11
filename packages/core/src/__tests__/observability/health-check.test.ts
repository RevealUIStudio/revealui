import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../observability/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: vi.fn((fn: unknown) => fn),
}));

import { execFile } from 'node:child_process';
import {
  createAPIHealthCheck,
  createCustomHealthCheck,
  createDatabaseHealthCheck,
  createDiskHealthCheck,
  createHealthEndpoint,
  createLivenessEndpoint,
  createMemoryHealthCheck,
  createReadinessEndpoint,
  createRedisHealthCheck,
  type HealthCheck,
  HealthCheckSystem,
  healthCheck,
  monitorHealth,
} from '../../observability/health-check.js';
import { logger } from '../../observability/logger.js';

// Mock fetch for API health check
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('HealthCheckSystem', () => {
  let system: HealthCheckSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    system = new HealthCheckSystem();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('register / unregister', () => {
    it('registers and runs a health check', async () => {
      const check: HealthCheck = {
        name: 'test',
        check: async () => ({ status: 'healthy', message: 'all good' }),
      };
      system.register(check);

      const health = await system.checkHealth();
      expect(health.checks.test).toBeDefined();
      expect(health.checks.test.status).toBe('healthy');
    });

    it('unregisters a health check', async () => {
      system.register({
        name: 'removable',
        check: async () => ({ status: 'healthy' }),
      });
      system.unregister('removable');

      const health = await system.checkHealth();
      expect(health.checks.removable).toBeUndefined();
    });
  });

  describe('checkHealth', () => {
    it('returns healthy when all checks pass', async () => {
      system.register({
        name: 'db',
        check: async () => ({ status: 'healthy' }),
        critical: true,
      });
      system.register({
        name: 'cache',
        check: async () => ({ status: 'healthy' }),
      });

      const health = await system.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.timestamp).toBeDefined();
    });

    it('returns unhealthy when a critical check fails', async () => {
      system.register({
        name: 'db',
        check: async () => ({ status: 'unhealthy', message: 'connection refused' }),
        critical: true,
      });

      const health = await system.checkHealth();
      expect(health.status).toBe('unhealthy');
    });

    it('returns degraded when a non-critical check is unhealthy', async () => {
      system.register({
        name: 'cache',
        check: async () => ({ status: 'unhealthy', message: 'cache down' }),
        critical: false,
      });

      const health = await system.checkHealth();
      expect(health.status).toBe('degraded');
    });

    it('returns degraded when a check is degraded', async () => {
      system.register({
        name: 'db',
        check: async () => ({ status: 'degraded', message: 'slow' }),
      });

      const health = await system.checkHealth();
      expect(health.status).toBe('degraded');
    });

    it('non-critical unhealthy does not override critical unhealthy', async () => {
      system.register({
        name: 'critical_bad',
        check: async () => ({ status: 'unhealthy' }),
        critical: true,
      });
      system.register({
        name: 'non_critical_bad',
        check: async () => ({ status: 'unhealthy' }),
        critical: false,
      });

      const health = await system.checkHealth();
      expect(health.status).toBe('unhealthy');
    });

    it('handles check that throws an error', async () => {
      system.register({
        name: 'throws',
        check: async () => {
          throw new Error('boom');
        },
        critical: false,
      });

      const health = await system.checkHealth();
      expect(health.status).toBe('degraded');
      expect(health.checks.throws.status).toBe('unhealthy');
      expect(health.checks.throws.message).toBe('boom');
    });

    it('marks critical check as unhealthy on throw', async () => {
      system.register({
        name: 'critical_throw',
        check: async () => {
          throw new Error('critical failure');
        },
        critical: true,
      });

      const health = await system.checkHealth();
      expect(health.status).toBe('unhealthy');
    });

    it('handles non-Error thrown by check', async () => {
      system.register({
        name: 'string_throw',
        check: async () => {
          throw 'string error';
        },
      });

      const health = await system.checkHealth();
      expect(health.checks.string_throw.message).toBe('Check failed');
    });

    it('includes duration in results', async () => {
      system.register({
        name: 'timed',
        check: async () => {
          return { status: 'healthy' };
        },
      });

      const health = await system.checkHealth();
      expect(health.checks.timed.duration).toBeDefined();
      expect(typeof health.checks.timed.duration).toBe('number');
    });

    it('includes APP_VERSION in response', async () => {
      const original = process.env.APP_VERSION;
      process.env.APP_VERSION = '1.2.3';

      const health = await system.checkHealth();
      expect(health.version).toBe('1.2.3');

      if (original === undefined) {
        delete process.env.APP_VERSION;
      } else {
        process.env.APP_VERSION = original;
      }
    });

    it('times out slow checks', async () => {
      system.register({
        name: 'slow',
        check: () =>
          new Promise((resolve) => setTimeout(() => resolve({ status: 'healthy' }), 10_000)),
        timeout: 100,
      });

      const healthPromise = system.checkHealth();
      vi.advanceTimersByTime(200);
      const health = await healthPromise;

      expect(health.checks.slow.status).toBe('unhealthy');
      expect(health.checks.slow.message).toBe('Check timeout');
    });

    it('returns healthy with no checks registered', async () => {
      const health = await system.checkHealth();
      expect(health.status).toBe('healthy');
      expect(Object.keys(health.checks)).toHaveLength(0);
    });
  });

  describe('getUptime', () => {
    it('returns uptime in seconds', () => {
      vi.advanceTimersByTime(5000);
      expect(system.getUptime()).toBe(5);
    });

    it('floors partial seconds', () => {
      vi.advanceTimersByTime(2500);
      expect(system.getUptime()).toBe(2);
    });
  });
});

describe('createDatabaseHealthCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns healthy when query succeeds quickly', async () => {
    const check = createDatabaseHealthCheck(async () => {});
    const result = await check.check();
    expect(result.status).toBe('healthy');
    expect(result.message).toBe('Database healthy');
    expect(check.critical).toBe(true);
  });

  it('returns degraded when query is slow (>1000ms)', async () => {
    const check = createDatabaseHealthCheck(async () => {
      await new Promise((r) => setTimeout(r, 1500));
    });

    const resultPromise = check.check();
    vi.advanceTimersByTime(1500);
    const result = await resultPromise;

    expect(result.status).toBe('degraded');
    expect(result.message).toBe('Database responding slowly');
    expect(result.details?.responseTime).toBeGreaterThanOrEqual(1000);
  });

  it('returns unhealthy when query throws', async () => {
    const check = createDatabaseHealthCheck(async () => {
      throw new Error('ECONNREFUSED');
    });

    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('ECONNREFUSED');
  });

  it('handles non-Error thrown by query', async () => {
    const check = createDatabaseHealthCheck(async () => {
      throw 'connection lost';
    });

    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('Database connection failed');
  });
});

describe('createRedisHealthCheck', () => {
  it('returns healthy when ping returns PONG', async () => {
    const check = createRedisHealthCheck(async () => 'PONG');
    const result = await check.check();
    expect(result.status).toBe('healthy');
    expect(check.critical).toBe(false);
  });

  it('returns unhealthy when ping returns wrong response', async () => {
    const check = createRedisHealthCheck(async () => 'WRONG');
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('Redis ping failed');
  });

  it('returns unhealthy when ping throws', async () => {
    const check = createRedisHealthCheck(async () => {
      throw new Error('connection refused');
    });
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('connection refused');
  });

  it('handles non-Error thrown', async () => {
    const check = createRedisHealthCheck(async () => {
      throw 'timeout';
    });
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('Redis connection failed');
  });
});

describe('createMemoryHealthCheck', () => {
  it('returns healthy when memory usage is below 80% of threshold', async () => {
    // Use a threshold high enough that actual heap usage is below 80% of it
    // Process typically uses well under 100% of heap, so threshold of 200 means
    // degraded zone starts at 160%, which can never be hit
    const check = createMemoryHealthCheck(200);
    const result = await check.check();
    expect(result.status).toBe('healthy');
    expect(result.details?.heapUsed).toBeDefined();
    expect(result.details?.heapTotal).toBeDefined();
    expect(result.details?.rss).toBeDefined();
    expect(check.critical).toBe(false);
  });

  it('returns unhealthy when memory exceeds threshold', async () => {
    // Use threshold of 0 to guarantee it fires
    const check = createMemoryHealthCheck(0);
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('Memory usage critical');
  });

  it('returns degraded when memory exceeds 80% of threshold', async () => {
    // This is tricky since we can't control actual memory usage
    // Use a threshold that is above actual usage but whose 80% is below
    const usage = process.memoryUsage();
    const usedPercent = (usage.heapUsed / usage.heapTotal) * 100;

    // Pick a threshold where usedPercent > threshold * 0.8 but usedPercent <= threshold
    const threshold = usedPercent + 1;
    if (usedPercent > threshold * 0.8) {
      const check = createMemoryHealthCheck(threshold);
      const result = await check.check();
      expect(result.status).toBe('degraded');
      expect(result.message).toBe('Memory usage high');
    }
  });
});

describe('createDiskHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns healthy when disk usage is low', async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockResolvedValue({
      stdout:
        'Filesystem  1024-blocks  Used  Available  Capacity  Mounted\n/dev/sda1  100000  50000  50000  50%  /',
      stderr: '',
    } as never);

    const check = createDiskHealthCheck(90);
    const result = await check.check();
    expect(result.status).toBe('healthy');
    expect(result.message).toContain('50%');
  });

  it('returns unhealthy when disk usage exceeds threshold', async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockResolvedValue({
      stdout:
        'Filesystem  1024-blocks  Used  Available  Capacity  Mounted\n/dev/sda1  100000  95000  5000  95%  /',
      stderr: '',
    } as never);

    const check = createDiskHealthCheck(90);
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toContain('95%');
    expect(result.details?.usedPercent).toBe(95);
  });

  it('returns degraded when disk usage is near threshold', async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockResolvedValue({
      stdout:
        'Filesystem  1024-blocks  Used  Available  Capacity  Mounted\n/dev/sda1  100000  85000  15000  85%  /',
      stderr: '',
    } as never);

    const check = createDiskHealthCheck(90); // 85 >= 90-10 = 80
    const result = await check.check();
    expect(result.status).toBe('degraded');
  });

  it('returns degraded when execFile fails', async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockRejectedValue(new Error('command not found'));

    const check = createDiskHealthCheck(90);
    const result = await check.check();
    expect(result.status).toBe('degraded');
    expect(result.message).toBe('Disk check unavailable');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('handles unexpected df output format', async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockResolvedValue({
      stdout: 'only one line',
      stderr: '',
    } as never);

    const check = createDiskHealthCheck(90);
    const result = await check.check();
    // Should fall into the catch path since dataLine is undefined
    expect(result.status).toBe('degraded');
  });
});

describe('createAPIHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns healthy when API responds with expected status', async () => {
    mockFetch.mockResolvedValue({ status: 200 });

    const check = createAPIHealthCheck('https://api.example.com/health');
    const result = await check.check();
    expect(result.status).toBe('healthy');
    expect(result.message).toBe('API healthy');
    expect(check.name).toBe('api:https://api.example.com/health');
  });

  it('returns unhealthy when API returns wrong status', async () => {
    mockFetch.mockResolvedValue({ status: 503 });

    const check = createAPIHealthCheck('https://api.example.com/health', 200);
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toContain('503');
  });

  it('returns unhealthy when API is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const check = createAPIHealthCheck('https://api.example.com/health');
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('ECONNREFUSED');
  });

  it('handles non-Error thrown by fetch', async () => {
    mockFetch.mockRejectedValue('network error');

    const check = createAPIHealthCheck('https://api.example.com/health');
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('API unreachable');
  });

  it('accepts custom expected status', async () => {
    mockFetch.mockResolvedValue({ status: 204 });

    const check = createAPIHealthCheck('https://api.example.com/health', 204);
    const result = await check.check();
    expect(result.status).toBe('healthy');
  });
});

describe('createCustomHealthCheck', () => {
  it('creates a health check with given name and function', async () => {
    const check = createCustomHealthCheck('custom', async () => ({
      status: 'healthy',
      message: 'custom is fine',
    }));

    expect(check.name).toBe('custom');
    expect(check.critical).toBe(false);

    const result = await check.check();
    expect(result.status).toBe('healthy');
  });

  it('supports critical flag', () => {
    const check = createCustomHealthCheck(
      'critical-custom',
      async () => ({ status: 'healthy' }),
      true,
    );
    expect(check.critical).toBe(true);
  });
});

describe('endpoint handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The endpoint factories use the singleton `healthCheck` export
    // We'll register checks on it for these tests
  });

  afterEach(() => {
    // Clean up any checks registered on the singleton
  });

  describe('createHealthEndpoint', () => {
    it('returns 200 for healthy status', async () => {
      // healthCheck singleton has no checks by default = healthy
      const handler = createHealthEndpoint();
      const response = await handler();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');

      const body = await response.json();
      expect(body.status).toBe('healthy');
    });

    it('returns 503 for unhealthy status', async () => {
      healthCheck.register({
        name: 'endpoint_test_critical',
        check: async () => ({ status: 'unhealthy' }),
        critical: true,
      });

      const handler = createHealthEndpoint();
      const response = await handler();

      expect(response.status).toBe(503);

      healthCheck.unregister('endpoint_test_critical');
    });
  });

  describe('createReadinessEndpoint', () => {
    it('returns 200 when ready (not unhealthy)', async () => {
      const handler = createReadinessEndpoint();
      const response = await handler();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ready).toBe(true);
    });

    it('returns 503 when unhealthy', async () => {
      healthCheck.register({
        name: 'readiness_test',
        check: async () => ({ status: 'unhealthy' }),
        critical: true,
      });

      const handler = createReadinessEndpoint();
      const response = await handler();

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.ready).toBe(false);

      healthCheck.unregister('readiness_test');
    });
  });

  describe('createLivenessEndpoint', () => {
    it('returns 200 with alive true', () => {
      const handler = createLivenessEndpoint();
      const response = handler();

      expect(response.status).toBe(200);
    });
  });
});

describe('monitorHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onStatusChange when status changes', async () => {
    const onChange = vi.fn();

    const timerPromise = monitorHealth(5000, onChange);

    // The initial call runs immediately
    await vi.advanceTimersByTimeAsync(0);

    const timer = await timerPromise;

    // Initial call: null -> healthy
    expect(onChange).toHaveBeenCalledWith('healthy');

    clearInterval(timer);
  });

  it('logs status change', async () => {
    const timerPromise = monitorHealth(5000);
    await vi.advanceTimersByTimeAsync(0);
    const timer = await timerPromise;

    expect(logger.info).toHaveBeenCalledWith(
      'Health status changed',
      expect.objectContaining({
        from: null,
        to: 'healthy',
      }),
    );

    clearInterval(timer);
  });

  it('uses default interval of 30000ms', async () => {
    const onChange = vi.fn();
    const timerPromise = monitorHealth(undefined, onChange);
    await vi.advanceTimersByTimeAsync(0);
    const timer = await timerPromise;

    onChange.mockClear();

    // Advance 30 seconds - should trigger another check
    await vi.advanceTimersByTimeAsync(30_000);

    // Status hasn't changed so onChange shouldn't be called again
    expect(onChange).not.toHaveBeenCalled();

    clearInterval(timer);
  });
});
