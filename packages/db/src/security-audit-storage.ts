/**
 * DrizzleSecurityAuditStorage — DB-backed implementation of @revealui/core's AuditStorage.
 *
 * Adapts the core security audit interface to the shared `audit_log` table.
 * Maps AuditEvent.actor.id → agentId, and stores the full event in payload.
 */

import { and, count, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { auditLog } from './schema/audit-log.js'

interface AuditEvent {
  id: string
  timestamp: string
  type: string
  severity: string
  actor: {
    id: string
    type: 'user' | 'system' | 'api'
    ip?: string
    userAgent?: string
  }
  resource?: {
    type: string
    id: string
    name?: string
  }
  action: string
  result: 'success' | 'failure' | 'partial'
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }
  metadata?: Record<string, unknown>
}

interface AuditQuery {
  types?: string[]
  actorId?: string
  resourceType?: string
  resourceId?: string
  startDate?: Date
  endDate?: Date
  severity?: string[]
  result?: string[]
  limit?: number
  offset?: number
}

type DrizzleDb = NeonHttpDatabase | NodePgDatabase

export class DrizzleSecurityAuditStorage {
  constructor(private db: DrizzleDb) {}

  async write(event: AuditEvent): Promise<void> {
    await (this.db as NeonHttpDatabase).insert(auditLog).values({
      id: event.id,
      timestamp: new Date(event.timestamp),
      eventType: event.type,
      severity: event.severity,
      agentId: event.actor.id,
      taskId: event.resource?.id ?? null,
      sessionId: null,
      payload: {
        actor: event.actor,
        resource: event.resource,
        action: event.action,
        result: event.result,
        changes: event.changes,
        metadata: event.metadata,
      },
      policyViolations: [],
    })
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    const conditions = []

    if (query.types?.length) {
      conditions.push(inArray(auditLog.eventType, query.types))
    }
    if (query.actorId) {
      conditions.push(eq(auditLog.agentId, query.actorId))
    }
    if (query.startDate) {
      conditions.push(gte(auditLog.timestamp, query.startDate))
    }
    if (query.endDate) {
      conditions.push(lte(auditLog.timestamp, query.endDate))
    }
    if (query.severity?.length) {
      conditions.push(inArray(auditLog.severity, query.severity))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await (this.db as NeonHttpDatabase)
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.timestamp))
      .limit(query.limit ?? 100)
      .offset(query.offset ?? 0)

    return rows.map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>
      return {
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        type: row.eventType,
        severity: row.severity,
        actor: (payload.actor as AuditEvent['actor']) ?? {
          id: row.agentId,
          type: 'system' as const,
        },
        resource: payload.resource as AuditEvent['resource'],
        action: (payload.action as string) ?? row.eventType,
        result: (payload.result as AuditEvent['result']) ?? 'success',
        changes: payload.changes as AuditEvent['changes'],
        metadata: payload.metadata as Record<string, unknown>,
      }
    })
  }

  async count(query: AuditQuery): Promise<number> {
    const conditions = []

    if (query.types?.length) {
      conditions.push(inArray(auditLog.eventType, query.types))
    }
    if (query.actorId) {
      conditions.push(eq(auditLog.agentId, query.actorId))
    }
    if (query.startDate) {
      conditions.push(gte(auditLog.timestamp, query.startDate))
    }
    if (query.endDate) {
      conditions.push(lte(auditLog.timestamp, query.endDate))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [result] = await (this.db as NeonHttpDatabase)
      .select({ total: count() })
      .from(auditLog)
      .where(where)

    return result?.total ?? 0
  }
}
