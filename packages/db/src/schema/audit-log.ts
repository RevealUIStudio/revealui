/**
 * Audit Log Table - Persistent storage for the AI audit trail.
 *
 * Append-only table for all agent activity. Matches the AuditEntry
 * type from @revealui/ai/audit. No UPDATE or DELETE operations should
 * ever be performed on this table.
 */

import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
  },
  (table) => [
    index('audit_log_event_type_idx').on(table.eventType),
    index('audit_log_agent_id_idx').on(table.agentId),
    index('audit_log_timestamp_idx').on(table.timestamp),
    index('audit_log_severity_idx').on(table.severity),
    check('audit_log_severity_check', sql`severity IN ('info', 'warn', 'critical')`),
  ],
);

/** Row type for select queries */
export type AuditLogRow = typeof auditLog.$inferSelect;

/** Insert type for new records */
export type AuditLogInsert = typeof auditLog.$inferInsert;
