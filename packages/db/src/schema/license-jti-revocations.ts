/**
 * License JTI denylist (GAP-260 P4-5).
 *
 * Per-token revocation without rotating the vendor Ed25519 key. A row here
 * means the JWT with this `jti` must be refused even when the customer still
 * has an active license row (e.g. a leaked token lineage).
 *
 * Semantics (lane plan P4-5):
 * - Fail-OPEN for unknown jtis (absent from this table → not revoked).
 * - Sticky once observed revoked (process-local cache; never re-allows).
 * - Writes force cache invalidation on the writing instance.
 */

import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const licenseJtiRevocations = pgTable(
  'license_jti_revocations',
  {
    /** JWT `jti` claim (UUID string from generateLicenseKey). */
    jti: text('jti').primaryKey(),

    /** Optional Stripe / internal customer id for audit. */
    customerId: text('customer_id'),

    /** Operator / webhook reason (never a secret). */
    reason: text('reason').notNull().default('revoked'),

    /** When the denylist row was written. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }).defaultNow().notNull(),

    /**
     * Optional token exp (epoch ms) for GC of denylist rows after the JWT
     * could no longer verify. Null for perpetual tokens.
     */
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  },
  (table) => [
    index('license_jti_revocations_customer_id_idx').on(table.customerId),
    index('license_jti_revocations_revoked_at_idx').on(table.revokedAt),
  ],
);

export type LicenseJtiRevocationRow = typeof licenseJtiRevocations.$inferSelect;
export type LicenseJtiRevocationInsert = typeof licenseJtiRevocations.$inferInsert;
