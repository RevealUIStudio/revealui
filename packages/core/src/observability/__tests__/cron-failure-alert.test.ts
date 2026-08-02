import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronFailureContext, CronFailureSentryLike } from '../cron-failure-alert.js';

vi.mock('../logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { buildCronFailureEmailBody, sendCronFailureAlert } from '../cron-failure-alert.js';
import { logger } from '../logger.js';

function makeContext(overrides: Partial<CronFailureContext> = {}): CronFailureContext {
  return {
    jobName: 'test-job',
    error: new Error('something broke'),
    ...overrides,
  };
}

function makeSentry(): CronFailureSentryLike {
  return {
    withScope: vi.fn((cb: (scope: unknown) => void) => {
      cb({
        setTag: vi.fn(),
        setLevel: vi.fn(),
        setContext: vi.fn(),
      });
    }),
    captureException: vi.fn(),
  };
}

describe('sendCronFailureAlert (shared core)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs error + captures to Sentry when sentry is provided', async () => {
    const sentry = makeSentry();
    const ctx = makeContext({ metadata: { accountId: 'acc_1' } });
    await sendCronFailureAlert(ctx, { sentry });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('test-job'),
      ctx.error,
      expect.objectContaining({ jobName: 'test-job', accountId: 'acc_1' }),
    );
    expect(sentry.captureException).toHaveBeenCalledWith(ctx.error);
  });

  it('skips Sentry when no adapter is injected', async () => {
    await sendCronFailureAlert(makeContext());
    expect(logger.error).toHaveBeenCalled();
  });

  it('uses logger.warn when severity is "warn"', async () => {
    await sendCronFailureAlert(makeContext({ severity: 'warn' }), { sentry: makeSentry() });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('test-job'),
      expect.any(Object),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('still resolves when Sentry throws', async () => {
    const sentry = makeSentry();
    vi.mocked(sentry.withScope).mockImplementationOnce(() => {
      throw new Error('sentry unavailable');
    });

    await expect(sendCronFailureAlert(makeContext(), { sentry })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
    expect(
      vi.mocked(logger.warn).mock.calls.some((c) => String(c[0]).includes('Sentry capture failed')),
    ).toBe(true);
  });

  it('falls back to stderr when logger itself throws', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.mocked(logger.error).mockImplementationOnce(() => {
      throw new Error('logger down');
    });
    const sentry = makeSentry();

    await expect(sendCronFailureAlert(makeContext(), { sentry })).resolves.toBeUndefined();

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('logger failed while reporting test-job'),
    );
    expect(sentry.captureException).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it('sends email when alertEmail + sendEmail are provided', async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    await sendCronFailureAlert(makeContext({ metadata: { n: 1 } }), {
      sentry: makeSentry(),
      alertEmail: 'ops@revealui.com',
      sendEmail,
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@revealui.com',
        subject: expect.stringContaining('[CRON FAILURE] test-job'),
      }),
    );
  });

  it('reads REVEALUI_ALERT_EMAIL from env when alertEmail option omitted', async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    await sendCronFailureAlert(makeContext(), {
      sendEmail,
      env: { REVEALUI_ALERT_EMAIL: 'ops@example.com' },
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ops@example.com' }));
  });

  it('skips email when address unset or sendEmail missing', async () => {
    const sendEmail = vi.fn();
    await sendCronFailureAlert(makeContext(), { sendEmail, env: {} });
    expect(sendEmail).not.toHaveBeenCalled();

    await sendCronFailureAlert(makeContext(), {
      alertEmail: 'ops@example.com',
      env: {},
    });
    // no sendEmail adapter — still no throw
  });

  it('email-down: still logs and does not throw', async () => {
    const sendEmail = vi.fn().mockRejectedValue(new Error('smtp timeout'));
    await expect(
      sendCronFailureAlert(makeContext(), {
        alertEmail: 'ops@example.com',
        sendEmail,
      }),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('email delivery failed'),
      expect.any(Object),
    );
  });

  it('buildCronFailureEmailBody includes metadata', () => {
    const body = buildCronFailureEmailBody(
      makeContext({ jobName: 'reconcile', metadata: { criticalCount: 5 } }),
    );
    expect(body.subject).toContain('reconcile');
    expect(body.html).toContain('criticalCount');
    expect(body.html).toContain('5');
    expect(body.text).toContain('criticalCount');
  });
});
