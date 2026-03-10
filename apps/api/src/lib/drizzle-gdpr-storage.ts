/**
 * Database-backed GDPRStorage implementation using Drizzle ORM.
 *
 * Replaces InMemoryGDPRStorage for production use. Persists consent records
 * and deletion requests to PostgreSQL via the gdpr_consents and
 * gdpr_deletion_requests tables.
 */

import type {
  ConsentRecord,
  ConsentType,
  DataDeletionRequest,
  GDPRStorage,
} from '@revealui/core/security'
import { getClient } from '@revealui/db'
import { gdprConsents, gdprDeletionRequests } from '@revealui/db/schema'
import { and, eq } from 'drizzle-orm'

export class DrizzleGDPRStorage implements GDPRStorage {
  private get db() {
    return getClient()
  }

  // ── Consent Records ──────────────────────────────────────────────

  async setConsent(userId: string, type: ConsentType, record: ConsentRecord): Promise<void> {
    await this.db
      .insert(gdprConsents)
      .values({
        id: record.id,
        userId,
        type,
        granted: record.granted,
        timestamp: new Date(record.timestamp),
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        source: record.source,
        version: record.version,
        metadata: record.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [gdprConsents.userId, gdprConsents.type],
        set: {
          id: record.id,
          granted: record.granted,
          timestamp: new Date(record.timestamp),
          expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
          source: record.source,
          version: record.version,
          metadata: record.metadata ?? null,
        },
      })
  }

  async getConsent(userId: string, type: ConsentType): Promise<ConsentRecord | undefined> {
    const rows = await this.db
      .select()
      .from(gdprConsents)
      .where(and(eq(gdprConsents.userId, userId), eq(gdprConsents.type, type)))
      .limit(1)

    if (rows.length === 0) return undefined
    return this.toConsentRecord(rows[0])
  }

  async getConsentsByUser(userId: string): Promise<ConsentRecord[]> {
    const rows = await this.db.select().from(gdprConsents).where(eq(gdprConsents.userId, userId))

    return rows.map((row) => this.toConsentRecord(row))
  }

  async getAllConsents(): Promise<ConsentRecord[]> {
    const rows = await this.db.select().from(gdprConsents)
    return rows.map((row) => this.toConsentRecord(row))
  }

  // ── Deletion Requests ────────────────────────────────────────────

  async setDeletionRequest(request: DataDeletionRequest): Promise<void> {
    await this.db
      .insert(gdprDeletionRequests)
      .values({
        id: request.id,
        userId: request.userId,
        requestedAt: new Date(request.requestedAt),
        processedAt: request.processedAt ? new Date(request.processedAt) : null,
        status: request.status,
        dataCategories: request.dataCategories,
        reason: request.reason ?? null,
        retainedData: request.retainedData ?? null,
        deletedData: request.deletedData ?? null,
      })
      .onConflictDoUpdate({
        target: gdprDeletionRequests.id,
        set: {
          processedAt: request.processedAt ? new Date(request.processedAt) : null,
          status: request.status,
          retainedData: request.retainedData ?? null,
          deletedData: request.deletedData ?? null,
        },
      })
  }

  async getDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined> {
    const rows = await this.db
      .select()
      .from(gdprDeletionRequests)
      .where(eq(gdprDeletionRequests.id, requestId))
      .limit(1)

    if (rows.length === 0) return undefined
    return this.toDeletionRequest(rows[0])
  }

  async getDeletionRequestsByUser(userId: string): Promise<DataDeletionRequest[]> {
    const rows = await this.db
      .select()
      .from(gdprDeletionRequests)
      .where(eq(gdprDeletionRequests.userId, userId))

    return rows.map((row) => this.toDeletionRequest(row))
  }

  // ── Mappers ──────────────────────────────────────────────────────

  private toConsentRecord(row: typeof gdprConsents.$inferSelect): ConsentRecord {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type as ConsentType,
      granted: row.granted,
      timestamp: row.timestamp.toISOString(),
      expiresAt: row.expiresAt?.toISOString(),
      source: row.source as ConsentRecord['source'],
      version: row.version,
      metadata: row.metadata ?? undefined,
    }
  }

  private toDeletionRequest(row: typeof gdprDeletionRequests.$inferSelect): DataDeletionRequest {
    return {
      id: row.id,
      userId: row.userId,
      requestedAt: row.requestedAt.toISOString(),
      processedAt: row.processedAt?.toISOString(),
      status: row.status as DataDeletionRequest['status'],
      dataCategories: row.dataCategories as DataDeletionRequest['dataCategories'],
      reason: row.reason ?? undefined,
      retainedData: row.retainedData ?? undefined,
      deletedData: row.deletedData ?? undefined,
    }
  }
}
