import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  captureCheckIn: vi.fn(() => 'check-in-id'),
  withMonitor: vi.fn((slug: string, callback: () => unknown) => {
    void slug;
    return callback();
  }),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: hoisted.logger,
}));

vi.mock('@sentry/node', () => ({
  captureCheckIn: hoisted.captureCheckIn,
  withMonitor: hoisted.withMonitor,
}));

import { logger } from '@revealui/core/observability/logger';
import {
  DEFAULT_DISPATCH_MONITOR_SLUG,
  DEFAULT_WORKER_HEARTBEAT_MS,
  DEFAULT_WORKER_MONITOR_SLUG,
  DISPATCH_CRONTAB,
  dispatchMonitorConfig,
  jobMonitorConfig,
  jobMonitorSlug,
  MONITORED_JOB_NAMES,
  resolveDispatchMonitorSlug,
  resolveWorkerHeartbeatMs,
  resolveWorkerMonitorSlug,
  sendWorkerHeartbeat,
  sentryCronEnabled,
  startWorkerSentryHeartbeat,
  stopWorkerSentryHeartbeat,
  WORKER_CRONTAB,
  workerMonitorConfig,
} from '../cron-sentry-monitors.js';

const FAKE_SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';

describe('cron sentry monitor config', () => {
  it('matches the daily Vercel dispatch schedule', () => {
    expect(DISPATCH_CRONTAB).toBe('0 6 * * *');
    expect(dispatchMonitorConfig).toEqual({
      schedule: { type: 'crontab', value: '0 6 * * *' },
      checkinMargin: 30,
      maxRuntime: 5,
      timezone: 'UTC',
      failureIssueThreshold: 1,
      recoveryThreshold: 1,
    });
    expect(DEFAULT_DISPATCH_MONITOR_SLUG).toBe('vercel-cron-dispatch');
  });

  it('uses a 2 minute max runtime for monitored sub-jobs', () => {
    expect(jobMonitorConfig).toEqual({
      schedule: { type: 'crontab', value: DISPATCH_CRONTAB },
      checkinMargin: 30,
      maxRuntime: 2,
      timezone: 'UTC',
      failureIssueThreshold: 1,
      recoveryThreshold: 1,
    });
  });

  it('covers reconcile, sweep, and billing-readiness jobs', () => {
    expect([...MONITORED_JOB_NAMES]).toEqual([
      'drain-unreconciled',
      'reconcile-subscriptions',
      'reconcile-customers',
      'reconcile-stripe-subscriptions',
      'sweep-grace-periods',
      'reconcile-entitlements',
      'billing-readiness',
    ]);
    expect(jobMonitorSlug('billing-readiness')).toBe('cron-billing-readiness');
    expect(jobMonitorSlug('sweep-grace-periods')).toBe('cron-sweep-grace-periods');
  });

  it('uses the 5 minute worker crontab', () => {
    expect(WORKER_CRONTAB).toBe('*/5 * * * *');
    expect(workerMonitorConfig).toEqual({
      schedule: { type: 'crontab', value: '*/5 * * * *' },
      checkinMargin: 5,
      maxRuntime: 2,
      timezone: 'UTC',
      failureIssueThreshold: 1,
      recoveryThreshold: 1,
    });
    expect(DEFAULT_WORKER_MONITOR_SLUG).toBe('fly-worker-heartbeat');
    expect(DEFAULT_WORKER_HEARTBEAT_MS).toBe(5 * 60 * 1000);
  });

  it('reads optional slug and interval overrides', () => {
    expect(resolveDispatchMonitorSlug({})).toBe('vercel-cron-dispatch');
    expect(resolveDispatchMonitorSlug({ SENTRY_CRON_DISPATCH_SLUG: '  custom-dispatch  ' })).toBe(
      'custom-dispatch',
    );
    expect(resolveWorkerMonitorSlug({})).toBe('fly-worker-heartbeat');
    expect(resolveWorkerMonitorSlug({ SENTRY_CRON_WORKER_SLUG: 'custom-worker' })).toBe(
      'custom-worker',
    );
    expect(resolveWorkerHeartbeatMs({})).toBe(DEFAULT_WORKER_HEARTBEAT_MS);
    expect(resolveWorkerHeartbeatMs({ SENTRY_CRON_HEARTBEAT_MS: '1000' })).toBe(1000);
    expect(resolveWorkerHeartbeatMs({ SENTRY_CRON_HEARTBEAT_MS: '0' })).toBe(
      DEFAULT_WORKER_HEARTBEAT_MS,
    );
    expect(resolveWorkerHeartbeatMs({ SENTRY_CRON_HEARTBEAT_MS: 'nope' })).toBe(
      DEFAULT_WORKER_HEARTBEAT_MS,
    );
    expect(resolveWorkerHeartbeatMs({ SENTRY_CRON_HEARTBEAT_MS: '   ' })).toBe(
      DEFAULT_WORKER_HEARTBEAT_MS,
    );
  });

  it('treats a blank DSN as disabled', () => {
    expect(sentryCronEnabled({})).toBe(false);
    expect(sentryCronEnabled({ SENTRY_DSN: '   ' })).toBe(false);
    expect(sentryCronEnabled({ SENTRY_DSN: FAKE_SENTRY_DSN })).toBe(true);
  });

  it('wires the worker heartbeat after serve and wraps dispatch with withMonitor', () => {
    const workerSource = readFileSync(resolve(__dirname, '../../worker.ts'), 'utf8');
    const serveAt = workerSource.indexOf('serve({ fetch: app.fetch, port })');
    const heartbeatAt = workerSource.indexOf('startWorkerSentryHeartbeat()');
    expect(serveAt).toBeGreaterThan(-1);
    expect(heartbeatAt).toBeGreaterThan(serveAt);

    const dispatchSource = readFileSync(
      resolve(__dirname, '../../routes/cron/dispatch.ts'),
      'utf8',
    );
    expect(dispatchSource).toContain('Sentry.withMonitor(resolveDispatchMonitorSlug()');
    expect(dispatchSource).toContain('Sentry.withMonitor(jobMonitorSlug(job.name)');
    expect(dispatchSource).toContain('readJsonJobBody(res, job.name)');
  });
});

describe('worker sentry heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_CRON_WORKER_SLUG;
    delete process.env.SENTRY_CRON_HEARTBEAT_MS;
  });

  afterEach(() => {
    stopWorkerSentryHeartbeat();
    vi.useRealTimers();
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_CRON_WORKER_SLUG;
    delete process.env.SENTRY_CRON_HEARTBEAT_MS;
  });

  it('does not check in when SENTRY_DSN is unset', () => {
    startWorkerSentryHeartbeat();
    expect(hoisted.captureCheckIn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEFAULT_WORKER_HEARTBEAT_MS);
    expect(hoisted.captureCheckIn).not.toHaveBeenCalled();
  });

  it('checks in immediately and on the interval when SENTRY_DSN is set', () => {
    process.env.SENTRY_DSN = FAKE_SENTRY_DSN;
    startWorkerSentryHeartbeat();

    expect(hoisted.captureCheckIn).toHaveBeenCalledTimes(1);
    expect(hoisted.captureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: 'fly-worker-heartbeat', status: 'ok' },
      workerMonitorConfig,
    );

    vi.advanceTimersByTime(DEFAULT_WORKER_HEARTBEAT_MS);
    expect(hoisted.captureCheckIn).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(DEFAULT_WORKER_HEARTBEAT_MS);
    expect(hoisted.captureCheckIn).toHaveBeenCalledTimes(3);
  });

  it('honors slug and interval overrides', () => {
    process.env.SENTRY_DSN = FAKE_SENTRY_DSN;
    process.env.SENTRY_CRON_WORKER_SLUG = 'custom-worker';
    process.env.SENTRY_CRON_HEARTBEAT_MS = '1000';
    startWorkerSentryHeartbeat();

    expect(hoisted.captureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: 'custom-worker', status: 'ok' },
      workerMonitorConfig,
    );
    vi.advanceTimersByTime(999);
    expect(hoisted.captureCheckIn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(hoisted.captureCheckIn).toHaveBeenCalledTimes(2);
  });

  it('logs and continues when captureCheckIn throws', () => {
    process.env.SENTRY_DSN = FAKE_SENTRY_DSN;
    hoisted.captureCheckIn.mockImplementation(() => {
      throw new Error('transport down');
    });

    expect(() => sendWorkerHeartbeat('error')).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      'Sentry worker heartbeat failed',
      expect.objectContaining({ error: 'transport down' }),
    );
  });
});
