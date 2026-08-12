/**
 * accountHasFeature unit tests (GAP-476)
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
    userId: 'account_memberships.user_id',
    status: 'account_memberships.status',
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
  eq: (a: unknown, b: unknown) => ({ a, b }),
}));

import { accountHasFeature } from '../account-feature';

function makeDb(membershipRows: unknown[], entitlementRows: unknown[]) {
  let selectCall = 0;
  const limit = vi.fn(async () => {
    selectCall += 1;
    return selectCall === 1 ? membershipRows : entitlementRows;
  });
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select, from, where, limit };
}

describe('accountHasFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeaturesForTier.mockReturnValue({ ai: true, aiMemory: false });
  });

  it('returns false for null userId', async () => {
    const db = makeDb([], []);
    await expect(accountHasFeature(db as never, null, 'ai')).resolves.toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns false when no membership', async () => {
    const db = makeDb([], []);
    await expect(accountHasFeature(db as never, 'user-1', 'ai')).resolves.toBe(false);
  });

  it('returns false when grace expired', async () => {
    const db = makeDb(
      [{ accountId: 'acct-1' }],
      [
        {
          tier: 'pro',
          status: 'past_due',
          graceUntil: new Date(Date.now() - 60_000),
          features: { ai: true },
        },
      ],
    );
    await expect(accountHasFeature(db as never, 'user-1', 'ai')).resolves.toBe(false);
  });

  it('returns true from entitlement features map', async () => {
    const db = makeDb(
      [{ accountId: 'acct-1' }],
      [
        {
          tier: 'pro',
          status: 'active',
          graceUntil: null,
          features: { ai: true },
        },
      ],
    );
    await expect(accountHasFeature(db as never, 'user-1', 'ai')).resolves.toBe(true);
  });

  it('falls back to getFeaturesForTier when features empty', async () => {
    mockGetFeaturesForTier.mockReturnValue({ ai: true });
    const db = makeDb(
      [{ accountId: 'acct-1' }],
      [
        {
          tier: 'pro',
          status: 'active',
          graceUntil: null,
          features: {},
        },
      ],
    );
    await expect(accountHasFeature(db as never, 'user-1', 'ai')).resolves.toBe(true);
    expect(mockGetFeaturesForTier).toHaveBeenCalledWith('pro');
  });
});
