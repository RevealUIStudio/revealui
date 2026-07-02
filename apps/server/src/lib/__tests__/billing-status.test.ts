import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};

const mockDb = {
  select: vi.fn(),
};

const { mockGetConfiguredStripeMode } = vi.hoisted(() => ({
  mockGetConfiguredStripeMode: vi.fn<[], 'live' | 'test'>().mockReturnValue('live'),
}));

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: mockGetConfiguredStripeMode,
}));

vi.mock('@revealui/db/schema', () => ({
  accountEntitlements: {
    accountId: 'accountEntitlements.accountId',
    mode: 'accountEntitlements.mode',
    status: 'accountEntitlements.status',
    graceUntil: 'accountEntitlements.graceUntil',
  },
  accountSubscriptions: {
    accountId: 'accountSubscriptions.accountId',
    stripeCustomerId: 'accountSubscriptions.stripeCustomerId',
  },
  licenses: {
    customerId: 'licenses.customerId',
    mode: 'licenses.mode',
    status: 'licenses.status',
    expiresAt: 'licenses.expiresAt',
    createdAt: 'licenses.createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => `eq(${String(_col)},${String(_val)})`),
  and: vi.fn((...conds: unknown[]) => `and(${conds.join(',')})`),
  desc: vi.fn((_col: unknown) => `desc(${String(_col)})`),
  sql: Object.assign((_strings: TemplateStringsArray, ..._values: unknown[]) => 'sql-expression', {
    raw: (_s: string) => 'sql-raw',
  }),
}));

import { eq } from 'drizzle-orm';
import { queryBillingStatusByCustomerId } from '../billing-status.js';

describe('queryBillingStatusByCustomerId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfiguredStripeMode.mockReturnValue('live');
    mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
    mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
    mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
  });

  it('returns the latest legacy license status when present', async () => {
    mockDbSelectChain.limit.mockResolvedValueOnce([{ status: 'revoked', expiresAt: null }]);
    mockDb.select.mockReturnValue(mockDbSelectChain);

    const status = await queryBillingStatusByCustomerId(mockDb as never, 'cus_legacy');

    expect(status).toBe('revoked');
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('mode-scopes the license read to the configured Stripe mode (completes #1700)', async () => {
    mockGetConfiguredStripeMode.mockReturnValue('live');
    mockDbSelectChain.limit.mockResolvedValueOnce([{ status: 'active', expiresAt: null }]);
    mockDb.select.mockReturnValue(mockDbSelectChain);

    await queryBillingStatusByCustomerId(mockDb as never, 'cus_live');

    // The licenses read must carry an equality on the mode column so a leftover
    // test-mode row cannot sort ahead of a live-mode revocation for the same
    // customer (checkLicenseStatus is mounted globally on /api/*).
    expect(vi.mocked(eq)).toHaveBeenCalledWith('licenses.mode', 'live');
  });

  it('falls back to hosted account entitlements when no legacy license exists', async () => {
    mockDbSelectChain.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ accountId: 'acct_hosted' }])
      .mockResolvedValueOnce([{ status: 'expired', graceUntil: null }]);
    mockDb.select.mockReturnValue(mockDbSelectChain);

    const status = await queryBillingStatusByCustomerId(mockDb as never, 'cus_hosted');

    expect(status).toBe('expired');
    expect(mockDb.select).toHaveBeenCalledTimes(3);
    // The hosted entitlement read is likewise mode-scoped.
    expect(vi.mocked(eq)).toHaveBeenCalledWith('accountEntitlements.mode', 'live');
  });

  it('returns null when neither legacy nor hosted status exists', async () => {
    mockDbSelectChain.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockDb.select.mockReturnValue(mockDbSelectChain);

    const status = await queryBillingStatusByCustomerId(mockDb as never, 'cus_missing');

    expect(status).toBeNull();
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });
});
