/**
 * K-2 — marketplace-payouts cron idempotency (P0 fix)
 *
 * The old code called transfers.create BEFORE writing stripeTransferId to the
 * DB, with no Stripe idempotency key. A cron crash between Stripe success and
 * the DB update would cause the next run to double-pay the same developer.
 *
 * The fix:
 * 1. Adds a deterministic idempotencyKey derived from sorted transaction IDs.
 * 2. Writes stripeTransferId to DB AFTER transfers.create, using the returned
 *    transfer.id — idempotent on Stripe's side if the cron retries.
 *
 * These tests verify the idempotency key is present and the Stripe API is
 * called with it correctly.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockTransfersCreate = vi.hoisted(() => vi.fn());

vi.mock('../../lib/services-loader.js', () => ({
  getServices: vi.fn().mockResolvedValue({
    protectedStripe: {
      transfers: { create: mockTransfersCreate },
    },
  }),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── DB mock — fluent chain ───────────────────────────────────────────────────

const mockDbSelectChain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  groupBy: vi.fn(),
};
const mockDbUpdateChain = { set: vi.fn(), where: vi.fn() };
const mockDb = { select: vi.fn(), update: vi.fn() };

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  marketplaceTransactions: {
    id: 'marketplaceTransactions.id',
    status: 'marketplaceTransactions.status',
    stripeTransferId: 'marketplaceTransactions.stripeTransferId',
    serverId: 'marketplaceTransactions.serverId',
    developerAmountUsdc: 'marketplaceTransactions.developerAmountUsdc',
  },
  marketplaceServers: {
    id: 'marketplaceServers.id',
    stripeAccountId: 'marketplaceServers.stripeAccountId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => `eq(${String(_col)},${String(_val)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  isNull: vi.fn((_col: unknown) => `isNull(${String(_col)})`),
  inArray: vi.fn((_col, _vals) => `inArray(${String(_col)})`),
  sql: Object.assign(
    vi.fn((s: TemplateStringsArray) => String(s)),
    { join: vi.fn() },
  ),
}));

// ─── Import under test ────────────────────────────────────────────────────────

import payoutsApp from '../cron/marketplace-payouts.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-abc';

function cronRequest() {
  return new Request('http://localhost/marketplace-payouts', {
    method: 'POST',
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
}

function setupDb(
  payoutBatches: Array<{
    stripeAccountId: string;
    totalDeveloperUsdc: string;
    transactionCount: number;
    transactionIds: string[];
  }>,
) {
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.innerJoin.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.groupBy.mockResolvedValue(payoutBatches);
  mockDb.select.mockReturnValue(mockDbSelectChain);

  mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
  mockDbUpdateChain.where.mockResolvedValue({ rowCount: payoutBatches.length });
  mockDb.update.mockReturnValue(mockDbUpdateChain);
}

function createApp() {
  const app = new Hono();
  app.route('/', payoutsApp);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('marketplace-payouts cron — K-2 idempotency fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  });

  it('passes a deterministic idempotencyKey to transfers.create', async () => {
    const txIds = ['tx-b', 'tx-a', 'tx-c'];
    setupDb([
      {
        stripeAccountId: 'acct_developer_1',
        totalDeveloperUsdc: '1.50',
        transactionCount: 3,
        transactionIds: txIds,
      },
    ]);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_test_1' });

    const app = createApp();
    const res = await app.request(cronRequest());
    expect(res.status).toBe(200);

    expect(mockTransfersCreate).toHaveBeenCalledTimes(1);
    const [, options] = mockTransfersCreate.mock.calls[0] as [unknown, { idempotencyKey: string }];
    expect(options?.idempotencyKey).toBeDefined();
    expect(typeof options.idempotencyKey).toBe('string');
    expect(options.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('idempotency key is stable regardless of transaction ID order in the input array', async () => {
    const txIds1 = ['tx-b', 'tx-a', 'tx-c'];
    const txIds2 = ['tx-c', 'tx-b', 'tx-a'];

    setupDb([
      {
        stripeAccountId: 'acct_dev',
        totalDeveloperUsdc: '1.00',
        transactionCount: 3,
        transactionIds: txIds1,
      },
    ]);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_1' });
    const app = createApp();
    await app.request(cronRequest());
    const [, opts1] = mockTransfersCreate.mock.calls[0] as [unknown, { idempotencyKey: string }];

    vi.clearAllMocks();
    setupDb([
      {
        stripeAccountId: 'acct_dev',
        totalDeveloperUsdc: '1.00',
        transactionCount: 3,
        transactionIds: txIds2,
      },
    ]);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_1' });
    await app.request(cronRequest());
    const [, opts2] = mockTransfersCreate.mock.calls[0] as [unknown, { idempotencyKey: string }];

    expect(opts1.idempotencyKey).toBe(opts2.idempotencyKey);
  });

  it('different stripeAccountIds produce different idempotency keys', async () => {
    setupDb([
      {
        stripeAccountId: 'acct_dev_1',
        totalDeveloperUsdc: '1.00',
        transactionCount: 1,
        transactionIds: ['tx-a'],
      },
      {
        stripeAccountId: 'acct_dev_2',
        totalDeveloperUsdc: '1.00',
        transactionCount: 1,
        transactionIds: ['tx-a'],
      },
    ]);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_multi' });

    const app = createApp();
    await app.request(cronRequest());
    expect(mockTransfersCreate).toHaveBeenCalledTimes(2);

    const [, opts1] = mockTransfersCreate.mock.calls[0] as [unknown, { idempotencyKey: string }];
    const [, opts2] = mockTransfersCreate.mock.calls[1] as [unknown, { idempotencyKey: string }];
    expect(opts1.idempotencyKey).not.toBe(opts2.idempotencyKey);
  });

  it('writes stripeTransferId to DB after successful Stripe call', async () => {
    setupDb([
      {
        stripeAccountId: 'acct_dev',
        totalDeveloperUsdc: '2.00',
        transactionCount: 2,
        transactionIds: ['tx-1', 'tx-2'],
      },
    ]);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_write_test' });

    const app = createApp();
    const res = await app.request(cronRequest());
    expect(res.status).toBe(200);

    expect(mockDb.update).toHaveBeenCalled();
    const setArg = mockDbUpdateChain.set.mock.calls[0][0] as Record<string, unknown>;
    expect(setArg.stripeTransferId).toBe('tr_write_test');
  });

  it('does not update DB when Stripe transfer fails', async () => {
    setupDb([
      {
        stripeAccountId: 'acct_failing',
        totalDeveloperUsdc: '1.00',
        transactionCount: 1,
        transactionIds: ['tx-fail'],
      },
    ]);
    mockTransfersCreate.mockRejectedValue(new Error('Stripe error'));

    const app = createApp();
    const res = await app.request(cronRequest());
    expect(res.status).toBe(200);

    expect(mockDb.update).not.toHaveBeenCalled();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.failed).toBe(1);
  });

  it('skips batches below the $0.50 minimum and does not call transfers.create', async () => {
    setupDb([
      {
        stripeAccountId: 'acct_small',
        totalDeveloperUsdc: '0.30',
        transactionCount: 3,
        transactionIds: ['tx-x', 'tx-y', 'tx-z'],
      },
    ]);

    const app = createApp();
    const res = await app.request(cronRequest());
    expect(res.status).toBe(200);
    expect(mockTransfersCreate).not.toHaveBeenCalled();
  });
});
