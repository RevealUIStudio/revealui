/** Query mappings for the existing isolated 0005 validation-only migration.
 * These declarations do not register a runtime owner or grant table access.
 * SQL migration triggers/checks remain authoritative for custody transitions.
 */
import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const reviewControllerMergeIntents = pgTable('review_controller_merge_intents', {
  jobId: text('job_id').primaryKey(),
  repositoryId: bigint('repository_id', { mode: 'number' }).notNull(),
  baseRef: text('base_ref').notNull(),
  canonicalPayload: text('canonical_payload').notNull(),
  payloadSha256: text('payload_sha256').notNull(),
  state: text('state')
    .$type<'proposed' | 'dispatch-committed' | 'unknown' | 'rejected'>()
    .notNull()
    .default('proposed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviewControllerMergeReconciliationObservations = pgTable(
  'review_controller_merge_reconciliation_observations',
  {
    observationId: text('observation_id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => reviewControllerMergeIntents.jobId),
    kind: text('kind')
      .$type<
        | 'refs-unchanged'
        | 'refs-advanced'
        | 'pr-outcome-observed'
        | 'definitive-rejection'
        | 'delivery-uncertain'
      >()
      .notNull(),
    evidenceSha256: text('evidence_sha256').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
);
