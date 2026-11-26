import type { LicensePayload } from '@revealui/core/license';
import { __resetJtiDenylistForTest, recordJtiRevocations } from '@revealui/db';
import { licenses } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/config/stripe-mode', () => ({ getConfiguredStripeMode: () => 'live' }));

import { queryBillingStatusForLicense, querySupportExpiry } from '../billing-status.js';

let testDb: TestDb;
const identity: LicensePayload = { customerId: 'cus_bound', tier: 'pro', jti: 'jti_bound' };

// Synthetic persisted-token metadata; callers pass a signature-verified payload.
function token(jti: string): string {
  return `${Buffer.from('{"alg":"EdDSA"}').toString('base64url')}.${Buffer.from(
    JSON.stringify({ ...identity, jti }),
  ).toString('base64url')}.fixture`;
}

async function register(overrides: Partial<typeof licenses.$inferInsert> = {}) {
  await testDb.drizzle.insert(licenses).values({
    id: crypto.randomUUID(),
    licenseKey: token(identity.jti),
    customerId: identity.customerId,
    tier: identity.tier,
    subscriptionId: crypto.randomUUID(),
    status: 'active',
    mode: 'live',
    perpetual: false,
    ...overrides,
  });
}

beforeAll(async () => {
  testDb = await createTestDb();
});
afterEach(async () => {
  __resetJtiDenylistForTest();
  await testDb.drizzle.execute(sql`DELETE FROM license_jti_revocations`);
  await testDb.drizzle.execute(sql`DELETE FROM licenses`);
});
afterAll(async () => testDb.close());

describe('registered license authority (real database)', () => {
  it('returns the status for exactly the signed grant in use', async () => {
    await register();
    expect(await queryBillingStatusForLicense(testDb.drizzle, identity)).toBe('active');
  });

  it.each(['revoked', 'expired'])(
    'cannot substitute another active grant for the customer’s %s token',
    async (status) => {
      await register({ licenseKey: token('jti_other'), status: 'active' });
      await register({ status, expiresAt: new Date(Date.now() + 86_400_000) });
      expect(await queryBillingStatusForLicense(testDb.drizzle, identity)).toBe(status);
    },
  );

  it.each([
    { mode: 'test' },
    { customerId: 'cus_other' },
    { tier: 'max' },
    { perpetual: true },
    { deletedAt: new Date() },
    { licenseKey: token('jti_other') },
  ])('does not authorize a registration outside the signed identity: %o', async (overrides) => {
    await register(overrides);
    expect(await queryBillingStatusForLicense(testDb.drizzle, identity)).toBeNull();
  });

  it('never substitutes an active test-mode row for a revoked live-mode grant', async () => {
    await register({ mode: 'test', status: 'active' });
    await register({ status: 'revoked' });
    expect(await queryBillingStatusForLicense(testDb.drizzle, identity)).toBe('revoked');
  });

  it('denies a missing or ambiguous registration', async () => {
    expect(await queryBillingStatusForLicense(testDb.drizzle, identity)).toBeNull();
    await register();
    await register({ status: 'revoked' });
    expect(await queryBillingStatusForLicense(testDb.drizzle, identity)).toBeNull();
  });

  it('checks the existing token denylist even when its registration is active', async () => {
    await register();
    await recordJtiRevocations(testDb.drizzle, [{ jti: identity.jti }]);
    expect(await queryBillingStatusForLicense(testDb.drizzle, identity)).toBe('revoked');
  });

  it('retains perpetual runtime status after support lapse', async () => {
    await register({ perpetual: true, status: 'support_expired' });
    expect(
      await queryBillingStatusForLicense(testDb.drizzle, { ...identity, perpetual: true }),
    ).toBe('support_expired');
  });

  it('binds support coverage to the exact perpetual grant', async () => {
    const expired = new Date(Date.now() - 86_400_000);
    await register({
      licenseKey: token('jti_other'),
      perpetual: true,
      supportExpiresAt: new Date(Date.now() + 86_400_000),
    });
    await register({ perpetual: true, status: 'support_expired', supportExpiresAt: expired });
    expect(await querySupportExpiry(testDb.drizzle, { ...identity, perpetual: true })).toEqual({
      perpetual: true,
      supportExpiresAt: expired,
    });
  });

  it('does not claim support coverage for a revoked perpetual grant', async () => {
    await register({ perpetual: true });
    await recordJtiRevocations(testDb.drizzle, [{ jti: identity.jti }]);
    expect(await querySupportExpiry(testDb.drizzle, { ...identity, perpetual: true })).toEqual({
      perpetual: false,
      supportExpiresAt: null,
    });
  });
});
