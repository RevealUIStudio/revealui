import { describe, expect, it, vi } from 'vitest';
import type { CronFailureContext } from '../cron-alert';

// ---------------------------------------------------------------------------
// Mocks — hoisted before module-under-test import.
// ---------------------------------------------------------------------------

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn((cb: (scope: unknown) => void) => {
    cb({
      setTag: vi.fn(),
      setLevel: vi.fn(),
      setContext: vi.fn(),
    });
  }),
  captureException: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { logger } from '@revealui/core/observability/logger';
import * as Sentry from '@sentry/nextjs';
import { sendCronFailureAlert } from '../cron-alert';

function makeContext(overrides: Partial<CronFailureContext> = {}): CronFailureContext {
  return {
    jobName: 'admin:test-job',
    error: new Error('something broke'),
    ...overrides,
  };
}

describe('admin sendCronFailureAlert', () => {
  it('logs error + captures to Sentry on success', async () => {
    vi.mocked(logger.error).mockClear();
    vi.mocked(Sentry.captureException).mockClear();

    const ctx = makeContext({ metadata: { accountId: 'acc_1', count: 3 } });
    await sendCronFailureAlert(ctx);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('admin:test-job'),
      ctx.error,
      expect.objectContaining({ jobName: 'admin:test-job', accountId: 'acc_1', count: 3 }),
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(ctx.error);
  });

  it('uses logger.warn when severity is "warn"', async () => {
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();

    await sendCronFailureAlert(makeContext({ severity: 'warn' }));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('admin:test-job'),
      expect.any(Object),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('still resolves when Sentry throws', async () => {
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.warn).mockClear();
    vi.mocked(Sentry.withScope).mockImplementationOnce(() => {
      throw new Error('sentry unavailable');
    });

    await expect(sendCronFailureAlert(makeContext())).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
    // Sentry failure is logged as a separate warn entry — same pattern as
    // apps/server/src/lib/cron-alerts.ts.
    expect(
      vi.mocked(logger.warn).mock.calls.some((c) => String(c[0]).includes('Sentry capture failed')),
    ).toBe(true);
  });

  it('falls back to stderr when logger itself throws', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.mocked(logger.error).mockImplementationOnce(() => {
      throw new Error('logger down');
    });

    await expect(sendCronFailureAlert(makeContext())).resolves.toBeUndefined();

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('logger failed while reporting admin:test-job'),
    );
    // Sentry still ran because step 2 is independent of step 1.
    expect(Sentry.captureException).toHaveBeenCalled();

    stderrSpy.mockRestore();
  });

  it('tags Sentry scope with cron_job + severity + metadata', async () => {
    const setTag = vi.fn();
    const setLevel = vi.fn();
    const setContext = vi.fn();
    // Sentry.withScope is overloaded ((cb) => T) | ((scope, cb) => T) in
    // @sentry/nextjs typings; cast to the single-arg overload via the
    // mock factory signature for this test.
    vi.mocked(Sentry.withScope).mockImplementationOnce(((cb: (s: unknown) => void) => {
      cb({ setTag, setLevel, setContext });
    }) as typeof Sentry.withScope);

    await sendCronFailureAlert(
      makeContext({
        jobName: 'admin:cleanup-sessions',
        severity: 'fatal',
        metadata: { failedAt: 'sessions-delete' },
      }),
    );

    expect(setTag).toHaveBeenCalledWith('cron_job', 'admin:cleanup-sessions');
    expect(setTag).toHaveBeenCalledWith('alert_severity', 'fatal');
    expect(setLevel).toHaveBeenCalledWith('fatal');
    expect(setContext).toHaveBeenCalledWith('metadata', { failedAt: 'sessions-delete' });
  });
});
