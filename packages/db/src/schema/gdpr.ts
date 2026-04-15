/**
 * GDPR Tables - Persistent storage for consent records and deletion requests.
 *
 * These tables back the GDPRStorage interface from @revealui/core/security.
 * Consent records are keyed by userId + type (unique constraint).
 * Deletion requests are append-only audit records.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// =============================================================================
// Consent Records
// =============================================================================

export const gdprConsents = pgTable(
  'gdpr_consents',
  {
    /** Unique consent record ID (UUID) */
    id: text('id').primaryKey(),

    /** User who granted/revoked consent */
    userId: text('user_id').notNull(),

    /** Consent type: necessary, functional, analytics, marketing, personalization */
    type: text('type').notNull(),

    /** Whether consent is currently granted */
    granted: boolean('granted').notNull().default(true),

    /** When the consent was recorded */
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),

    /** When consent expires (null = never) */
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    /** How consent was obtained */
    source: text('source').notNull().default('explicit'),

    /** Consent version string for tracking policy changes */
    version: text('version').notNull().default('1.0'),

    /** Optional metadata (JSON) */
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    unique('gdpr_consents_user_type_uq').on(table.userId, table.type),
    index('gdpr_consents_user_id_idx').on(table.userId),
    index('gdpr_consents_type_idx').on(table.type),
    index('gdpr_consents_granted_idx').on(table.granted),
    check(
      'gdpr_consents_type_check',
      sql`type IN ('necessary', 'functional', 'analytics', 'marketing', 'personalization')`,
    ),
  ],
);

/** Row type for select queries */
export type GdprConsentRow = typeof gdprConsents.$inferSelect;

/** Insert type for new records */
export type GdprConsentInsert = typeof gdprConsents.$inferInsert;

// =============================================================================
// Deletion Requests
// =============================================================================

export const gdprDeletionRequests = pgTable(
  'gdpr_deletion_requests',
  {
    /** Unique request ID (UUID) */
    id: text('id').primaryKey(),

    /** User who requested deletion */
    userId: text('user_id').notNull(),

    /** When the request was submitted */
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),

    /** When the request was processed (null = pending) */
    processedAt: timestamp('processed_at', { withTimezone: true }),

    /** Request status */
    status: text('status').notNull().default('pending'),

    /** Data categories requested for deletion (JSON array) */
    dataCategories: jsonb('data_categories').$type<string[]>().notNull().default(['personal']),

    /** User-supplied reason */
    reason: text('reason'),

    /** Data categories that were retained (legal obligation, etc.) */
    retainedData: jsonb('retained_data').$type<string[]>(),

    /** Data categories that were successfully deleted */
    deletedData: jsonb('deleted_data').$type<string[]>(),
  },
  (table) => [
    index('gdpr_deletion_requests_user_id_idx').on(table.userId),
    index('gdpr_deletion_requests_status_idx').on(table.status),
    index('gdpr_deletion_requests_requested_at_idx').on(table.requestedAt),
    check(
      'gdpr_deletion_requests_status_check',
      sql`status IN ('pending', 'processing', 'completed', 'failed')`,
    ),
  ],
);

/** Row type for select queries */
export type GdprDeletionRequestRow = typeof gdprDeletionRequests.$inferSelect;

/** Insert type for new records */
export type GdprDeletionRequestInsert = typeof gdprDeletionRequests.$inferInsert;

// =============================================================================
// Data Breach Records
// =============================================================================

export const gdprBreaches = pgTable(
  'gdpr_breaches',
  {
    /** Unique breach ID (UUID) */
    id: text('id').primaryKey(),

    /** When the breach was detected */
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),

    /** When authorities were notified (GDPR requires within 72 hours) */
    reportedAt: timestamp('reported_at', { withTimezone: true }),

    /** Breach type */
    type: text('type').notNull(),

    /** Severity: low, medium, high, critical */
    severity: text('severity').notNull(),

    /** IDs of affected users */
    affectedUsers: jsonb('affected_users').$type<string[]>().notNull().default([]),

    /** Categories of data affected */
    dataCategories: jsonb('data_categories').$type<string[]>().notNull().default([]),

    /** Description of the breach */
    description: text('description').notNull(),

    /** Mitigation steps taken */
    mitigation: text('mitigation'),

    /** Status: detected, investigating, notified, resolved */
    status: text('status').notNull().default('detected'),
  },
  (table) => [
    index('gdpr_breaches_detected_at_idx').on(table.detectedAt),
    index('gdpr_breaches_status_idx').on(table.status),
    index('gdpr_breaches_severity_idx').on(table.severity),
    check('gdpr_breaches_severity_check', sql`severity IN ('low', 'medium', 'high', 'critical')`),
    check(
      'gdpr_breaches_status_check',
      sql`status IN ('detected', 'investigating', 'notified', 'resolved')`,
    ),
  ],
);

/** Row type for select queries */
export type GdprBreachRow = typeof gdprBreaches.$inferSelect;

/** Insert type for new records */
export type GdprBreachInsert = typeof gdprBreaches.$inferInsert;
