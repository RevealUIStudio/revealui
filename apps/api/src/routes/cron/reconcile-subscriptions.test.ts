import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (vitest hoists vi.mock; mock factories must reference hoisted).
// ---------------------------------------------------------------------------
const hoisted = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  selectMock: vi.fn(),
  getClientMock: vi.fn(),
  retrieveMock: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({ logger: hoisted.logger }));

vi.mock('@revealui/db/schema', () => ({
  accountSubscriptions: {
    accountId: Symbol('accountId'),
    stripeSubscriptionId: Symbol('stripeSubscriptionId'),
    status: Symbol('status'),
    currentPeriodEnd: Symbol('currentPeriodEnd'),
    cancelAtPeriodEnd: Symbol('cancelAtPeriodEnd'),
  },
}));

vi.mock('@revealui/db', () => ({
  getClient: () => hoisted.getClientMock(),
}));

vi.mock('stripe', () => {
  class MockStripe {
    subscriptions = { retrieve: hoisted.retrieveMock };
  }
  return { default: MockStripe };
});

import reconcileApp from './reconcile-subscriptions.js';

interface LocalRow {
  accountId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

function buildDbMock(rows: LocalRow[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  hoisted.selectMock.mockReturnValue({ from: fromMock });
  return { select: hoisted.selectMock };
}

async function invoke(secret?: string) {
  return reconcileApp.fetch(
    new Request('http://localhost/reconcile-subscriptions', {
      method: 'POST',
      headers: secret ? { 'X-Cron-Secret': secret } : {},
    }),
  );
}

const GOOD_SECRET = 'test-reconcile-secret-xxxxxxxxxxxxxxxx';

function setEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.REVEALUI_CRON_SECRET = GOOD_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxxx';
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function fakeStripeSub(
  overrides: Partial<{
    id: string;
    status: string;
    currentPeriodEndUnix: number;
    cancelAtPeriodEnd: boolean;
  }> = {},
): object {
  return {
    id: overrides.id ?? 'sub_1',
    status: overrides.status ?? 'active',
    current_period_end: overrides.currentPeriodEndUnix ?? Math.floor(Date.now() / 1000) + 86400,
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  delete process.env.REVEALUI_CRON_SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.RECONCILE_BATCH_SIZE;
  delete process.env.RECONCILE_DURATION_BUDGET_MS;
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
describe('reconcile-subscriptions auth', () => {
  it('returns 401 when X-Cron-Secret is missing', async () => {
    const res = await invoke();
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Cron-Secret is wrong length (guards timingSafeEqual)', async () => {
    const res = await invoke('short');
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Cron-Secret value mismatches', async () => {
    const res = await invoke('x'.repeat(GOOD_SECRET.length));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Env gating
// ---------------------------------------------------------------------------
describe('reconcile-subscriptions env gating', () => {
  it('returns 503 when STRIPE_SECRET_KEY is missing', async () => {
    setEnv({ STRIPE_SECRET_KEY: undefined });
    const res = await invoke(GOOD_SECRET);
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// No subscriptions to reconcile
// ---------------------------------------------------------------------------
describe('reconcile-subscriptions empty scan', () => {
  it('returns scanned=0 when no live local subs exist', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock([]));
    const res = await invoke(GOOD_SECRET);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scanned: number; drift: number };
    expect(body.scanned).toBe(0);
    expect(body.drift).toBe(0);
    expect(hoisted.retrieveMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------
describe('reconcile-subscriptions drift detection', () => {
  const activeLocal: LocalRow = {
    accountId: 'acct_1',
    stripeSubscriptionId: 'sub_1',
    status: 'active',
    currentPeriodEnd: new Date('2026-05-01T00:00:00Z'),
    cancelAtPeriodEnd: false,
  };

  it('reports zero drift when local and Stripe fully agree', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock([activeLocal]));
    hoisted.retrieveMock.mockResolvedValueOnce(
      fakeStripeSub({
        status: 'active',
        currentPeriodEndUnix: Math.floor(activeLocal.currentPeriodEnd!.getTime() / 1000),
        cancelAtPeriodEnd: false,
      }),
    );
    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      scanned: number;
      drift: number;
      critical: number;
    };
    expect(body.scanned).toBe(1);
    expect(body.drift).toBe(0);
    expect(body.critical).toBe(0);
  });

  it('flags CRITICAL status-mismatch when Stripe says canceled but we say active', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock([activeLocal]));
    hoisted.retrieveMock.mockResolvedValueOnce(
      fakeStripeSub({ status: 'canceled', currentPeriodEndUnix: 1 }),
    );
    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      drift: number;
      critical: number;
      results: Array<{ drift: string; critical: boolean }>;
    };
    expect(body.drift).toBe(1);
    expect(body.critical).toBe(1);
    expect(body.results[0].drift).toBe('status-mismatch');
    expect(body.results[0].critical).toBe(true);
    expect(hoisted.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL'),
      undefined,
      expect.objectContaining({ accountId: 'acct_1' }),
    );
  });

  it('flags CRITICAL missing-in-stripe when Stripe 404s a live-local subscription', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock([activeLocal]));
    const err = new Error('No such subscription') as Error & { statusCode: number };
    err.statusCode = 404;
    hoisted.retrieveMock.mockRejectedValueOnce(err);

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      drift: number;
      critical: number;
      results: Array<{ drift: string; critical: boolean }>;
    };
    expect(body.critical).toBe(1);
    expect(body.results[0].drift).toBe('missing-in-stripe');
    expect(hoisted.logger.error).toHaveBeenCalled();
  });

  it('flags non-critical period-end drift', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock([activeLocal]));
    // Same status, different period_end (Stripe renewed but we missed it).
    hoisted.retrieveMock.mockResolvedValueOnce(
      fakeStripeSub({
        status: 'active',
        currentPeriodEndUnix:
          Math.floor(activeLocal.currentPeriodEnd!.getTime() / 1000) + 30 * 86400,
      }),
    );
    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      drift: number;
      critical: number;
      results: Array<{ drift: string; critical: boolean }>;
    };
    expect(body.drift).toBe(1);
    expect(body.critical).toBe(0);
    expect(body.results[0].drift).toBe('period-end-mismatch');
    expect(body.results[0].critical).toBe(false);
  });

  it('flags cancel-flag drift as non-critical', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock([activeLocal]));
    hoisted.retrieveMock.mockResolvedValueOnce(
      fakeStripeSub({
        status: 'active',
        currentPeriodEndUnix: Math.floor(activeLocal.currentPeriodEnd!.getTime() / 1000),
        cancelAtPeriodEnd: true, // user toggled cancel-at-period-end in Stripe; we didn't hear
      }),
    );
    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      drift: number;
      results: Array<{ drift: string }>;
    };
    expect(body.results[0].drift).toBe('cancel-flag-mismatch');
    expect(body.drift).toBe(1);
  });

  it('downgrades Stripe errors (non-404) to non-critical stripe-error', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock([activeLocal]));
    hoisted.retrieveMock.mockRejectedValueOnce(new Error('network flake'));
    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      drift: number;
      critical: number;
      results: Array<{ drift: string; critical: boolean }>;
    };
    expect(body.drift).toBe(1);
    expect(body.critical).toBe(0);
    expect(body.results[0].drift).toBe('stripe-error');
  });

  it('does not log CRITICAL for past_due → active drift (customer got healthier)', async () => {
    const pastDueLocal: LocalRow = { ...activeLocal, status: 'past_due' };
    hoisted.getClientMock.mockReturnValue(buildDbMock([pastDueLocal]));
    hoisted.retrieveMock.mockResolvedValueOnce(
      fakeStripeSub({
        status: 'active',
        currentPeriodEndUnix: Math.floor(pastDueLocal.currentPeriodEnd!.getTime() / 1000),
      }),
    );
    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      drift: number;
      critical: number;
    };
    expect(body.drift).toBe(1);
    // Going from past_due to active is a webhook we missed but it doesn't
    // deny service; classify as WARN not CRITICAL.
    expect(body.critical).toBe(0);
    expect(hoisted.logger.error).not.toHaveBeenCalled();
  });
});
