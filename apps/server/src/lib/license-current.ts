/**
 * Owner license lookup for GET /api/license/current.
 *
 * Latest row for the signed-in user (not latest-active like /refresh).
 * Never mints. Never logs the JWT.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { readLicenseJti } from '@revealui/core/license';
import { getClient, isJtiRevoked } from '@revealui/db';
import { licenses } from '@revealui/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

const PAID_TIERS = new Set(['pro', 'max', 'enterprise']);

export type LicenseCurrentStatus = 'active' | 'none' | 'revoked' | 'support_expired';

export type LicenseCurrentResult = {
  licenseKey: string | null;
  status: LicenseCurrentStatus;
  tier: 'pro' | 'max' | 'enterprise' | null;
  expiresAt: string | null;
};

export function isLicenseAutoProvisionEnabled(): boolean {
  return process.env.REVEALUI_LICENSE_AUTO_PROVISION === 'true';
}

function serializeExpiresAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function paidTier(raw: string | null | undefined): 'pro' | 'max' | 'enterprise' | null {
  if (raw && PAID_TIERS.has(raw)) return raw as 'pro' | 'max' | 'enterprise';
  return null;
}

function empty(status: LicenseCurrentStatus): LicenseCurrentResult {
  return { licenseKey: null, status, tier: null, expiresAt: null };
}

export async function getOwnerLicenseCurrent(userId: string): Promise<LicenseCurrentResult> {
  const [row] = await getClient()
    .select({
      licenseKey: licenses.licenseKey,
      status: licenses.status,
      tier: licenses.tier,
      expiresAt: licenses.expiresAt,
    })
    .from(licenses)
    .where(
      and(
        eq(licenses.userId, userId),
        isNull(licenses.deletedAt),
        eq(licenses.mode, getConfiguredStripeMode()),
      ),
    )
    .orderBy(desc(licenses.createdAt))
    .limit(1);

  if (!row?.licenseKey) {
    return empty('none');
  }

  const expiresAt = serializeExpiresAt(row.expiresAt);
  const tier = paidTier(row.tier);

  if (row.status === 'revoked') {
    return { licenseKey: null, status: 'revoked', tier, expiresAt };
  }

  if (row.status === 'expired') {
    return empty('none');
  }

  const jti = await readLicenseJti(row.licenseKey);
  if (jti && (await isJtiRevoked(getClient(), jti))) {
    return { licenseKey: null, status: 'revoked', tier, expiresAt };
  }

  if (row.status === 'support_expired') {
    return { licenseKey: row.licenseKey, status: 'support_expired', tier, expiresAt };
  }

  if (row.status === 'active') {
    return { licenseKey: row.licenseKey, status: 'active', tier, expiresAt };
  }

  return empty('none');
}
