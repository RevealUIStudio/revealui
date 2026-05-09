import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronFailureContext } from '../cron-alerts.js';

// ---------------------------------------------------------------------------
// Mocks — declared before any import of the module under test so Vitest
// hoists them correctly.
// ---------------------------------------------------------------------------

vi.mock('@sentry/node', () => ({
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

vi.mock('../email.js', () => ({
  sendEmail: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { logger } from '@revealui/core/observability/logger';
import * as Sentry from '@sentry/node';
import { sendCronFailureAlert } from '../cron-alerts.js';
import { sendEmail } from '../email.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<CronFailureContext> = {}): CronFailureContext {
  return {
    jobName: 'test-job',
    error: new Error('something broke'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendCronFailureAlert', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.REVEALUI_ALERT_EMAIL = 'ops@revealui.com';
    process.env.SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/1';
  });

  afterEach(() => {
    delete process.env.REVEALUI_ALERT_EMAIL;
    delete process.env.SENTRY_DSN;
  });

  it('success-all-paths: logs, captures to Sentry, and sends email', async () => {
    const ctx = makeContext({ metadata: { accountId: 'acc_1', count: 3 } });
    await sendCronFailureAlert(ctx);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('test-job'),
      ctx.error,
      expect.objectContaining({ jobName: 'test-job', accountId: 'acc_1', count: 3 }),
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(ctx.error);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@revealui.com',
        subject: expect.stringContaining('[CRON FAILURE] test-job'),
      }),
    );
  });

  it('Sentry-down: still logs and sends email', async () => {
    vi.mocked(Sentry.withScope).mockImplementation(() => {
      throw new Error('sentry unavailable');
    });

    const ctx = makeContext();
    await expect(sendCronFailureAlert(ctx)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Sentry capture failed'),
      expect.any(Object),
    );
    expect(sendEmail).toHaveBeenCalled();
  });

  it('email-down: still logs and captures to Sentry', async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error('smtp timeout'));

    const ctx = makeContext();
    await expect(sendCronFailureAlert(ctx)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('email delivery failed'),
      expect.any(Object),
    );
  });

  it('all-down: still logs and does not throw', async () => {
    vi.mocked(Sentry.withScope).mockImplementation(() => {
      throw new Error('sentry gone');
    });
    vi.mocked(sendEmail).mockRejectedValue(new Error('email gone'));

    const ctx = makeContext();
    await expect(sendCronFailureAlert(ctx)).resolves.toBeUndefined();

    // logger.error fires first (step 1), then two logger.warn calls for
    // Sentry + email failure.
    expect(logger.error).toHaveBeenCalled();
    const warnCalls = vi.mocked(logger.warn).mock.calls.map((c) => String(c[0]));
    expect(warnCalls.some((m) => m.includes('Sentry capture failed'))).toBe(true);
    expect(warnCalls.some((m) => m.includes('email delivery failed'))).toBe(true);
  });

  it('uses warn severity when context.severity is "warn"', async () => {
    const ctx = makeContext({ severity: 'warn' });
    await sendCronFailureAlert(ctx);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('test-job'),
      expect.any(Object),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('skips email when REVEALUI_ALERT_EMAIL is not set', async () => {
    delete process.env.REVEALUI_ALERT_EMAIL;
    await sendCronFailureAlert(makeContext());

    expect(sendEmail).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('includes metadata in email subject context and Sentry scope', async () => {
    const ctx = makeContext({
      jobName: 'reconcile-subscriptions',
      metadata: { criticalCount: 5, scanned: 100 },
    });
    await sendCronFailureAlert(ctx);

    const emailCall = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(emailCall?.subject).toContain('reconcile-subscriptions');
    expect(emailCall?.html).toContain('criticalCount');
    expect(emailCall?.html).toContain('5');
  });
});
