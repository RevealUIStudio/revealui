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
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * GAP-427 (ruling 2026-07-27), relocated here GAP-447: the audit_anchors.tenant
 * value for anchors over null-tenant (system) audit_log rows. audit_anchors.tenant
 * is NOT NULL, so a sentinel avoids a schema migration; the underlying
 * audit_log rows stay null. Canonical home is `@revealui/db` (schema-adjacent,
 * not crypto/DB-access) so `DrizzleAuditStore` can reject it as a tenant value
 * at the single write door without importing from `apps/server`.
 * `apps/server/src/jobs/audit-anchor-sweep.ts` re-exports this for compatibility.
 */
export const SYSTEM_ANCHOR_SCOPE = '__system__' as const;

/** Burned (permanently absent) seqs + a foreign-scope-row count an anchor traversed (GAP-447). */
export interface AuditAnchorHoles {
  burned: number[];
  foreign: number;
}

export const auditAnchors = pgTable(
  'audit_anchors',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Matches audit_log.tenant for real tenants. Null-tenant (system) rows
     * anchor under the reserved '__system__' sentinel instead, since this
     * column is NOT NULL and audit_log.tenant itself stays null on those
     * rows (GAP-427 ruling 2026-07-27; see SYSTEM_ANCHOR_SCOPE in
     * apps/server/src/jobs/audit-anchor-sweep.ts).
     */
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

    /**
     * GAP-447: burned seqs + foreign-scope-row count traversed within
     * [seqFrom, seqTo] while building this anchor. NULL means no holes were
     * traversed (the pre-GAP-447 shape, and still the common case) — every
     * anchor written before this column existed reads back as NULL here,
     * which round-trips to the same signed payload (see
     * `auditAnchorSignableBytes` in `@revealui/security`: an `undefined`
     * `holes` field is omitted from the canonical bytes entirely).
     */
    holes: jsonb('holes').$type<AuditAnchorHoles>(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** Set when delivery to the customer succeeds (API download counts). */
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),

    /** e.g. api_download | email | webhook — null until delivered. */
    deliveryChannel: text('delivery_channel'),
  },
  (table) => [
    uniqueIndex('audit_anchors_tenant_seq_range_uidx').on(table.tenant, table.seqFrom, table.seqTo),
    index('audit_anchors_tenant_created_idx').on(table.tenant, table.createdAt),
    check('audit_anchors_seq_range_check', sql`${table.seqTo} >= ${table.seqFrom}`),
    check('audit_anchors_leaf_count_check', sql`${table.leafCount} > 0`),
  ],
);

export type AuditAnchorRow = typeof auditAnchors.$inferSelect;
export type AuditAnchorInsert = typeof auditAnchors.$inferInsert;
