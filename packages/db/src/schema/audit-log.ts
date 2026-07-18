/**
 * Audit Log Table - Persistent storage for the AI audit trail.
 *
 * Append-only table for all agent activity. Matches the AuditEntry
 * type from @revealui/ai/audit.
 *
 * GAP-355 Stage 2 (ONE DOOR): append-only is now ENFORCED at the DB layer, not
 * just documented. Migration 0026 adds a `BEFORE UPDATE OR DELETE` trigger that
 * RAISEs, so no UPDATE/DELETE succeeds — even for the table owner (a plain
 * REVOKE is toothless against the owner role the app connects as, so the trigger
 * is the real enforcement; the REVOKE in 0026 is defense-in-depth for any
 * non-owner role). `seq` is a monotonic bigserial: a deleted row would leave a
 * detectable gap (it can't be deleted, but the sequence is the primitive the
 * anchoring in Stage 4 checks). `tenant` scopes rows for per-tenant Merkle
 * anchoring. Writes still go through the single door, DrizzleAuditStore.append.
 */

import { sql } from 'drizzle-orm';
import { bigserial, check, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// =============================================================================
// Audit Log Table
// =============================================================================

export const auditLog = pgTable(
  'audit_log',
  {
    /** Unique entry ID (UUID) */
    id: text('id').primaryKey(),

    /** When the event occurred */
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),

    /** Event type (e.g., agent:task:started, agent:tool:called) */
    eventType: text('event_type').notNull(),

    /** Severity: info, warn, critical */
    severity: text('severity').notNull().default('info'),

    /** Agent that triggered the event */
    agentId: text('agent_id').notNull(),

    /** Task ID if applicable */
    taskId: text('task_id'),

    /** Session or orchestration run ID */
    sessionId: text('session_id'),

    /** Event-specific data (JSON) */
    payload: jsonb('payload').default('{}').notNull(),

    /** Policy violation IDs triggered by this event */
    policyViolations: jsonb('policy_violations').$type<string[]>().default([]).notNull(),

    /** HMAC-SHA256 signature for tamper detection (nullable for backwards compat) */
    signature: text('signature'),

    /** Signature of the previous entry in the hash chain (for tamper-evident sequencing) */
    previousSignature: text('previous_signature'),

    /**
     * Monotonic append order (GAP-355 Stage 2). DB-assigned via a sequence — the
     * store never writes it. A deletion would leave a gap, which is what the
     * Stage 4 anchoring checks; combined with the append-only trigger, order is
     * both fixed and gap-evident.
     */
    seq: bigserial('seq', { mode: 'number' }).notNull(),

    /** Tenant/account scope for per-tenant anchoring (GAP-355 Stage 2). Nullable; no backfill. */
    tenant: text('tenant'),
  },
  (table) => [
    index('audit_log_event_type_idx').on(table.eventType),
    index('audit_log_agent_id_idx').on(table.agentId),
    index('audit_log_timestamp_idx').on(table.timestamp),
    index('audit_log_severity_idx').on(table.severity),
    index('audit_log_seq_idx').on(table.seq),
    index('audit_log_tenant_idx').on(table.tenant),
    check('audit_log_severity_check', sql`severity IN ('info', 'warn', 'critical')`),
  ],
);

/** Row type for select queries */
export type AuditLogRow = typeof auditLog.$inferSelect;

/** Insert type for new records */
export type AuditLogInsert = typeof auditLog.$inferInsert;
