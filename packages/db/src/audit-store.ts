/**
 * Drizzle Audit Store
 *
 * Persistent implementation of the AuditStore interface from @revealui/ai.
 * Stores audit entries in the audit_log PostgreSQL table via Drizzle ORM.
 * Append-only  -  no update or delete operations.
 *
 * Types are defined locally to avoid a circular dependency on @revealui/ai.
 * They mirror AuditEntry and AuditFilter from @revealui/ai/audit/types.
 */

import { and, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { Database } from './client/index.js';
import { auditLog } from './schema/audit-log.js';

// ─── Local Type Mirrors ─────────────────────────────────────────────────────
// These mirror @revealui/ai AuditEntry and AuditFilter to avoid circular deps.

/** Audit entry stored in the database */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  severity: string;
  agentId: string;
  taskId?: string;
  sessionId?: string;
  payload: Record<string, unknown>;
  policyViolations: string[];
}

/** Filters for querying audit entries */
export interface AuditFilter {
  agentId?: string;
  taskId?: string;
  sessionId?: string;
  eventTypes?: string[];
  severity?: string[];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

// ─── Drizzle Audit Store ────────────────────────────────────────────────────

/**
 * PostgreSQL-backed audit store using Drizzle ORM.
 * Implements the AuditStore interface for production use.
 *
 * All writes are append-only. The table has no UPDATE or DELETE operations.
 */
export class DrizzleAuditStore {
  constructor(private readonly db: Database) {}

  /** Append a single entry to the audit log */
  async append(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      id: entry.id,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      severity: entry.severity,
      agentId: entry.agentId,
      taskId: entry.taskId ?? null,
      sessionId: entry.sessionId ?? null,
      payload: entry.payload,
      policyViolations: entry.policyViolations,
    });
  }

  /** Append multiple entries atomically in a single INSERT */
  async appendBatch(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;

    await this.db.insert(auditLog).values(
      entries.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        severity: entry.severity,
        agentId: entry.agentId,
        taskId: entry.taskId ?? null,
        sessionId: entry.sessionId ?? null,
        payload: entry.payload,
        policyViolations: entry.policyViolations,
      })),
    );
  }

  /** Query entries with filters (human-side only) */
  async query(filter: AuditFilter): Promise<AuditEntry[]> {
    const conditions = [];

    if (filter.agentId) {
      conditions.push(eq(auditLog.agentId, filter.agentId));
    }
    if (filter.taskId) {
      conditions.push(eq(auditLog.taskId, filter.taskId));
    }
    if (filter.sessionId) {
      conditions.push(eq(auditLog.sessionId, filter.sessionId));
    }
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      conditions.push(inArray(auditLog.eventType, filter.eventTypes));
    }
    if (filter.severity && filter.severity.length > 0) {
      conditions.push(inArray(auditLog.severity, filter.severity));
    }
    if (filter.startTime) {
      conditions.push(gte(auditLog.timestamp, filter.startTime));
    }
    if (filter.endTime) {
      conditions.push(lte(auditLog.timestamp, filter.endTime));
    }

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.timestamp))
      .limit(filter.limit ?? 1000)
      .offset(filter.offset ?? 0);

    return rows.map(rowToEntry);
  }

  /** Get total entry count (optionally filtered by agent) */
  async count(agentId?: string): Promise<number> {
    const condition = agentId ? eq(auditLog.agentId, agentId) : undefined;

    const result = await this.db.select({ value: count() }).from(auditLog).where(condition);

    return result[0]?.value ?? 0;
  }

  /** Get entries since a given timestamp */
  async since(timestamp: Date, limit = 1000): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(gte(auditLog.timestamp, timestamp))
      .orderBy(desc(auditLog.timestamp))
      .limit(limit);

    return rows.map(rowToEntry);
  }
}

// ─── Row Mapping ────────────────────────────────────────────────────────────

/** Convert a database row to an AuditEntry */
function rowToEntry(row: typeof auditLog.$inferSelect): AuditEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    eventType: row.eventType,
    severity: row.severity,
    agentId: row.agentId,
    taskId: row.taskId ?? undefined,
    sessionId: row.sessionId ?? undefined,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    policyViolations: row.policyViolations ?? [],
  };
}
