import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from './ghcr.js';

// Mock DB
vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  accountEntitlements: {
    accountId: 'account_id',
    tier: 'tier',
    status: 'status',
  },
  accountMemberships: {
    accountId: 'account_id',
    userId: 'user_id',
    status: 'status',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  innerJoin: vi.fn(() => mockDb),
  limit: vi.fn(() => []),
};

const WEBHOOK_SECRET = 'test-webhook-secret-min-32-chars!!';

beforeEach(() => {
  vi.resetAllMocks();
  process.env.GHCR_WEBHOOK_SECRET = WEBHOOK_SECRET;
  // Reset mock chain
  mockDb.select.mockReturnValue(mockDb);
  mockDb.from.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.innerJoin.mockReturnValue(mockDb);
  mockDb.limit.mockReturnValue([]);
});

describe('GHCR License-Gated Access', () => {
  describe('POST /verify', () => {
    it('returns 401 without webhook secret header', async () => {
      const res = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: 'acct_123' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 with wrong webhook secret', async () => {
      const res = await app.request('/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'wrong-secret-that-is-long-enough',
        },
        body: JSON.stringify({ licenseKey: 'acct_123' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 when no entitlement found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const res = await app.request('/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ licenseKey: 'nonexistent' }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.allowed).toBe(false);
      expect(body.reason).toContain('No entitlement');
    });

    it('returns 403 when entitlement is not active', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { accountId: 'acct_123', tier: 'pro', status: 'expired' },
      ]);

      const res = await app.request('/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ licenseKey: 'acct_123' }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.allowed).toBe(false);
      expect(body.reason).toContain('expired');
    });

    it('returns 403 when tier is free', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { accountId: 'acct_123', tier: 'free', status: 'active' },
      ]);

      const res = await app.request('/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ licenseKey: 'acct_123' }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.allowed).toBe(false);
      expect(body.reason).toContain('does not include container registry');
    });

    it('returns 200 when entitlement is active pro', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { accountId: 'acct_123', tier: 'pro', status: 'active' },
      ]);

      const res = await app.request('/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ licenseKey: 'acct_123', image: 'revealui-api:latest' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.allowed).toBe(true);
      expect(body.tier).toBe('pro');
      expect(body.accountId).toBe('acct_123');
    });

    it('returns 200 for enterprise tier', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { accountId: 'acct_456', tier: 'enterprise', status: 'active' },
      ]);

      const res = await app.request('/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ licenseKey: 'acct_456' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.allowed).toBe(true);
      expect(body.tier).toBe('enterprise');
    });

    it('returns 200 for max tier', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { accountId: 'acct_789', tier: 'max', status: 'active' },
      ]);

      const res = await app.request('/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ licenseKey: 'acct_789' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.allowed).toBe(true);
    });
  });

  describe('GET /status', () => {
    it('returns 401 without auth', async () => {
      const res = await app.request('/status', { method: 'GET' });
      // Auth middleware will block  -  returns 401
      expect(res.status).toBe(401);
    });
  });
});
