import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../observability/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  type Alert,
  type AlertChannel,
  AlertingSystem,
  type AlertRule,
  consoleChannel,
  createCacheHitRateAlert,
  createDatabaseAlert,
  createDiskSpaceAlert,
  createEmailChannel,
  createErrorRateAlert,
  createMemoryUsageAlert,
  createMetricAlert,
  createQueueSizeAlert,
  createResponseTimeAlert,
  createServiceHealthAlert,
  createSlackChannel,
  createWebhookChannel,
} from '../../observability/alerts.js';
import { logger } from '../../observability/logger.js';

describe('AlertingSystem', () => {
  let system: AlertingSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    system = new AlertingSystem();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registerRule / unregisterRule', () => {
    it('registers and unregisters a rule', async () => {
      const rule: AlertRule = {
        name: 'test_rule',
        severity: 'warning',
        condition: () => true,
        message: 'Test alert fired',
      };

      system.registerRule(rule);

      const channel: AlertChannel = { name: 'spy', send: vi.fn().mockResolvedValue(undefined) };
      system.addChannel(channel);

      await system.evaluateRules();
      expect(channel.send).toHaveBeenCalledOnce();

      system.unregisterRule('test_rule');
      vi.clearAllMocks();

      await system.evaluateRules();
      expect(channel.send).not.toHaveBeenCalled();
    });
  });

  describe('addChannel', () => {
    it('sends alerts to all matching channels', async () => {
      const rule: AlertRule = {
        name: 'test',
        severity: 'error',
        condition: () => true,
        message: 'boom',
      };
      system.registerRule(rule);

      const ch1: AlertChannel = { name: 'ch1', send: vi.fn().mockResolvedValue(undefined) };
      const ch2: AlertChannel = { name: 'ch2', send: vi.fn().mockResolvedValue(undefined) };
      system.addChannel(ch1);
      system.addChannel(ch2);

      await system.evaluateRules();

      expect(ch1.send).toHaveBeenCalledOnce();
      expect(ch2.send).toHaveBeenCalledOnce();
    });

    it('respects channel severity filter', async () => {
      const rule: AlertRule = {
        name: 'info_rule',
        severity: 'info',
        condition: () => true,
        message: 'info alert',
      };
      system.registerRule(rule);

      const errorOnly: AlertChannel = {
        name: 'errors',
        severities: ['error', 'critical'],
        send: vi.fn().mockResolvedValue(undefined),
      };
      const allSeverities: AlertChannel = {
        name: 'all',
        send: vi.fn().mockResolvedValue(undefined),
      };

      system.addChannel(errorOnly);
      system.addChannel(allSeverities);

      await system.evaluateRules();

      expect(errorOnly.send).not.toHaveBeenCalled();
      expect(allSeverities.send).toHaveBeenCalledOnce();
    });
  });

  describe('evaluateRules', () => {
    it('skips disabled rules', async () => {
      const rule: AlertRule = {
        name: 'disabled',
        severity: 'warning',
        condition: () => true,
        message: 'should not fire',
        enabled: false,
      };
      system.registerRule(rule);

      const channel: AlertChannel = { name: 'spy', send: vi.fn().mockResolvedValue(undefined) };
      system.addChannel(channel);

      await system.evaluateRules();
      expect(channel.send).not.toHaveBeenCalled();
    });

    it('handles async condition functions', async () => {
      const rule: AlertRule = {
        name: 'async_rule',
        severity: 'critical',
        condition: async () => true,
        message: 'async fired',
      };
      system.registerRule(rule);

      const channel: AlertChannel = { name: 'spy', send: vi.fn().mockResolvedValue(undefined) };
      system.addChannel(channel);

      await system.evaluateRules();
      expect(channel.send).toHaveBeenCalledOnce();
    });

    it('logs error when condition throws', async () => {
      const rule: AlertRule = {
        name: 'broken',
        severity: 'warning',
        condition: () => {
          throw new Error('condition failed');
        },
        message: 'wont fire',
      };
      system.registerRule(rule);

      await system.evaluateRules();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to evaluate alert rule',
        expect.any(Error),
        { ruleName: 'broken' },
      );
    });

    it('logs error when condition throws a non-Error value', async () => {
      const rule: AlertRule = {
        name: 'broken_string',
        severity: 'warning',
        condition: () => {
          throw 'string error';
        },
        message: 'wont fire',
      };
      system.registerRule(rule);

      await system.evaluateRules();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to evaluate alert rule',
        expect.any(Error),
        { ruleName: 'broken_string' },
      );
    });
  });

  describe('fireAlert / resolveAlert lifecycle', () => {
    it('fires an alert when condition is true', async () => {
      const channel: AlertChannel = { name: 'spy', send: vi.fn().mockResolvedValue(undefined) };
      system.addChannel(channel);

      system.registerRule({
        name: 'test_alert',
        severity: 'error',
        condition: () => true,
        message: 'test message',
        labels: { env: 'test' },
      });

      await system.evaluateRules();

      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test_alert',
          severity: 'error',
          status: 'firing',
          message: 'test message',
          labels: { env: 'test' },
        }),
      );
      expect(system.getActiveAlerts()).toHaveLength(1);
      expect(system.getAlert('test_alert')).toBeDefined();
    });

    it('resolves a firing alert when condition becomes false', async () => {
      let shouldFire = true;
      const channel: AlertChannel = { name: 'spy', send: vi.fn().mockResolvedValue(undefined) };
      system.addChannel(channel);

      system.registerRule({
        name: 'resolve_test',
        severity: 'warning',
        condition: () => shouldFire,
        message: 'resolvable',
      });

      // Fire
      await system.evaluateRules();
      expect(system.getActiveAlerts()).toHaveLength(1);

      // Resolve
      shouldFire = false;
      await system.evaluateRules();

      expect(system.getActiveAlerts()).toHaveLength(0);
      // 2 calls: fire + resolve
      expect(channel.send).toHaveBeenCalledTimes(2);
      expect(channel.send).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'resolved',
          resolvedAt: expect.any(String),
        }),
      );
    });

    it('does not re-fire an already-active alert', async () => {
      const channel: AlertChannel = { name: 'spy', send: vi.fn().mockResolvedValue(undefined) };
      system.addChannel(channel);

      system.registerRule({
        name: 'no_repeat',
        severity: 'warning',
        condition: () => true,
        message: 'no repeat',
      });

      await system.evaluateRules();
      await system.evaluateRules();
      await system.evaluateRules();

      // Should only fire once since it's already active
      expect(channel.send).toHaveBeenCalledOnce();
    });

    it('uses function message when message is a function', async () => {
      const channel: AlertChannel = { name: 'spy', send: vi.fn().mockResolvedValue(undefined) };
      system.addChannel(channel);

      system.registerRule({
        name: 'fn_message',
        severity: 'info',
        condition: () => true,
        message: () => 'dynamic message',
      });

      await system.evaluateRules();

      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'dynamic message' }),
      );
    });
  });

  describe('cooldown', () => {
    it('respects cooldown period between firings', async () => {
      let shouldFire = true;
      const sentAlerts: Alert[] = [];
      const channel: AlertChannel = {
        name: 'spy',
        send: vi.fn().mockImplementation(async (alert: Alert) => {
          sentAlerts.push({ ...alert });
        }),
      };
      system.addChannel(channel);

      system.registerRule({
        name: 'cooldown_test',
        severity: 'warning',
        condition: () => shouldFire,
        message: 'cooldown test',
        cooldown: 60_000, // 1 minute
      });

      // First fire
      await system.evaluateRules();
      const firingCount = () => sentAlerts.filter((a) => a.status === 'firing').length;
      expect(firingCount()).toBe(1);

      // Resolve so activeAlerts is cleared
      shouldFire = false;
      await system.evaluateRules();
      // fire + resolve = 2 sends total
      expect(sentAlerts).toHaveLength(2);

      // Try to fire again within cooldown  -  should be blocked by lastFired
      shouldFire = true;
      await system.evaluateRules();
      expect(firingCount()).toBe(1); // still 1, cooldown blocked re-fire

      // Advance past cooldown
      vi.advanceTimersByTime(60_001);
      await system.evaluateRules();
      expect(firingCount()).toBe(2); // now 2
    });
  });

  describe('channel error handling', () => {
    it('logs error when channel send fails', async () => {
      const failingChannel: AlertChannel = {
        name: 'failing',
        send: vi.fn().mockRejectedValue(new Error('send failed')),
      };
      system.addChannel(failingChannel);

      system.registerRule({
        name: 'err_test',
        severity: 'error',
        condition: () => true,
        message: 'err test',
      });

      await system.evaluateRules();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send alert to channel',
        expect.any(Error),
        { channelName: 'failing' },
      );
    });

    it('handles non-Error thrown by channel', async () => {
      const failingChannel: AlertChannel = {
        name: 'failing_string',
        send: vi.fn().mockRejectedValue('string error'),
      };
      system.addChannel(failingChannel);

      system.registerRule({
        name: 'err_test_str',
        severity: 'error',
        condition: () => true,
        message: 'err test',
      });

      await system.evaluateRules();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send alert to channel',
        expect.any(Error),
        { channelName: 'failing_string' },
      );
    });
  });

  describe('getActiveAlerts / getAlert', () => {
    it('returns empty array when no alerts active', () => {
      expect(system.getActiveAlerts()).toEqual([]);
    });

    it('returns undefined for unknown alert', () => {
      expect(system.getAlert('nonexistent')).toBeUndefined();
    });
  });

  describe('startMonitoring', () => {
    it('calls evaluateRules at specified interval', async () => {
      let conditionCalled = 0;
      system.registerRule({
        name: 'interval_test',
        severity: 'info',
        condition: () => {
          conditionCalled++;
          return false;
        },
        message: 'interval',
      });

      const timer = system.startMonitoring(5000);

      // Advance one interval at a time and flush microtasks
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(5000);

      clearInterval(timer);

      expect(conditionCalled).toBeGreaterThanOrEqual(3);
    });

    it('uses default 60s interval', async () => {
      let conditionCalled = 0;
      system.registerRule({
        name: 'default_interval',
        severity: 'info',
        condition: () => {
          conditionCalled++;
          return false;
        },
        message: 'default',
      });

      const timer = system.startMonitoring();

      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(60_000);

      clearInterval(timer);
      // After 120s with 60s interval, condition should have been called at least twice
      expect(conditionCalled).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('consoleChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeAlert = (severity: Alert['severity'], status: Alert['status'] = 'firing'): Alert => ({
    id: 'test-id',
    name: 'test_alert',
    severity,
    status,
    message: 'Test message',
    details: { key: 'value' },
    timestamp: new Date().toISOString(),
  });

  it('logs critical alerts via logger.error', async () => {
    await consoleChannel.send(makeAlert('critical'));
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs error alerts via logger.error', async () => {
    await consoleChannel.send(makeAlert('error'));
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs warning alerts via logger.warn', async () => {
    await consoleChannel.send(makeAlert('warning'));
    expect(logger.warn).toHaveBeenCalled();
  });

  it('logs info alerts via logger.info', async () => {
    await consoleChannel.send(makeAlert('info'));
    expect(logger.info).toHaveBeenCalled();
  });

  it('includes RESOLVED in log for resolved alerts', async () => {
    await consoleChannel.send(makeAlert('info', 'resolved'));
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('RESOLVED'),
      expect.any(Object),
    );
  });
});

describe('createWebhookChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(new Response('ok'));
  });

  it('sends POST request with alert JSON', async () => {
    const channel = createWebhookChannel('https://hooks.example.com/alert');
    const alert = {
      id: 'test',
      name: 'test',
      severity: 'error' as const,
      status: 'firing' as const,
      message: 'Test',
      timestamp: new Date().toISOString(),
    };

    await channel.send(alert);

    expect(mockFetch).toHaveBeenCalledWith('https://hooks.example.com/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
  });

  it('sets severity filter', () => {
    const channel = createWebhookChannel('https://hooks.example.com', ['critical']);
    expect(channel.severities).toEqual(['critical']);
  });
});

describe('createEmailChannel', () => {
  it('sends email to all recipients with formatted body', async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const channel = createEmailChannel(sendFn, ['a@test.com', 'b@test.com'], ['error']);

    const alert: Alert = {
      id: 'test',
      name: 'db_down',
      severity: 'error',
      status: 'firing',
      message: 'Database is down',
      details: { host: 'localhost' },
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    await channel.send(alert);

    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(sendFn).toHaveBeenCalledWith(
      'a@test.com',
      '[ERROR] db_down',
      expect.stringContaining('Database is down'),
    );
    expect(sendFn).toHaveBeenCalledWith(
      'b@test.com',
      '[ERROR] db_down',
      expect.stringContaining('Database is down'),
    );
    expect(channel.severities).toEqual(['error']);
  });

  it('handles alert without details', async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const channel = createEmailChannel(sendFn, ['a@test.com']);

    const alert: Alert = {
      id: 'test',
      name: 'test',
      severity: 'warning',
      status: 'firing',
      message: 'No details',
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    await channel.send(alert);
    expect(sendFn).toHaveBeenCalledOnce();
  });
});

describe('createSlackChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(new Response('ok'));
  });

  it('sends Slack payload with attachments', async () => {
    const channel = createSlackChannel('https://hooks.slack.com/test');

    const alert: Alert = {
      id: 'test',
      name: 'test_alert',
      severity: 'critical',
      status: 'firing',
      message: 'Critical issue',
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    await channel.send(alert);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.attachments[0].color).toBe('danger');
    expect(body.attachments[0].text).toBe('Critical issue');
  });

  it('uses correct colors per severity', async () => {
    const channel = createSlackChannel('https://hooks.slack.com/test');

    const severityColors: Record<string, string> = {
      critical: 'danger',
      error: 'warning',
      warning: '#FFA500',
      info: 'good',
    };

    for (const [severity, expectedColor] of Object.entries(severityColors)) {
      mockFetch.mockClear();

      await channel.send({
        id: 'test',
        name: 'test',
        severity: severity as Alert['severity'],
        status: 'firing',
        message: 'test',
        timestamp: '2025-01-01T00:00:00.000Z',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attachments[0].color).toBe(expectedColor);
    }
  });

  it('sets severity filter', () => {
    const channel = createSlackChannel('https://hooks.slack.com/test', ['critical', 'error']);
    expect(channel.severities).toEqual(['critical', 'error']);
  });
});

describe('alert rule factories', () => {
  describe('createErrorRateAlert', () => {
    it('fires when error rate exceeds threshold', () => {
      const rule = createErrorRateAlert(() => 10, 5);
      expect(rule.name).toBe('high_error_rate');
      expect(rule.severity).toBe('error');
      expect(rule.condition()).toBe(true);
    });

    it('does not fire when below threshold', () => {
      const rule = createErrorRateAlert(() => 3, 5);
      expect(rule.condition()).toBe(false);
    });

    it('uses default threshold of 5', () => {
      const rule = createErrorRateAlert(() => 6);
      expect(rule.condition()).toBe(true);
    });
  });

  describe('createResponseTimeAlert', () => {
    it('fires when p95 exceeds threshold', () => {
      const rule = createResponseTimeAlert(() => 1500, 1000);
      expect(rule.name).toBe('high_response_time');
      expect(rule.severity).toBe('warning');
      expect(rule.condition()).toBe(true);
    });

    it('does not fire at threshold', () => {
      const rule = createResponseTimeAlert(() => 1000, 1000);
      expect(rule.condition()).toBe(false);
    });
  });

  describe('createCacheHitRateAlert', () => {
    it('fires when hit rate below threshold', () => {
      const rule = createCacheHitRateAlert(() => 50, 60);
      expect(rule.name).toBe('low_cache_hit_rate');
      expect(rule.condition()).toBe(true);
    });

    it('does not fire when above threshold', () => {
      const rule = createCacheHitRateAlert(() => 80, 60);
      expect(rule.condition()).toBe(false);
    });
  });

  describe('createMemoryUsageAlert', () => {
    it('fires when memory exceeds threshold', () => {
      const rule = createMemoryUsageAlert(() => 95, 90);
      expect(rule.name).toBe('high_memory_usage');
      expect(rule.severity).toBe('error');
      expect(rule.condition()).toBe(true);
    });
  });

  describe('createDatabaseAlert', () => {
    it('fires when connection check fails', async () => {
      const rule = createDatabaseAlert(async () => false);
      expect(rule.name).toBe('database_connection');
      expect(rule.severity).toBe('critical');
      expect(await rule.condition()).toBe(true);
    });

    it('does not fire when connection succeeds', async () => {
      const rule = createDatabaseAlert(async () => true);
      expect(await rule.condition()).toBe(false);
    });
  });

  describe('createServiceHealthAlert', () => {
    it('creates rule with service name in alert name', async () => {
      const rule = createServiceHealthAlert('api', async () => false);
      expect(rule.name).toBe('service_health_api');
      expect(rule.severity).toBe('error');
      expect(await rule.condition()).toBe(true);
    });
  });

  describe('createDiskSpaceAlert', () => {
    it('fires when disk usage exceeds threshold', () => {
      const rule = createDiskSpaceAlert(() => 95, 90);
      expect(rule.name).toBe('low_disk_space');
      expect(rule.condition()).toBe(true);
    });
  });

  describe('createQueueSizeAlert', () => {
    it('fires when queue exceeds threshold', () => {
      const rule = createQueueSizeAlert('jobs', () => 1500, 1000);
      expect(rule.name).toBe('queue_size_jobs');
      expect(rule.condition()).toBe(true);
    });
  });

  describe('createMetricAlert', () => {
    it('uses > operator by default', () => {
      const rule = createMetricAlert('cpu', () => 80, 70);
      expect(rule.condition()).toBe(true);
    });

    it('supports < operator', () => {
      const rule = createMetricAlert('availability', () => 95, 99, '<');
      expect(rule.condition()).toBe(true);
    });

    it('supports = operator', () => {
      const rule = createMetricAlert('exact', () => 42, 42, '=');
      expect(rule.condition()).toBe(true);
    });

    it('uses warning severity by default', () => {
      const rule = createMetricAlert('test', () => 0, 0);
      expect(rule.severity).toBe('warning');
    });

    it('accepts custom severity', () => {
      const rule = createMetricAlert('test', () => 0, 0, '>', 'critical');
      expect(rule.severity).toBe('critical');
    });

    it('returns function message with current value', () => {
      const rule = createMetricAlert('latency', () => 150, 100, '>');
      expect(typeof rule.message).toBe('function');
      const msg = (rule.message as (ctx: Record<string, unknown>) => string)({});
      expect(msg).toContain('latency');
      expect(msg).toContain('150');
      expect(msg).toContain('100');
    });
  });
});
