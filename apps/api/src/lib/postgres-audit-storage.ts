/**
 * PostgreSQL-backed AuditStorage implementation.
 *
 * Stores security audit events in the existing `audit_log` table,
 * replacing the default InMemoryAuditStorage so events persist
 * across process restarts.
 *
 * Column mapping:
 *   AuditEvent.id        → audit_log.id
 *   AuditEvent.timestamp → audit_log.timestamp
 *   AuditEvent.type      → audit_log.eventType
 *   AuditEvent.severity  → audit_log.severity
 *   AuditEvent.actor.id  → audit_log.agentId
 *   (everything else)    → audit_log.payload  (JSONB)
 */

import type { AuditEvent, AuditQuery, AuditStorage } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import { auditLog } from '@revealui/db/schema';
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';

export class PostgresAuditStorage implements AuditStorage {
  async write(event: AuditEvent): Promise<void> {
    const db = getClient();
    await db
      .insert(auditLog)
      .values({
        id: event.id,
        timestamp: new Date(event.timestamp),
        eventType: event.type,
        severity: event.severity,
        agentId: event.actor.id,
        taskId: null,
        sessionId: null,
        payload: event as unknown as Record<string, unknown>,
        policyViolations: [],
      })
      .onConflictDoNothing();
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    const db = getClient();
    const conditions = [];

    if (query.types && query.types.length > 0) {
      conditions.push(sql`${auditLog.eventType} = ANY(${query.types})`);
    }

    if (query.actorId) {
      conditions.push(eq(auditLog.agentId, query.actorId));
    }

    if (query.startDate) {
      conditions.push(gte(auditLog.timestamp, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(auditLog.timestamp, query.endDate));
    }

    if (query.severity && query.severity.length > 0) {
      conditions.push(sql`${auditLog.severity} = ANY(${query.severity})`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const rows = await db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.timestamp))
      .limit(limit)
      .offset(offset);

    return rows
      .map((row) => {
        // Full AuditEvent stored in payload JSONB — reconstruct it
        const stored = row.payload as Record<string, unknown> | null;
        if (stored && typeof stored === 'object' && 'type' in stored) {
          return stored as unknown as AuditEvent;
        }
        // Fallback: reconstruct from columns (events written before this adapter)
        return {
          id: row.id,
          timestamp: row.timestamp.toISOString(),
          type: row.eventType,
          severity: row.severity,
          actor: { id: row.agentId, type: 'system' as const },
          action: row.eventType,
          result: 'success' as const,
          metadata: stored ?? undefined,
        } as AuditEvent;
      })
      .filter((event): event is AuditEvent => {
        // Post-filter for fields not available as indexed columns
        if (query.resourceType && event.resource?.type !== query.resourceType) return false;
        if (query.resourceId && event.resource?.id !== query.resourceId) return false;
        if (query.result && query.result.length > 0 && !query.result.includes(event.result)) {
          return false;
        }
        return true;
      });
  }

  async count(query: AuditQuery): Promise<number> {
    const db = getClient();
    const conditions = [];

    if (query.types && query.types.length > 0) {
      conditions.push(sql`${auditLog.eventType} = ANY(${query.types})`);
    }

    if (query.actorId) {
      conditions.push(eq(auditLog.agentId, query.actorId));
    }

    if (query.startDate) {
      conditions.push(gte(auditLog.timestamp, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(auditLog.timestamp, query.endDate));
    }

    if (query.severity && query.severity.length > 0) {
      conditions.push(sql`${auditLog.severity} = ANY(${query.severity})`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await db.select({ total: count() }).from(auditLog).where(where);

    return result?.total ?? 0;
  }
}
