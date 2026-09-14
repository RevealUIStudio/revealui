/**
 * Owner license lookup for GET /api/license/current.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: vi.fn(() => 'live'),
}));

vi.mock('@revealui/core/license', () => ({
  readLicenseJti: vi.fn(async () => 'jti-1'),
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
  isJtiRevoked: vi.fn(async () => false),
}));

vi.mock('@revealui/db/schema', () => ({
  licenses: {
    userId: 'user_id',
    licenseKey: 'license_key',
    status: 'status',
    tier: 'tier',
    expiresAt: 'expires_at',
    deletedAt: 'deleted_at',
    mode: 'mode',
    createdAt: 'created_at',
  },
}));

import { readLicenseJti } from '@revealui/core/license';
import { getClient, isJtiRevoked } from '@revealui/db';
import { getOwnerLicenseCurrent, isLicenseAutoProvisionEnabled } from '../license-current.js';

const JWT = 'eyJhbGciOiJFZERTQSJ9.payload.sig';

function mockRows(
  rows: Array<{
    licenseKey: string;
    status: string;
    tier: string;
    expiresAt: Date | null;
  }>,
) {
  vi.mocked(getClient).mockReturnValue({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(rows),
          }),
        }),
      }),
    }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readLicenseJti).mockResolvedValue('jti-1');
  vi.mocked(isJtiRevoked).mockResolvedValue(false);
  delete process.env.REVEALUI_LICENSE_AUTO_PROVISION;
});

describe('isLicenseAutoProvisionEnabled', () => {
  it('is true when unset', () => {
    expect(isLicenseAutoProvisionEnabled()).toBe(true);
  });

  it('is false for any value other than true', () => {
    process.env.REVEALUI_LICENSE_AUTO_PROVISION = '1';
    expect(isLicenseAutoProvisionEnabled()).toBe(false);
  });

  it('is true for the string true', () => {
    process.env.REVEALUI_LICENSE_AUTO_PROVISION = 'true';
    expect(isLicenseAutoProvisionEnabled()).toBe(true);
  });
});

describe('getOwnerLicenseCurrent', () => {
  it('returns none when the user has no row', async () => {
    mockRows([]);
    await expect(getOwnerLicenseCurrent('user-a')).resolves.toEqual({
      licenseKey: null,
      status: 'none',
      tier: null,
      expiresAt: null,
    });
  });

  it('returns active JWT for the latest active row (HC4)', async () => {
    mockRows([
      {
        licenseKey: JWT,
        status: 'active',
        tier: 'pro',
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    ]);
    await expect(getOwnerLicenseCurrent('user-a')).resolves.toEqual({
      licenseKey: JWT,
      status: 'active',
      tier: 'pro',
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
  });

  it('returns revoked with no JWT when the latest row is revoked (HC4b)', async () => {
    mockRows([{ licenseKey: JWT, status: 'revoked', tier: 'pro', expiresAt: null }]);
    await expect(getOwnerLicenseCurrent('user-a')).resolves.toEqual({
      licenseKey: null,
      status: 'revoked',
      tier: 'pro',
      expiresAt: null,
    });
  });

  it('returns none when the latest row is expired', async () => {
    mockRows([{ licenseKey: JWT, status: 'expired', tier: 'pro', expiresAt: null }]);
    await expect(getOwnerLicenseCurrent('user-a')).resolves.toEqual({
      licenseKey: null,
      status: 'none',
      tier: null,
      expiresAt: null,
    });
  });

  it('returns support_expired with JWT (HC / Q6)', async () => {
    mockRows([{ licenseKey: JWT, status: 'support_expired', tier: 'max', expiresAt: null }]);
    await expect(getOwnerLicenseCurrent('user-a')).resolves.toEqual({
      licenseKey: JWT,
      status: 'support_expired',
      tier: 'max',
      expiresAt: null,
    });
  });

  it('treats denylisted jti as revoked even if the row is active', async () => {
    mockRows([{ licenseKey: JWT, status: 'active', tier: 'pro', expiresAt: null }]);
    vi.mocked(isJtiRevoked).mockResolvedValue(true);
    await expect(getOwnerLicenseCurrent('user-a')).resolves.toEqual({
      licenseKey: null,
      status: 'revoked',
      tier: 'pro',
      expiresAt: null,
    });
  });

  it('does not crash on a garbage tier', async () => {
    mockRows([{ licenseKey: JWT, status: 'active', tier: 'not-a-tier', expiresAt: null }]);
    await expect(getOwnerLicenseCurrent('user-a')).resolves.toMatchObject({
      licenseKey: JWT,
      status: 'active',
      tier: null,
    });
  });
});
