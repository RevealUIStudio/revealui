import type { Database } from '@revealui/db/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/config/stripe-mode', () => ({ getConfiguredStripeMode: () => 'live' }));
vi.mock('../resolve-membership.js', () => ({
  resolveActiveMembership: vi.fn(async () => ({ accountId: 'acct_1' })),
}));

import {
  accountHasAiFeature,
  accountHasAuditLogFeature,
  accountHasSsoFeature,
} from '../account-entitlement.js';

const now = new Date('2026-10-04T12:00:00Z');
const futureGrace = new Date(now.getTime() + 86_400_000);

function databaseWithEntitlement(status: string | null, graceUntil: Date | null): Database {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(async () => [
      {
        tier: 'enterprise',
        status,
        graceUntil,
        features: { ai: true, auditLog: true, sso: true },
      },
    ]),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return { select: vi.fn(() => chain) } as unknown as Database;
}

describe('account feature status enforcement', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
  });
  afterEach(() => vi.restoreAllMocks());

  const consumers = [
    ['AI worker', accountHasAiFeature],
    ['audit roots', accountHasAuditLogFeature],
    ['SSO', accountHasSsoFeature],
  ] as const;

  for (const [name, check] of consumers) {
    it.each(['revoked', 'expired', 'unknown', null])(
      `denies ${name} for %s even when a stale grace date is in the future`,
      async (status) => {
        expect(await check(databaseWithEntitlement(status, futureGrace), 'acct_1')).toBe(false);
      },
    );

    it.each(['past_due', 'canceled'])(`retains ${name} during %s renewal grace`, async (status) => {
      expect(await check(databaseWithEntitlement(status, futureGrace), 'acct_1')).toBe(true);
      expect(await check(databaseWithEntitlement(status, now), 'acct_1')).toBe(false);
    });

    it.each(['active', 'trialing'])(`retains ${name} for %s without grace`, async (status) => {
      expect(await check(databaseWithEntitlement(status, null), 'acct_1')).toBe(true);
    });
  }
});
