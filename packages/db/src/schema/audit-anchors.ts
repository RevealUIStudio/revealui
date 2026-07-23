/**
 * Audit anchors — per-tenant Merkle roots over signed audit_log rows.
 *
 * GAP-355 Stage 4 (ANCHOR): the Fly worker builds a root over a contiguous
 * `seq` range of signed rows for a tenant, signs the root with the same
 * Ed25519 key as Stage 3 row signatures, and stores it here for delivery /
 * offline verify. Append-only by convention (no UPDATE trigger yet; job only
 * inserts). See gap-spec GAP-355-stage4-anchor-design + ADR
 * 2026-07-12-audit-receipt-architecture.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const auditAnchors = pgTable(
  'audit_anchors',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Matches audit_log.tenant; null-tenant rows are never anchored (Stage 4 §9). */
    tenant: text('tenant').notNull(),

    /** Inclusive seq range of signed audit_log rows covered by this root. */
    seqFrom: bigint('seq_from', { mode: 'number' }).notNull(),
    seqTo: bigint('seq_to', { mode: 'number' }).notNull(),

    /** Merkle root over leaf hashes of row signature strings (hex or multibase). */
    root: text('root').notNull(),

    /**
     * Root signature envelope, same shape as row signatures
     * (e.g. v1.ed25519.<kid>.<sig>).
     */
    rootSignature: text('root_signature').notNull(),

    leafCount: integer('leaf_count').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** Set when delivery to the customer succeeds (API download counts). */
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),

    /** e.g. api_download | email | webhook — null until delivered. */
    deliveryChannel: text('delivery_channel'),
  },
  (table) => [
    uniqueIndex('audit_anchors_tenant_seq_range_uidx').on(
      table.tenant,
      table.seqFrom,
      table.seqTo,
    ),
    index('audit_anchors_tenant_created_idx').on(table.tenant, table.createdAt),
    check(
      'audit_anchors_seq_range_check',
      sql`${table.seqTo} >= ${table.seqFrom}`,
    ),
    check('audit_anchors_leaf_count_check', sql`${table.leafCount} > 0`),
  ],
);

export type AuditAnchorRow = typeof auditAnchors.$inferSelect;
export type AuditAnchorInsert = typeof auditAnchors.$inferInsert;
