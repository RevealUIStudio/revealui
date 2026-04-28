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

vi.mock('@revealui/db/schema', () => ({
  accountEntitlements: {
    accountId: 'accountEntitlements.accountId',
    status: 'accountEntitlements.status',
    graceUntil: 'accountEntitlements.graceUntil',
  },
  accountSubscriptions: {
    accountId: 'accountSubscriptions.accountId',
    stripeCustomerId: 'accountSubscriptions.stripeCustomerId',
  },
  licenses: {
    customerId: 'licenses.customerId',
    status: 'licenses.status',
    expiresAt: 'licenses.expiresAt',
    createdAt: 'licenses.createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
  desc: vi.fn((_col) => `desc(${String(_col)})`),
  sql: Object.assign((_strings: TemplateStringsArray, ..._values: unknown[]) => 'sql-expression', {
    raw: (_s: string) => 'sql-raw',
  }),
}));

import { queryBillingStatusByCustomerId } from '../billing-status.js';

describe('queryBillingStatusByCustomerId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('falls back to hosted account entitlements when no legacy license exists', async () => {
    mockDbSelectChain.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ accountId: 'acct_hosted' }])
      .mockResolvedValueOnce([{ status: 'expired', graceUntil: null }]);
    mockDb.select.mockReturnValue(mockDbSelectChain);

    const status = await queryBillingStatusByCustomerId(mockDb as never, 'cus_hosted');

    expect(status).toBe('expired');
    expect(mockDb.select).toHaveBeenCalledTimes(3);
  });

  it('returns null when neither legacy nor hosted status exists', async () => {
    mockDbSelectChain.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockDb.select.mockReturnValue(mockDbSelectChain);

    const status = await queryBillingStatusByCustomerId(mockDb as never, 'cus_missing');

    expect(status).toBeNull();
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });
});
