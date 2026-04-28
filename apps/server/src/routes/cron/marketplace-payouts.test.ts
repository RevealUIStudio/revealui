import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from './marketplace-payouts.js';

// Mock modules
vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  marketplaceServers: {
    id: 'id',
    stripeAccountId: 'stripe_account_id',
  },
  marketplaceTransactions: {
    id: 'id',
    serverId: 'server_id',
    developerAmountUsdc: 'developer_amount_usdc',
    status: 'status',
    stripeTransferId: 'stripe_transfer_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  inArray: (a: unknown, b: unknown) => [a, b],
  isNull: (a: unknown) => a,
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    {
      raw: (s: string) => s,
    },
  ),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      transfers = {
        create: vi.fn(),
      };
    },
  };
});

// GAP-131: marketplace-payouts now uses protectedStripe from @revealui/services
vi.mock('@revealui/services', () => ({
  protectedStripe: {
    transfers: { create: vi.fn() },
  },
}));

const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  innerJoin: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  groupBy: vi.fn(() => []),
  update: vi.fn(() => mockDb),
  set: vi.fn(() => mockDb),
};

const CRON_SECRET = 'test-cron-secret-long-enough-32chars!';

beforeEach(() => {
  vi.resetAllMocks();
  process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

  // Reset mock chain
  mockDb.select.mockReturnValue(mockDb);
  mockDb.from.mockReturnValue(mockDb);
  mockDb.innerJoin.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.groupBy.mockReturnValue([]);
  mockDb.update.mockReturnValue(mockDb);
  mockDb.set.mockReturnValue(mockDb);
});

describe('Marketplace Payouts Cron', () => {
  it('returns 401 without cron secret', async () => {
    const res = await app.request('/marketplace-payouts', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong cron secret', async () => {
    const res = await app.request('/marketplace-payouts', {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'wrong-secret-that-is-32-chars!!' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with no pending payouts', async () => {
    mockDb.groupBy.mockResolvedValueOnce([]);

    const res = await app.request('/marketplace-payouts', {
      method: 'POST',
      headers: { 'X-Cron-Secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.processed).toBe(0);
    expect(body.payouts).toEqual([]);
  });

  it('skips payouts below $0.50 minimum', async () => {
    mockDb.groupBy.mockResolvedValueOnce([
      {
        stripeAccountId: 'acct_dev1',
        totalDeveloperUsdc: '0.30',
        transactionCount: 5,
        transactionIds: ['tx1', 'tx2', 'tx3', 'tx4', 'tx5'],
      },
    ]);

    const res = await app.request('/marketplace-payouts', {
      method: 'POST',
      headers: { 'X-Cron-Secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(body.payouts[0].error).toContain('Below minimum');
    expect(body.payouts[0].transferId).toBeNull();
  });

  it('handles payouts with null stripeAccountId', async () => {
    mockDb.groupBy.mockResolvedValueOnce([
      {
        stripeAccountId: null,
        totalDeveloperUsdc: '10.00',
        transactionCount: 2,
        transactionIds: ['tx1', 'tx2'],
      },
    ]);

    const res = await app.request('/marketplace-payouts', {
      method: 'POST',
      headers: { 'X-Cron-Secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Null stripeAccountId is skipped, so processed = 0
    expect(body.processed).toBe(0);
  });

  it('returns timing-safe comparison on secret', async () => {
    // Test with same-length but different secret
    const wrongSecret = 'X'.repeat(CRON_SECRET.length);
    const res = await app.request('/marketplace-payouts', {
      method: 'POST',
      headers: { 'X-Cron-Secret': wrongSecret },
    });
    expect(res.status).toBe(401);
  });

  it('handles missing REVEALUI_CRON_SECRET env var', async () => {
    delete process.env.REVEALUI_CRON_SECRET;

    const res = await app.request('/marketplace-payouts', {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'anything' },
    });
    expect(res.status).toBe(401);
  });
});
