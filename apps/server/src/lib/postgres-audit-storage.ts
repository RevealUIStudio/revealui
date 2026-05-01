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

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuditEvent, AuditQuery, AuditStorage } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import { auditLog } from '@revealui/db/schema';
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';

// ─── Hash-chain signing ──────────────────────────────────────────────────────

/** Cache the last signature for hash-chaining (per-instance, resets on restart). */
let lastSignature: string | null = null;

function getAuditSecret(): string {
  return process.env.REVEALUI_AUDIT_HMAC_SECRET ?? process.env.REVEALUI_SECRET ?? '';
}

/**
 * Compute an HMAC-SHA256 signature for an audit entry, chained to the previous entry.
 * The chain means tampering with any entry invalidates all subsequent signatures.
 */
function computeSignature(
  entry: {
    timestamp: string;
    eventType: string;
    severity: string;
    agentId: string;
    payload: unknown;
  },
  previousSig: string | null,
): string {
  const secret = getAuditSecret();
  if (!secret) return '';
  const canonical = JSON.stringify({
    timestamp: entry.timestamp,
    eventType: entry.eventType,
    severity: entry.severity,
    agentId: entry.agentId,
    payload: entry.payload,
    previousSignature: previousSig ?? '',
  });
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Verify an audit entry's signature against its fields and the previous signature.
 */
export function verifyAuditSignature(
  entry: {
    timestamp: string;
    eventType: string;
    severity: string;
    agentId: string;
    payload: unknown;
  },
  signature: string,
  previousSig: string | null,
): boolean {
  const expected = computeSignature(entry, previousSig);
  if (!expected || expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export class PostgresAuditStorage implements AuditStorage {
  async write(event: AuditEvent): Promise<void> {
    const db = getClient();
    const ts = event.timestamp;
    const entry = {
      timestamp: ts,
      eventType: event.type,
      severity: event.severity,
      agentId: event.actor.id,
      payload: event as unknown,
    };
    const previousSig = lastSignature;
    const signature = computeSignature(entry, previousSig);
    if (signature) {
      lastSignature = signature;
    }

    await db
      .insert(auditLog)
      .values({
        id: event.id,
        timestamp: new Date(ts),
        eventType: event.type,
        severity: event.severity,
        agentId: event.actor.id,
        taskId: null,
        sessionId: null,
        payload: event as unknown as Record<string, unknown>,
        policyViolations: [],
        signature: signature || null,
        previousSignature: previousSig,
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
        // Full AuditEvent stored in payload JSONB  -  reconstruct it
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
