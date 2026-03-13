import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
};

const mockDb = {
  select: vi.fn(),
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  accountMemberships: {
    accountId: 'account_memberships.accountId',
    userId: 'account_memberships.userId',
    role: 'account_memberships.role',
    status: 'account_memberships.status',
  },
  accountEntitlements: {
    accountId: 'account_entitlements.accountId',
    tier: 'account_entitlements.tier',
    status: 'account_entitlements.status',
    features: 'account_entitlements.features',
    limits: 'account_entitlements.limits',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
}));

import { entitlementMiddleware, getEntitlementsFromContext } from '../entitlements.js';
import { errorHandler } from '../error.js';

let selectResults: unknown[][] = [];

function createApp(user?: { id: string }) {
  const app = new Hono<{ Variables: { user?: { id: string }; entitlements?: unknown } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    await next();
  });
  app.use('*', entitlementMiddleware());
  app.get('/test', (c) => c.json(getEntitlementsFromContext(c)));
  app.onError(errorHandler);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResults = [];
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.limit.mockImplementation(() => Promise.resolve(selectResults.shift() ?? []));
  mockDb.select.mockReturnValue(mockDbSelectChain);
});

afterEach(() => {
  selectResults = [];
});

describe('entitlementMiddleware', () => {
  it('attaches free entitlements for anonymous requests', async () => {
    const app = createApp();
    const res = await app.request('/test');
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.tier).toBe('free');
    expect(body.accountId).toBeNull();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('attaches free entitlements when the user has no active membership', async () => {
    selectResults = [[]];

    const app = createApp({ id: 'user-1' });
    const res = await app.request('/test');
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.userId).toBe('user-1');
    expect(body.tier).toBe('free');
    expect(body.accountId).toBeNull();
  });

  it('attaches account entitlements for an active membership', async () => {
    selectResults = [
      [{ accountId: 'acct_1', role: 'owner' }],
      [
        {
          tier: 'pro',
          status: 'active',
          features: { ai: true },
          limits: { maxSites: 5, maxUsers: 25 },
        },
      ],
    ];

    const app = createApp({ id: 'user-1' });
    const res = await app.request('/test');
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.accountId).toBe('acct_1');
    expect(body.membershipRole).toBe('owner');
    expect(body.tier).toBe('pro');
    expect(body.subscriptionStatus).toBe('active');
    expect(body.features).toEqual({ ai: true });
  });

  it('falls back to free tier when membership exists but entitlement row does not', async () => {
    selectResults = [[{ accountId: 'acct_1', role: 'member' }], []];

    const app = createApp({ id: 'user-1' });
    const res = await app.request('/test');
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.accountId).toBe('acct_1');
    expect(body.tier).toBe('free');
    expect(body.membershipRole).toBe('member');
    expect(body.subscriptionStatus).toBeNull();
  });
});
