/**
 * Hosted helpers for GAP-260 P4-5 jti denylist.
 *
 * After a licenses row is set to `revoked`, call
 * {@link recordJtisFromLicenseKeys} so the specific JWT lineage cannot be
 * refreshed or re-verified even if a new active row is later issued for the
 * same customer.
 */

import { readLicenseExp, readLicenseJti, resetLicenseState } from '@revealui/core';
import { logger } from '@revealui/core/observability/logger';
import { getJtiRevocationEpoch, type JtiRevocationInput, recordJtiRevocations } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { licenses } from '@revealui/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Decode jtis from stored license JWTs and write denylist rows.
 * Best-effort: decoding failures skip that key (row-level revoke still holds).
 * Resets in-process license cache so a sticky tier cannot outlive the revoke.
 */
export async function recordJtisFromLicenseKeys(
  db: Database,
  licenseKeys: readonly string[],
  reason: string,
  customerId?: string | null,
): Promise<number> {
  const entries: JtiRevocationInput[] = [];
  for (const key of licenseKeys) {
    if (!key?.trim()) continue;
    try {
      const jti = await readLicenseJti(key);
      if (!jti) continue;
      const expSec = await readLicenseExp(key);
      entries.push({
        jti,
        customerId: customerId ?? null,
        reason,
        tokenExpiresAtMs: expSec != null ? expSec * 1000 : null,
      });
    } catch (err) {
      logger.warn('Could not decode jti from revoked license key', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
  if (entries.length === 0) return 0;
  const n = await recordJtiRevocations(db, entries);
  // Invalidate process-local license tier cache (sized to MAX_LICENSE_CACHE_TTL_MS).
  resetLicenseState();
  logger.info('Recorded license jti denylist entries', {
    count: n,
    reason,
    epoch: getJtiRevocationEpoch(),
  });
  return n;
}

/**
 * Load currently-revoked license keys for a customer (optional subscription
 * scope) and write their jtis to the denylist. Call after webhook paths that
 * set `licenses.status = 'revoked'`.
 */
export async function recordJtisForRevokedCustomerLicenses(
  db: Database,
  customerId: string,
  reason: string,
  subscriptionId?: string | null,
): Promise<number> {
  const conditions = [
    eq(licenses.customerId, customerId),
    eq(licenses.status, 'revoked'),
    isNull(licenses.deletedAt),
  ];
  if (subscriptionId) {
    conditions.push(eq(licenses.subscriptionId, subscriptionId));
  }
  const rows = await db
    .select({ licenseKey: licenses.licenseKey, customerId: licenses.customerId })
    .from(licenses)
    .where(and(...conditions));
  return recordJtisFromLicenseKeys(
    db,
    rows.map((r) => r.licenseKey),
    reason,
    customerId,
  );
}
