/**
 * accountHasFeature unit tests (GAP-476 / GAP-477 membership resolve)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetConfiguredStripeMode = vi.fn(() => 'test' as const);
const mockGetFeaturesForTier = vi.fn();

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: () => mockGetConfiguredStripeMode(),
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: (...args: unknown[]) => mockGetFeaturesForTier(...args),
}));

vi.mock('@revealui/db/schema', () => ({
  accountMemberships: {
    accountId: 'account_memberships.account_id',
    role: 'account_memberships.role',
    userId: 'account_memberships.user_id',
    status: 'account_memberships.status',
    createdAt: 'account_memberships.created_at',
  },
  accounts: {
    id: 'accounts.id',
    slug: 'accounts.slug',
  },
  accountEntitlements: {
    accountId: 'account_entitlements.account_id',
    mode: 'account_entitlements.mode',
    tier: 'account_entitlements.tier',
    status: 'account_entitlements.status',
    graceUntil: 'account_entitlements.grace_until',
    features: 'account_entitlements.features',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  asc: (x: unknown) => x,
  eq: (a: unknown, b: unknown) => ({ a, b }),
  or: (...args: unknown[]) => args,
}));

import { accountHasFeature } from '../account-feature';

/**
 * Fluent select chain for resolveActiveMembership + entitlement lookup.
 * Each terminal `.limit()` pops the next result queue entry.
 */
function makeDb(limitResults: unknown[][]) {
  const queue = [...limitResults];
  const limit = vi.fn(async () => queue.shift() ?? []);
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit,
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  const select = vi.fn(() => chain);
  return { select, chain, limit };
}

describe('accountHasFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeaturesForTier.mockReturnValue({ ai: true, aiMemory: false });
  });

  it('returns false for null userId', async () => {
    const db = makeDb([]);
    await expect(accountHasFeature(db as never, null, 'ai')).resolves.toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns false when no membership', async () => {
    // resolveActiveMembership: empty rows
    const db = makeDb([[]]);
    await expect(accountHasFeature(db as never, 'user-1', 'ai')).resolves.toBe(false);
  });

  it('returns false when grace expired', async () => {
    const db = makeDb([
      [{ accountId: 'acct-1', role: 'owner' }],
      [
        {
          tier: 'pro',
          status: 'past_due',
          graceUntil: new Date(Date.now() - 60_000),
          features: { ai: true },
        },
      ],
    ]);
    await expect(accountHasFeature(db as never, 'user-1', 'ai')).resolves.toBe(false);
  });

  it('returns true from entitlement features map', async () => {
    const db = makeDb([
      [{ accountId: 'acct-1', role: 'owner' }],
      [
        {
          tier: 'pro',
          status: 'active',
          graceUntil: null,
          features: { ai: true },
        },
      ],
    ]);
    await expect(accountHasFeature(db as never, 'user-1', 'ai')).resolves.toBe(true);
  });

  it('falls back to getFeaturesForTier when features empty', async () => {
    mockGetFeaturesForTier.mockReturnValue({ ai: true });
    const db = makeDb([
      [{ accountId: 'acct-1', role: 'member' }],
      [
        {
          tier: 'pro',
          status: 'active',
          graceUntil: null,
          features: {},
        },
      ],
    ]);
    await expect(accountHasFeature(db as never, 'user-1', 'ai')).resolves.toBe(true);
    expect(mockGetFeaturesForTier).toHaveBeenCalledWith('pro');
  });

  it('uses preferred account membership when provided', async () => {
    const db = makeDb([
      [{ accountId: 'acct-preferred', role: 'owner' }],
      [
        {
          tier: 'pro',
          status: 'active',
          graceUntil: null,
          features: { ai: true },
        },
      ],
    ]);
    await expect(accountHasFeature(db as never, 'user-1', 'ai', 'acct-preferred')).resolves.toBe(
      true,
    );
    expect(db.chain.innerJoin).toHaveBeenCalled();
  });
});
