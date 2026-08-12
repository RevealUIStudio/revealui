/**
 * Entitlement mode-scoping tests (Track B — GAP-266).
 *
 * Reader: the entitlement middleware must apply a mode filter when querying
 * account_entitlements so that a test-era row cannot grant live-mode Pro
 * access, and vice versa (fail-safe toward free tier).
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockGetConfiguredStripeMode } = vi.hoisted(() => ({
  mockGetConfiguredStripeMode: vi.fn<[], 'live' | 'test'>().mockReturnValue('live'),
}));

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: mockGetConfiguredStripeMode,
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn(() => ({})),
}));

const mockDbLimitFn = vi.fn().mockResolvedValue([]);

/** Fluent select chain: membership uses orderBy/innerJoin; entitlement uses where.limit. */
function makeSelectChain() {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: mockDbLimitFn,
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

const mockDb = {
  select: vi.fn().mockImplementation(() => makeSelectChain()),
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  accountMemberships: {
    userId: 'am.userId',
    status: 'am.status',
    accountId: 'am.accountId',
    role: 'am.role',
    createdAt: 'am.createdAt',
  },
  accounts: {
    id: 'accounts.id',
    slug: 'accounts.slug',
  },
  accountEntitlements: {
    accountId: 'ae.accountId',
    mode: 'ae.mode',
    tier: 'ae.tier',
    status: 'ae.status',
    graceUntil: 'ae.graceUntil',
    features: 'ae.features',
    limits: 'ae.limits',
    cogsBreakerTrippedAt: 'ae.cogsBreakerTrippedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_c: unknown, _v: unknown) => 'eq'),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  asc: vi.fn((_c: unknown) => 'asc'),
  or: vi.fn((...args: unknown[]) => `or(${args.join(',')})`),
}));

import { accountEntitlements } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { entitlementMiddleware } from '../../middleware/entitlements.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'usr_test_001' });
    await next();
  });
  app.use('*', entitlementMiddleware());
  app.get('/', (c) => c.json(c.get('entitlements') as Record<string, unknown>));
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Entitlement middleware — mode-scoped reader (GAP-266 Track B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfiguredStripeMode.mockReturnValue('live');
    mockDbLimitFn.mockReset().mockResolvedValue([]);
    vi.mocked(mockDb.select).mockImplementation(() => makeSelectChain());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mode filter applied to account_entitlements query', () => {
    it('calls eq() with mode column and live when STRIPE_SECRET_KEY is live', async () => {
      mockGetConfiguredStripeMode.mockReturnValue('live');
      mockDbLimitFn
        .mockResolvedValueOnce([{ accountId: 'acct_001', role: 'owner' }])
        .mockResolvedValueOnce([{ tier: 'pro', status: 'active', features: {}, limits: {} }]);

      const app = createApp();
      await app.request(new Request('http://localhost/', { method: 'GET' }));

      expect(vi.mocked(eq)).toHaveBeenCalledWith(accountEntitlements.mode, 'live');
    });

    it('calls eq() with mode column and test when STRIPE_SECRET_KEY is test', async () => {
      mockGetConfiguredStripeMode.mockReturnValue('test');
      mockDbLimitFn
        .mockResolvedValueOnce([{ accountId: 'acct_002', role: 'owner' }])
        .mockResolvedValueOnce([{ tier: 'pro', status: 'active', features: {}, limits: {} }]);

      const app = createApp();
      await app.request(new Request('http://localhost/', { method: 'GET' }));

      expect(vi.mocked(eq)).toHaveBeenCalledWith(accountEntitlements.mode, 'test');
    });
  });

  describe('cross-mode isolation — fail-safe toward free', () => {
    it('returns tier=free when no entitlement row survives the mode filter', async () => {
      mockGetConfiguredStripeMode.mockReturnValue('live');
      // Membership found; entitlement returns [] (test-mode row was filtered by WHERE mode='live')
      mockDbLimitFn
        .mockResolvedValueOnce([{ accountId: 'acct_003', role: 'owner' }])
        .mockResolvedValueOnce([]);

      const app = createApp();
      const res = await app.request(new Request('http://localhost/', { method: 'GET' }));
      const body = (await res.json()) as { tier: string };

      expect(body.tier).toBe('free');
    });

    it('grants tier when a matching-mode entitlement row is present', async () => {
      mockGetConfiguredStripeMode.mockReturnValue('live');
      mockDbLimitFn
        .mockResolvedValueOnce([{ accountId: 'acct_004', role: 'owner' }])
        .mockResolvedValueOnce([{ tier: 'pro', status: 'active', features: {}, limits: {} }]);

      const app = createApp();
      const res = await app.request(new Request('http://localhost/', { method: 'GET' }));
      const body = (await res.json()) as { tier: string };

      expect(body.tier).toBe('pro');
    });

    it('returns tier=free when no membership exists (anonymous → free, no mode query needed)', async () => {
      mockDbLimitFn.mockResolvedValueOnce([]);

      const app = createApp();
      const res = await app.request(new Request('http://localhost/', { method: 'GET' }));
      const body = (await res.json()) as { tier: string };

      expect(body.tier).toBe('free');
      // Mode filter must NOT fire when there's no membership (avoids unnecessary DB call)
      expect(vi.mocked(eq)).not.toHaveBeenCalledWith(accountEntitlements.mode, expect.anything());
    });
  });

  describe('grace-window request-time fail-safe (GAP-282)', () => {
    it('downgrades a past_due entitlement whose graceUntil has passed to free tier', async () => {
      mockGetConfiguredStripeMode.mockReturnValue('live');
      mockDbLimitFn
        .mockResolvedValueOnce([{ accountId: 'acct_pd', role: 'owner' }])
        .mockResolvedValueOnce([
          {
            tier: 'pro',
            status: 'past_due',
            graceUntil: new Date(Date.now() - 60_000), // grace ended
            features: { ai: true },
            limits: { maxSites: 5 },
          },
        ]);

      const app = createApp();
      const res = await app.request(new Request('http://localhost/', { method: 'GET' }));
      const body = (await res.json()) as {
        tier: string;
        features: Record<string, boolean>;
        limits: Record<string, number>;
        subscriptionStatus: string;
      };

      // Fail-safe: no paid tier/features/limits once grace has elapsed, without
      // waiting for the sweep-grace-periods cron to flip the row.
      expect(body.tier).toBe('free');
      expect(body.features).toEqual({});
      expect(body.limits).toEqual({});
      // The raw status is still surfaced so the request-time license gate can 403.
      expect(body.subscriptionStatus).toBe('past_due');
    });

    it('retains the paid tier for a past_due entitlement still inside its grace window', async () => {
      mockGetConfiguredStripeMode.mockReturnValue('live');
      mockDbLimitFn
        .mockResolvedValueOnce([{ accountId: 'acct_pd2', role: 'owner' }])
        .mockResolvedValueOnce([
          {
            tier: 'pro',
            status: 'past_due',
            graceUntil: new Date(Date.now() + 3_600_000), // grace still open
            features: { ai: true },
            limits: {},
          },
        ]);

      const app = createApp();
      const res = await app.request(new Request('http://localhost/', { method: 'GET' }));
      const body = (await res.json()) as { tier: string };

      expect(body.tier).toBe('pro');
    });
  });
});
