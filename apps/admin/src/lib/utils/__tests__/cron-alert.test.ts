import { describe, expect, it, vi } from 'vitest';
import type { CronFailureContext } from '../cron-alert';

// ---------------------------------------------------------------------------
// Mocks — hoisted before module-under-test import.
// ---------------------------------------------------------------------------

const sendCronFailureAlertCore = vi.fn().mockResolvedValue(undefined);

vi.mock('@revealui/core/observability/cron-failure-alert', () => ({
  sendCronFailureAlert: (...args: unknown[]) => sendCronFailureAlertCore(...args),
}));

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

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { sendCronFailureAlert } from '../cron-alert';

function makeContext(overrides: Partial<CronFailureContext> = {}): CronFailureContext {
  return {
    jobName: 'admin:test-job',
    error: new Error('something broke'),
    ...overrides,
  };
}

describe('admin sendCronFailureAlert (thin adapter)', () => {
  it('delegates to shared core with Next.js Sentry injected', async () => {
    sendCronFailureAlertCore.mockClear();
    const ctx = makeContext({ metadata: { accountId: 'acc_1', count: 3 } });
    await sendCronFailureAlert(ctx);

    expect(sendCronFailureAlertCore).toHaveBeenCalledTimes(1);
    const [passedCtx, options] = sendCronFailureAlertCore.mock.calls[0] as [
      CronFailureContext,
      { sentry: { withScope: unknown; captureException: unknown } },
    ];
    expect(passedCtx).toBe(ctx);
    // Structural check — avoid pretty-printing the full Sentry namespace mock.
    expect(options.sentry.withScope).toBe(Sentry.withScope);
    expect(options.sentry.captureException).toBe(Sentry.captureException);
  });

  it('forwards severity and jobName on the context object', async () => {
    sendCronFailureAlertCore.mockClear();
    const ctx = makeContext({
      jobName: 'admin:cleanup-sessions',
      severity: 'fatal',
      metadata: { failedAt: 'sessions-delete' },
    });
    await sendCronFailureAlert(ctx);

    const [passedCtx] = sendCronFailureAlertCore.mock.calls[0] as [
      CronFailureContext,
      { sentry: unknown },
    ];
    expect(passedCtx.jobName).toBe('admin:cleanup-sessions');
    expect(passedCtx.severity).toBe('fatal');
    expect(passedCtx.metadata).toEqual({ failedAt: 'sessions-delete' });
  });

  it('propagates core rejections (core itself never throws; adapter is transparent)', async () => {
    sendCronFailureAlertCore.mockRejectedValueOnce(new Error('unexpected'));
    await expect(sendCronFailureAlert(makeContext())).rejects.toThrow('unexpected');
  });
});
