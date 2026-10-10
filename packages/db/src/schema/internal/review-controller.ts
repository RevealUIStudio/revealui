import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const reviewControllerWebhookInbox = pgTable(
  'review_controller_webhook_inbox',
  {
    deliveryId: text('delivery_id').primaryKey(),
    eventName: text('event_name').notNull(),
    installationId: bigint('installation_id', { mode: 'number' }).notNull(),
    repositoryId: bigint('repository_id', { mode: 'number' }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    state: text('state').$type<'pending' | 'processing' | 'completed' | 'failed'>().notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    leaseToken: uuid('lease_token'),
    lastErrorCode: text('last_error_code'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'review_controller_webhook_ids_positive',
      sql`${table.installationId} > 0 AND ${table.repositoryId} > 0`,
    ),
    check(
      'review_controller_webhook_state_valid',
      sql`${table.state} IN ('pending', 'processing', 'completed', 'failed')`,
    ),
    check('review_controller_webhook_attempts_nonnegative', sql`${table.attempts} >= 0`),
    index('review_controller_inbox_pending_idx')
      .on(table.nextAttemptAt, table.receivedAt, table.deliveryId)
      .where(sql`${table.state} IN ('pending', 'failed')`),
  ],
);

export const reviewControllerShadowObservations = pgTable(
  'review_controller_shadow_observations',
  {
    observationId: uuid('observation_id').defaultRandom().primaryKey(),
    deliveryId: text('delivery_id')
      .notNull()
      .references(() => reviewControllerWebhookInbox.deliveryId, { onDelete: 'restrict' }),
    eventKind: text('event_kind').$type<'pull_request' | 'merge_group'>().notNull(),
    repositoryId: bigint('repository_id', { mode: 'number' }).notNull(),
    pullRequest: integer('pull_request'),
    headSha: text('head_sha').notNull(),
    headTreeSha: text('head_tree_sha').notNull(),
    baseSha: text('base_sha'),
    baseTreeSha: text('base_tree_sha'),
    manifestSha256: text('manifest_sha256'),
    fileCount: integer('file_count'),
    checkRuns: jsonb('check_runs').$type<unknown[]>().notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('review_controller_observation_repository_positive', sql`${table.repositoryId} > 0`),
    check(
      'review_controller_observation_event_kind',
      sql`${table.eventKind} IN ('pull_request', 'merge_group')`,
    ),
    check(
      'review_controller_observation_shape',
      sql`(
      (${table.eventKind} = 'pull_request' AND ${table.pullRequest} IS NOT NULL AND ${table.baseSha} IS NOT NULL
        AND ${table.baseTreeSha} IS NOT NULL AND ${table.manifestSha256} IS NOT NULL AND ${table.fileCount} IS NOT NULL)
      OR
      (${table.eventKind} = 'merge_group' AND ${table.pullRequest} IS NULL AND ${table.baseSha} IS NOT NULL
        AND ${table.baseTreeSha} IS NULL AND ${table.manifestSha256} IS NULL AND ${table.fileCount} IS NULL)
    )`,
    ),
    check(
      'review_controller_observation_manifest_nonnegative',
      sql`${table.fileCount} IS NULL OR ${table.fileCount} >= 0`,
    ),
    uniqueIndex('review_controller_observation_delivery_pr_unique').on(
      table.deliveryId,
      table.pullRequest,
    ),
    uniqueIndex('review_controller_merge_group_delivery_idx')
      .on(table.deliveryId)
      .where(sql`${table.eventKind} = 'merge_group'`),
    index('review_controller_shadow_candidate_idx').on(
      table.repositoryId,
      table.pullRequest,
      table.headSha,
      table.baseSha,
      table.observedAt,
    ),
  ],
);

export const reviewControllerSignedReceipts = pgTable(
  'review_controller_signed_receipts',
  {
    receiptId: text('receipt_id').primaryKey(),
    repositoryId: bigint('repository_id', { mode: 'number' }).notNull(),
    pullRequest: integer('pull_request').notNull(),
    headSha: text('head_sha').notNull(),
    baseSha: text('base_sha').notNull(),
    candidateTreeSha: text('candidate_tree_sha').notNull(),
    policyVersion: text('policy_version').notNull(),
    keyId: text('key_id').notNull(),
    envelopeSha256: text('envelope_sha256').notNull(),
    canonicalEnvelope: text('canonical_envelope').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    storedAt: timestamp('stored_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('review_controller_receipt_repository_positive', sql`${table.repositoryId} > 0`),
    check('review_controller_receipt_pull_request_positive', sql`${table.pullRequest} > 0`),
    check('review_controller_receipt_head_sha', sql`${table.headSha} ~ '^[a-f0-9]{40,64}$'`),
    check('review_controller_receipt_base_sha', sql`${table.baseSha} ~ '^[a-f0-9]{40,64}$'`),
    check(
      'review_controller_receipt_candidate_sha',
      sql`${table.candidateTreeSha} ~ '^[a-f0-9]{40,64}$'`,
    ),
    check(
      'review_controller_receipt_envelope_sha',
      sql`${table.envelopeSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    check('review_controller_receipt_expiry', sql`${table.expiresAt} > ${table.issuedAt}`),
    index('review_controller_receipt_candidate_idx').on(
      table.repositoryId,
      table.pullRequest,
      table.headSha,
      table.baseSha,
      table.candidateTreeSha,
      table.issuedAt,
    ),
  ],
);

export const reviewControllerSchema = {
  reviewControllerWebhookInbox,
  reviewControllerShadowObservations,
  reviewControllerSignedReceipts,
};
