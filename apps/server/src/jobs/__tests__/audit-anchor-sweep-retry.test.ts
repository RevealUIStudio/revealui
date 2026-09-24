/**
 * REVEALUI-SERVER-F — transient Neon HTTP `fetch failed` must not reject the
 * audit-anchor sweep. Schema errors are reported once and are not retried.
 */

import { generateKeyPairSync } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { Ed25519AuditRowSigner } from '@revealui/core/security';
import type { Database } from '@revealui/db/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => {
  const setTag = vi.fn();
  const setExtra = vi.fn();
  return {
    setTag,
    setExtra,
    withScope: vi.fn(
      (cb: (scope: { setTag: typeof setTag; setExtra: typeof setExtra }) => void) => {
        cb({ setTag, setExtra });
      },
    ),
    captureException: vi.fn(),
  };
});

vi.mock('@sentry/node', () => ({
  withScope: sentry.withScope,
  captureException: sentry.captureException,
}));

import {
  handleAuditAnchorSweepRejection,
  resetAuditAnchorSweepFailureLatchForTests,
  runAuditAnchorSweep,
  startAuditAnchorSweep,
  stopAuditAnchorSweep,
} from '../audit-anchor-sweep.js';

function signer(): Ed25519AuditRowSigner {
  const { privateKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return new Ed25519AuditRowSigner(privateKey, 'kid-retry');
}

function neonFetchFailed(): Error {
  const fetchErr = new TypeError('fetch failed');
  const neon = new Error('Error connecting to database: TypeError: fetch failed');
  neon.name = 'NeonDbError';
  neon.cause = fetchErr;
  const wrapped = new Error('Failed query: select count(*) from "audit_log"\nparams: ');
  wrapped.cause = neon;
  return wrapped;
}

function schemaQueryError(): Error {
  const pg = new Error('relation "audit_log" does not exist');
  pg.name = 'NeonDbError';
  (pg as Error & { code?: string }).code = '42P01';
  const wrapped = new Error('Failed query: select count(*) from "audit_log"\nparams: ');
  wrapped.cause = pg;
  return wrapped;
}

function queryResult(rows: unknown[]) {
  const pending = Promise.resolve(rows) as Promise<unknown[]> & {
    orderBy: () => typeof pending;
    limit: () => Promise<unknown[]>;
  };
  pending.orderBy = () => pending;
  pending.limit = () => Promise.resolve(rows);
  return pending;
}

function sweepDb(options: {
  failSelects?: number;
  selectError?: Error;
  distinctError?: Error;
}): Database {
  let failedSelects = 0;
  let successSelects = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => {
          const failBudget = options.failSelects ?? 0;
          if (options.selectError && failedSelects < failBudget) {
            failedSelects += 1;
            return Promise.reject(options.selectError);
          }
          successSelects += 1;
          if (successSelects === 1) return queryResult([{ c: 0 }]);
          return queryResult([]);
        },
      }),
    }),
    selectDistinct: () => ({
      from: () => ({
        where: () => {
          if (options.distinctError) return Promise.reject(options.distinctError);
          return Promise.resolve([]);
        },
      }),
    }),
  } as unknown as Database;
}

const fastRetry = {
  maxAttempts: 3,
  baseDelayMs: 5,
  maxDelayMs: 20,
};

describe('runAuditAnchorSweep Neon connect failures (REVEALUI-SERVER-F)', () => {
  beforeEach(() => {
    resetAuditAnchorSweepFailureLatchForTests();
    sentry.setTag.mockClear();
    sentry.setExtra.mockClear();
    sentry.withScope.mockClear();
    sentry.captureException.mockClear();
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    stopAuditAnchorSweep();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries a transient fetch failure and then completes the sweep', async () => {
    const sleeps: number[] = [];
    const db = sweepDb({ failSelects: 2, selectError: neonFetchFailed() });
    const result = await runAuditAnchorSweep({
      db,
      signer: signer(),
      recordMeter: false,
      dbRetry: {
        ...fastRetry,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.systemOutcome).toBe('skipped');
    expect(sleeps).toEqual([5, 10]);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('resolves after retries exhaust, warns, and captures once', async () => {
    const sleeps: number[] = [];
    const db = sweepDb({ failSelects: 99, selectError: neonFetchFailed() });
    const run = () =>
      runAuditAnchorSweep({
        db,
        signer: signer(),
        recordMeter: false,
        dbRetry: {
          ...fastRetry,
          sleep: async (ms) => {
            sleeps.push(ms);
          },
        },
      });

    const first = await run();
    const second = await run();

    expect(first.anchorsInserted).toBe(0);
    expect(first.errors[0]).toContain('fetch failed');
    expect(second.errors[0]).toContain('fetch failed');
    expect(sleeps).toEqual([5, 10, 5, 10]);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.setTag).toHaveBeenCalledWith('failure_class', 'transient_connect');
    expect(sentry.setTag).toHaveBeenCalledWith('component', 'audit-anchor-sweep');
    expect(sentry.setTag).toHaveBeenCalledWith('job', 'runAuditAnchorSweep');
    expect(sentry.setTag).toHaveBeenCalledWith('db_driver', 'neon-http');
    expect(sentry.setExtra).toHaveBeenCalledWith('attempts', 3);
  });

  it('captures a new outage after a successful sweep clears the latch', async () => {
    const failing = sweepDb({ failSelects: 99, selectError: neonFetchFailed() });
    const healthy = sweepDb({});
    const retry = { ...fastRetry, sleep: async () => {} };
    const signerForSweep = signer();

    await runAuditAnchorSweep({
      db: failing,
      signer: signerForSweep,
      recordMeter: false,
      dbRetry: retry,
    });
    await runAuditAnchorSweep({
      db: healthy,
      signer: signerForSweep,
      recordMeter: false,
      dbRetry: retry,
    });
    await runAuditAnchorSweep({
      db: failing,
      signer: signerForSweep,
      recordMeter: false,
      dbRetry: retry,
    });

    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it('does not retry a schema error and still resolves', async () => {
    const sleep = vi.fn(async () => {});
    const db = sweepDb({ distinctError: schemaQueryError() });
    const result = await runAuditAnchorSweep({
      db,
      signer: signer(),
      recordMeter: false,
      dbRetry: { ...fastRetry, sleep },
    });

    expect(result.errors[0]).toContain('does not exist');
    expect(sleep).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.setTag).toHaveBeenCalledWith('failure_class', 'query');
  });

  it('worker tick captures a database failure once and does not reject', async () => {
    vi.useFakeTimers();
    const reasons: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      reasons.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      startAuditAnchorSweep({
        AUDIT_ANCHOR_SWEEP_ENABLED: 'true',
        AUDIT_ANCHOR_INTERVAL_MS: '60000',
        AUDIT_ANCHOR_DB_RETRY_ATTEMPTS: '1',
      });
      await vi.advanceTimersByTimeAsync(15_000);
      expect(reasons).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('tick tenants='));
      expect(sentry.captureException).toHaveBeenCalledTimes(1);
      expect(sentry.setTag).toHaveBeenCalledWith('failure_class', 'unexpected');
    } finally {
      process.off('unhandledRejection', onUnhandled);
      stopAuditAnchorSweep();
    }
  });

  it('tick rejection handler captures without throwing', () => {
    expect(() => handleAuditAnchorSweepRejection(new Error('tick blew up'))).not.toThrow();
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.setTag).toHaveBeenCalledWith('failure_class', 'unexpected');
  });
});
