import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { type LicensePayload, readLicenseJti } from '@revealui/core/license';
import { isJtiRevoked } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { licenses } from '@revealui/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Read the registration for the configured, already signature-verified grant.
 * A different license owned by the customer cannot authorize this token.
 * Stored-token decoding only binds trusted registration metadata to the signed
 * request identity; it never establishes the token's signature or entitlement.
 */
async function queryRegisteredLicense(db: Database, payload: LicensePayload) {
  if (!payload.jti?.trim() || payload.jti !== payload.jti.trim()) return null;
  const candidates = await db
    .select({
      licenseKey: licenses.licenseKey,
      status: licenses.status,
      supportExpiresAt: licenses.supportExpiresAt,
      perpetual: licenses.perpetual,
    })
    .from(licenses)
    .where(
      and(
        eq(licenses.customerId, payload.customerId),
        eq(licenses.tier, payload.tier),
        eq(licenses.perpetual, payload.perpetual === true),
        eq(licenses.mode, getConfiguredStripeMode()),
        isNull(licenses.deletedAt),
      ),
    );
  let matched: (typeof candidates)[number] | null = null;
  for (const candidate of candidates) {
    if ((await readLicenseJti(candidate.licenseKey)) !== payload.jti) continue;
    // An ambiguous registration cannot turn one terminal row into a grant.
    if (matched) return null;
    matched = candidate;
  }
  return matched;
}

/** Authoritative runtime status for exactly the signed grant in use. */
export async function queryBillingStatusForLicense(
  db: Database,
  payload: LicensePayload,
): Promise<string | null> {
  if (!payload.jti?.trim() || payload.jti !== payload.jti.trim()) return null;
  if (await isJtiRevoked(db, payload.jti)) return 'revoked';
  const license = await queryRegisteredLicense(db, payload);
  return license?.status ?? null;
}

/** Result of a support expiry query for perpetual licenses */
export interface SupportExpiryInfo {
  /** When the support contract expires (null if not a perpetual license) */
  supportExpiresAt: Date | null;
  /** Whether this is a perpetual license */
  perpetual: boolean;
}

/**
 * Read advisory support coverage for the same signed perpetual grant.
 * Another perpetual license cannot supply its support coverage.
 */
export async function querySupportExpiry(
  db: Database,
  payload: LicensePayload,
): Promise<SupportExpiryInfo> {
  if (payload.perpetual !== true || (await isJtiRevoked(db, payload.jti))) {
    return { supportExpiresAt: null, perpetual: false };
  }
  const license = await queryRegisteredLicense(db, payload);
  if (!license || (license.status !== 'active' && license.status !== 'support_expired')) {
    return { supportExpiresAt: null, perpetual: false };
  }

  return {
    supportExpiresAt: license.supportExpiresAt,
    perpetual: true,
  };
}
