/**
 * Billing Health Endpoint Tests (Phase 3.2)
 *
 * Tests the /api/billing/health admin-only endpoint.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockDbSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  groupBy: vi.fn(),
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable — mirrors Drizzle's awaitable query builder
  then(
    onFulfilled?: (value: unknown[]) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ): Promise<unknown> {
    return Promise.resolve(_selectResult).then(onFulfilled, onRejected);
  },
  catch(onRejected: (reason: unknown) => unknown) {
    return Promise.resolve(_selectResult).catch(onRejected);
  },
};

let _selectResult: unknown[] = [];
let _selectQueue: unknown[][] = [];

const mockDb = { select: vi.fn() };

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  accountEntitlements: {
    tier: 'accountEntitlements.tier',
    status: 'accountEntitlements.status',
    graceUntil: 'accountEntitlements.graceUntil',
  },
  licenses: {
    status: 'licenses.status',
    updatedAt: 'licenses.updatedAt',
  },
  processedWebhookEvents: {
    processedAt: 'processedWebhookEvents.processedAt',
    eventType: 'processedWebhookEvents.eventType',
  },
  accountSubscriptions: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  ne: vi.fn((_col, _val) => `ne(${String(_col)},${String(_val)})`),
  gt: vi.fn((_col, _val) => `gt(${String(_col)},${String(_val)})`),
  gte: vi.fn((_col, _val) => `gte(${String(_col)},${String(_val)})`),
  lt: vi.fn((_col, _val) => `lt(${String(_col)},${String(_val)})`),
  isNull: vi.fn((_col) => `isNull(${String(_col)})`),
  count: vi.fn(() => 'count()'),
  sql: vi.fn(),
}));

// ─── Import under test ─────────────────────────────────────────────────────

import billingHealthApp from '../billing-health.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const ADMIN_USER: UserContext = {
  id: 'user-admin',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'admin',
};

const OWNER_USER: UserContext = {
  id: 'user-owner',
  email: 'owner@test.com',
  name: 'Owner',
  role: 'owner',
};

const REGULAR_USER: UserContext = {
  id: 'user-regular',
  email: 'user@test.com',
  name: 'User',
  role: 'editor',
};

function createApp(user?: UserContext) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) {
      c.set('user', user);
    }
    await next();
  });
  app.route('/', billingHealthApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

function resetChains() {
  _selectResult = [];
  _selectQueue = [];
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.groupBy.mockReturnValue(mockDbSelectChain);
  mockDb.select.mockImplementation(() => {
    if (_selectQueue.length > 0) {
      _selectResult = _selectQueue.shift() ?? [];
    }
    return mockDbSelectChain;
  });
}

function queueSelectResults(...results: unknown[][]) {
  _selectQueue = [...results];
}

function get(path: string) {
  return new Request(`http://localhost${path}`, { method: 'GET' });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /health (billing health)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
  });

  it('returns 401 when not authenticated', async () => {
    const app = createApp();
    const res = await app.request(get('/health'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    const app = createApp(REGULAR_USER);
    const res = await app.request(get('/health'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with health metrics for admin users', async () => {
    queueSelectResults(
      // 1. tier counts
      [
        { tier: 'pro', count: 10 },
        { tier: 'max', count: 3 },
        { tier: 'enterprise', count: 1 },
      ],
      // 2. grace period count
      [{ count: 2 }],
      // 3. failed payments 7d
      [{ count: 5 }],
      // 4. webhook total 24h
      [{ count: 47 }],
      // 5. orphaned webhooks
      [{ count: 0 }],
    );

    const app = createApp(ADMIN_USER);
    const res = await app.request(get('/health'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.subscriptionsByTier).toEqual({
      free: 0,
      pro: 10,
      max: 3,
      enterprise: 1,
    });
    expect(body.gracePeriodCount).toBe(2);
    expect(body.failedPayments7d).toBe(5);
    expect(body.webhookSuccessRate24h).toBe(100);
    expect(body.orphanedWebhookEvents).toBe(0);
    expect(body.checkedAt).toBeDefined();
  });

  it('returns 200 for owner role', async () => {
    queueSelectResults(
      [{ tier: 'pro', count: 1 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
    );

    const app = createApp(OWNER_USER);
    const res = await app.request(get('/health'));

    expect(res.status).toBe(200);
  });

  it('returns 0% webhook success rate when no events processed', async () => {
    queueSelectResults(
      [],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }], // no webhooks in 24h
      [{ count: 0 }],
    );

    const app = createApp(ADMIN_USER);
    const res = await app.request(get('/health'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.webhookSuccessRate24h).toBe(0);
  });

  it('returns 500 when database query fails', async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const app = createApp(ADMIN_USER);
    const res = await app.request(get('/health'));

    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('Health check query failed');
  });

  it('defaults unknown tiers to 0 in subscriptionsByTier', async () => {
    queueSelectResults(
      [], // no active entitlements
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 10 }],
      [{ count: 0 }],
    );

    const app = createApp(ADMIN_USER);
    const res = await app.request(get('/health'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.subscriptionsByTier).toEqual({
      free: 0,
      pro: 0,
      max: 0,
      enterprise: 0,
    });
  });
});
