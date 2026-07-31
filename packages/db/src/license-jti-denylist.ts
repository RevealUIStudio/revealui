/**
 * License JTI denylist (GAP-260 P4-5).
 *
 * Consult before accepting a verified license JWT. Fail-OPEN for unknown
 * jtis (not in table → allow). Once a jti is observed revoked, it stays
 * revoked in the process-local sticky set (never re-allows on this instance).
 * Revocation writes bump a local epoch and set sticky immediately.
 *
 * SLA for multi-instance: non-sticky instances re-query the DB on every check
 * until they observe the row, then stick. License tier cache TTL is capped at
 * {@link MAX_LICENSE_CACHE_TTL_MS} (15 min) fleet-wide — denylist propagation
 * is sized to that window, not a shorter ad-hoc TTL.
 */

import { eq } from 'drizzle-orm';
import type { Database } from './client/index.js';
import { licenseJtiRevocations } from './schema/license-jti-revocations.js';

/** Sticky set of jtis known-revoked on this process. Never stores "allowed". */
const stickyRevoked = new Set<string>();

/**
 * Monotonic epoch bumped on every successful denylist write. Callers that
 * keep a snapshot can detect that their local view is stale (for cache
 * invalidation of higher-level license state).
 */
let revocationEpoch = 0;

export function getJtiRevocationEpoch(): number {
  return revocationEpoch;
}

/** Test-only: clear sticky state + epoch. */
export function __resetJtiDenylistForTest(): void {
  stickyRevoked.clear();
  revocationEpoch = 0;
}

export type JtiRevocationInput = {
  jti: string;
  customerId?: string | null;
  reason?: string;
  /** Epoch ms; omit for perpetual tokens. */
  tokenExpiresAtMs?: number | null;
};

/**
 * Record one or more jtis as revoked. Idempotent upsert. Sets sticky + bumps
 * epoch on success.
 */
export async function recordJtiRevocations(
  db: Database,
  entries: readonly JtiRevocationInput[],
): Promise<number> {
  if (entries.length === 0) return 0;
  let written = 0;
  for (const entry of entries) {
    const jti = entry.jti?.trim();
    if (!jti) continue;
    // First write wins (idempotent). Sticky still updates so this instance
    // never re-allows even if the row already existed.
    await db
      .insert(licenseJtiRevocations)
      .values({
        jti,
        customerId: entry.customerId ?? null,
        reason: entry.reason?.trim() || 'revoked',
        tokenExpiresAt:
          entry.tokenExpiresAtMs != null && Number.isFinite(entry.tokenExpiresAtMs)
            ? new Date(entry.tokenExpiresAtMs)
            : null,
      })
      .onConflictDoNothing();
    stickyRevoked.add(jti);
    written += 1;
  }
  if (written > 0) {
    revocationEpoch += 1;
  }
  return written;
}

/**
 * Whether `jti` is on the denylist.
 *
 * - Sticky true → true (never re-opens).
 * - DB row present → set sticky, true.
 * - DB row absent → false (fail-open for unknown).
 * - DB error → false (fail-open for unknown only; sticky true still denies).
 */
export async function isJtiRevoked(db: Database, jti: string | undefined | null): Promise<boolean> {
  const key = jti?.trim();
  if (!key) {
    // Tokens without jti cannot be individually denylisted; row-level
    // revocation still applies at the licenses table. Treat missing jti as
    // not denylisted here (fail-open for this table only).
    return false;
  }
  if (stickyRevoked.has(key)) return true;

  try {
    const [row] = await db
      .select({ jti: licenseJtiRevocations.jti })
      .from(licenseJtiRevocations)
      .where(eq(licenseJtiRevocations.jti, key))
      .limit(1);
    if (row) {
      stickyRevoked.add(key);
      return true;
    }
    return false;
  } catch {
    // Fail-open for UNKNOWN only — sticky already handled above.
    return false;
  }
}
