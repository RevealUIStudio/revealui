/**
 * Licenses Table - Stores generated license keys for Pro/Enterprise customers.
 *
 * License keys are JWTs signed with the REVEALUI_LICENSE_PRIVATE_KEY.
 * Generated on Stripe checkout.session.completed and stored here for
 * retrieval, auditing, and revocation.
 */

import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Licenses Table
// =============================================================================

export const licenses = pgTable(
  'licenses',
  {
    /** Unique license ID (UUID) */
    id: text('id').primaryKey(),

    /** User who owns this license */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The signed JWT license key */
    licenseKey: text('license_key').notNull(),

    /** License tier: pro or enterprise */
    tier: text('tier').notNull(),

    /** Stripe subscription ID that generated this license */
    subscriptionId: text('subscription_id'),

    /** Stripe customer ID */
    customerId: text('customer_id').notNull(),

    /** License status */
    status: text('status').notNull().default('active'),

    /** When the license was created */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** When the license was last updated */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),

    /** When the license expires (null = never for perpetual licenses) */
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    /** True for one-time perpetual purchases  -  license never expires */
    perpetual: boolean('perpetual').notNull().default(false),

    /** When annual support contract expires (perpetual only) */
    supportExpiresAt: timestamp('support_expires_at', { withTimezone: true }),

    /** GitHub username for revealui-pro team provisioning (perpetual only) */
    githubUsername: text('github_username'),

    /** npm username for @revealui Pro package access provisioning */
    npmUsername: text('npm_username'),

    /** Soft-delete  -  license records must never be hard-deleted for audit trail */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('licenses_customer_id_idx').on(table.customerId),
    index('licenses_user_id_idx').on(table.userId),
    index('licenses_status_idx').on(table.status),
    index('licenses_subscription_id_idx').on(table.subscriptionId),
    index('licenses_deleted_at_idx').on(table.deletedAt),
    uniqueIndex('licenses_customer_subscription_unique').on(table.customerId, table.subscriptionId),
    // Prevent duplicate active perpetual licenses for the same user+tier.
    // Subscriptions use subscriptionId (covered above); perpetual licenses have
    // subscriptionId=NULL so the above index doesn't prevent duplicates.
    uniqueIndex('licenses_perpetual_user_tier_unique')
      .on(table.userId, table.tier)
      .where(sql`perpetual = true AND deleted_at IS NULL`),
    // Composite indexes for common billing query patterns
    index('licenses_user_tier_status_idx').on(table.userId, table.tier, table.status),
    index('licenses_perpetual_status_support_idx').on(
      table.perpetual,
      table.status,
      table.supportExpiresAt,
    ),
    check('licenses_tier_check', sql`tier IN ('pro', 'max', 'enterprise')`),
    check(
      'licenses_status_check',
      sql`status IN ('active', 'expired', 'revoked', 'support_expired')`,
    ),
  ],
);

/** Row type for select queries */
export type LicensesRow = typeof licenses.$inferSelect;

/** Insert type for new records */
export type LicensesInsert = typeof licenses.$inferInsert;
