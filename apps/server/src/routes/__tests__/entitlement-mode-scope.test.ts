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
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: mockDbLimitFn }),
    }),
  }),
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
  },
  accountEntitlements: {
    accountId: 'ae.accountId',
    mode: 'ae.mode',
    tier: 'ae.tier',
    status: 'ae.status',
    graceUntil: 'ae.graceUntil',
    features: 'ae.features',
    limits: 'ae.limits',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_c: unknown, _v: unknown) => 'eq'),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
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
    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: mockDbLimitFn }),
      }),
    });
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
});
