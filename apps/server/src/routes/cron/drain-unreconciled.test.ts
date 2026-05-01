import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  use vi.hoisted so vi.mock factories can reference them. Vitest
// hoists vi.mock calls to the top of the file, so any mock factory closures
// must receive their dependencies through vi.hoisted(), not top-level const.
// ---------------------------------------------------------------------------
const hoisted = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  getClientMock: vi.fn(),
  replayMock: vi.fn(),
}));
const loggerMock = hoisted.logger;
const selectMock = hoisted.selectMock;
const updateMock = hoisted.updateMock;
const getClientMock = hoisted.getClientMock;
const replayMock = hoisted.replayMock;

vi.mock('@revealui/core/observability/logger', () => ({
  logger: hoisted.logger,
}));

vi.mock('@revealui/db/schema', () => ({
  unreconciledWebhooks: {
    eventId: Symbol('eventId'),
    eventType: Symbol('eventType'),
    createdAt: Symbol('createdAt'),
    resolvedAt: Symbol('resolvedAt'),
    resolvedBy: Symbol('resolvedBy'),
  },
  processedWebhookEvents: { id: Symbol('id') },
}));

vi.mock('@revealui/db', () => ({
  getClient: () => hoisted.getClientMock(),
}));

vi.mock('../../lib/webhook-replay.js', () => ({
  replayStripeEvent: (...args: unknown[]) => hoisted.replayMock(...args),
}));

// webhooksApp default export — stub Hono app (replay is mocked anyway)
vi.mock('../webhooks.js', () => ({
  default: new Hono(),
}));

vi.mock('stripe', () => {
  class MockStripe {
    events = { retrieve: vi.fn() };
    webhooks = { generateTestHeaderStringAsync: vi.fn() };
  }
  return { default: MockStripe };
});

// GAP-131: drain-unreconciled now uses protectedStripe from @revealui/services
vi.mock('@revealui/services', () => ({
  protectedStripe: {
    events: { retrieve: vi.fn() },
    webhooks: { generateTestHeaderStringAsync: vi.fn() },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import drainApp from './drain-unreconciled.js';

function buildDbMock(rows: Array<{ eventId: string; eventType: string; createdAt: Date }>) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereSelectMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereSelectMock });
  selectMock.mockReturnValue({ from: fromMock });

  const whereUpdateMock = vi.fn().mockResolvedValue({ rowCount: 1 });
  const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
  updateMock.mockReturnValue({ set: setMock });

  return {
    db: { select: selectMock, update: updateMock },
    setMock,
    whereUpdateMock,
  };
}

async function invokeDrain(secretHeader?: string) {
  const req = new Request('http://localhost/drain-unreconciled', {
    method: 'POST',
    headers: secretHeader ? { 'X-Cron-Secret': secretHeader } : {},
  });
  return drainApp.fetch(req);
}

function setEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.REVEALUI_CRON_SECRET = 'test-cron-secret-xxxxxxxxxxxxxxxxxxx';
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxxx';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxxx';
  delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  delete process.env.REVEALUI_CRON_SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  delete process.env.DRAIN_BATCH_SIZE;
  delete process.env.DRAIN_DURATION_BUDGET_MS;
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
describe('drain-unreconciled auth', () => {
  it('returns 401 when X-Cron-Secret is missing', async () => {
    const res = await invokeDrain();
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Cron-Secret is wrong', async () => {
    const res = await invokeDrain('wrong-secret-1234567890123456789012');
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Cron-Secret is a length mismatch (buffer timing-safe guard)', async () => {
    const res = await invokeDrain('short');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Env gating
// ---------------------------------------------------------------------------
describe('drain-unreconciled env gating', () => {
  it('returns 503 when STRIPE_SECRET_KEY is missing', async () => {
    setEnv({ STRIPE_SECRET_KEY: undefined });
    const res = await invokeDrain('test-cron-secret-xxxxxxxxxxxxxxxxxxx');
    expect(res.status).toBe(503);
  });

  it('returns 503 when STRIPE_WEBHOOK_SECRET is missing', async () => {
    setEnv({ STRIPE_WEBHOOK_SECRET: undefined });
    const res = await invokeDrain('test-cron-secret-xxxxxxxxxxxxxxxxxxx');
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Empty queue
// ---------------------------------------------------------------------------
describe('drain-unreconciled empty queue', () => {
  it('returns scanned=0 replayed=0 when no unresolved rows exist', async () => {
    const { db } = buildDbMock([]);
    getClientMock.mockReturnValue(db);

    const res = await invokeDrain('test-cron-secret-xxxxxxxxxxxxxxxxxxx');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scanned: number; replayed: number };
    expect(body.scanned).toBe(0);
    expect(body.replayed).toBe(0);
    expect(replayMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------
describe('drain-unreconciled happy path', () => {
  it('replays unresolved events and marks them resolved with resolvedBy=cron', async () => {
    const { db, setMock } = buildDbMock([
      {
        eventId: 'evt_ok_1',
        eventType: 'checkout.session.completed',
        createdAt: new Date(Date.now() - 60_000),
      },
    ]);
    getClientMock.mockReturnValue(db);
    replayMock.mockResolvedValueOnce({ kind: 'replayed', status: 200, duplicate: false });

    const res = await invokeDrain('test-cron-secret-xxxxxxxxxxxxxxxxxxx');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      scanned: number;
      replayed: number;
      results: Array<{ outcome: string }>;
    };
    expect(body.scanned).toBe(1);
    expect(body.replayed).toBe(1);
    expect(body.results[0].outcome).toBe('replayed');

    // The update call used to mark resolved should pass resolvedBy='cron'.
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ resolvedBy: 'cron', resolvedAt: expect.any(Date) }),
    );
  });

  it('flags events aged >24h as critical even when replay succeeds', async () => {
    const { db } = buildDbMock([
      {
        eventId: 'evt_old',
        eventType: 'invoice.payment_failed',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    ]);
    getClientMock.mockReturnValue(db);
    replayMock.mockResolvedValueOnce({ kind: 'replayed', status: 200 });

    const res = await invokeDrain('test-cron-secret-xxxxxxxxxxxxxxxxxxx');
    const body = (await res.json()) as {
      critical: number;
      results: Array<{ critical: boolean }>;
    };
    expect(body.critical).toBe(1);
    expect(body.results[0].critical).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Failures and edge cases
// ---------------------------------------------------------------------------
describe('drain-unreconciled failures', () => {
  it('logs ERROR with "CRITICAL" when a replay fails for an event aged >24h', async () => {
    const { db } = buildDbMock([
      {
        eventId: 'evt_critical_fail',
        eventType: 'charge.refunded',
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      },
    ]);
    getClientMock.mockReturnValue(db);
    replayMock.mockResolvedValueOnce({
      kind: 'handler-error',
      status: 500,
      body: { error: 'still broken' },
    });

    const res = await invokeDrain('test-cron-secret-xxxxxxxxxxxxxxxxxxx');
    expect(res.status).toBe(200);
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL'),
      undefined,
      expect.objectContaining({ eventId: 'evt_critical_fail' }),
    );
  });

  it('marks an event as resolved with resolvedBy=cron:event-missing when Stripe 404s', async () => {
    const { db, setMock } = buildDbMock([
      {
        eventId: 'evt_deleted',
        eventType: 'customer.subscription.deleted',
        createdAt: new Date(Date.now() - 60_000),
      },
    ]);
    getClientMock.mockReturnValue(db);
    replayMock.mockResolvedValueOnce({ kind: 'event-missing', detail: 'No such event' });

    const res = await invokeDrain('test-cron-secret-xxxxxxxxxxxxxxxxxxx');
    const body = (await res.json()) as { results: Array<{ outcome: string }> };
    expect(body.results[0].outcome).toBe('event-missing');
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ resolvedBy: 'cron:event-missing' }),
    );
  });

  it('leaves rows unresolved when the handler returns 5xx', async () => {
    const { db, setMock } = buildDbMock([
      {
        eventId: 'evt_retry_later',
        eventType: 'invoice.payment_failed',
        createdAt: new Date(Date.now() - 60_000),
      },
    ]);
    getClientMock.mockReturnValue(db);
    replayMock.mockResolvedValueOnce({ kind: 'handler-error', status: 502, body: null });

    const res = await invokeDrain('test-cron-secret-xxxxxxxxxxxxxxxxxxx');
    const body = (await res.json()) as { replayed: number };
    expect(body.replayed).toBe(0);
    // No resolved-by update for unresolved replay failures.
    expect(setMock).not.toHaveBeenCalled();
  });
});
