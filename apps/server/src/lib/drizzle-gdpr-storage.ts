/**
 * Database-backed GDPRStorage implementation using Drizzle ORM.
 *
 * Replaces InMemoryGDPRStorage for production use. Persists consent records
 * and deletion requests to PostgreSQL via the gdpr_consents and
 * gdpr_deletion_requests tables.
 */

import type {
  BreachStorage,
  ConsentRecord,
  ConsentType,
  DataBreach,
  DataDeletionRequest,
  GDPRStorage,
} from '@revealui/core/security';
import { parseDataCategories, parseDeletionResult } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import { gdprBreaches, gdprConsents, gdprDeletionRequests } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';

function parseDeletionStatus(value: string): DataDeletionRequest['status'] {
  switch (value) {
    case 'pending':
    case 'processing':
    case 'completed':
    case 'failed':
      return value;
    default:
      throw new Error('Invalid persisted deletion request status');
  }
}

export class DrizzleGDPRStorage implements GDPRStorage {
  private get db() {
    return getClient();
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
      });
  }

  async getConsent(userId: string, type: ConsentType): Promise<ConsentRecord | undefined> {
    const rows = await this.db
      .select()
      .from(gdprConsents)
      .where(and(eq(gdprConsents.userId, userId), eq(gdprConsents.type, type)))
      .limit(1);

    if (rows.length === 0) return undefined;
    return this.toConsentRecord(rows[0]);
  }

  async getConsentsByUser(userId: string): Promise<ConsentRecord[]> {
    const rows = await this.db.select().from(gdprConsents).where(eq(gdprConsents.userId, userId));

    return rows.map((row) => this.toConsentRecord(row));
  }

  async getAllConsents(): Promise<ConsentRecord[]> {
    const rows = await this.db.select().from(gdprConsents);
    return rows.map((row) => this.toConsentRecord(row));
  }

  // ── Deletion Requests ────────────────────────────────────────────

  async setDeletionRequest(request: DataDeletionRequest): Promise<void> {
    if (
      request.status !== 'pending' ||
      request.processedAt ||
      request.deletedData ||
      request.retainedData
    ) {
      throw new Error('Deletion requests must be created pending without results');
    }
    await this.db.insert(gdprDeletionRequests).values({
      id: request.id,
      userId: request.userId,
      requestedAt: new Date(request.requestedAt),
      processedAt: request.processedAt ? new Date(request.processedAt) : null,
      status: request.status,
      dataCategories: parseDataCategories(request.dataCategories),
      reason: request.reason ?? null,
      retainedData: request.retainedData ?? null,
      deletedData: request.deletedData ?? null,
    });
  }

  async claimDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined> {
    const request = await this.getDeletionRequest(requestId);
    if (request?.status !== 'pending') return undefined;
    const rows = await this.db
      .update(gdprDeletionRequests)
      .set({ status: 'processing' })
      .where(
        and(
          eq(gdprDeletionRequests.id, requestId),
          eq(gdprDeletionRequests.status, 'pending'),
          eq(gdprDeletionRequests.dataCategories, request.dataCategories),
          eq(gdprDeletionRequests.userId, request.userId),
        ),
      )
      .returning();
    const row = rows[0];
    return row ? this.toDeletionRequest(row) : undefined;
  }

  async finishDeletionRequest(
    requestId: string,
    result: Parameters<GDPRStorage['finishDeletionRequest']>[1],
  ): Promise<boolean> {
    const validated = parseDeletionResult(result);
    const processedAt = new Date(validated.processedAt);
    const rows = await this.db
      .update(gdprDeletionRequests)
      .set({
        status: validated.status,
        processedAt,
        deletedData: validated.deletedData ?? null,
        retainedData: validated.retainedData ?? null,
      })
      .where(
        and(eq(gdprDeletionRequests.id, requestId), eq(gdprDeletionRequests.status, 'processing')),
      )
      .returning();
    return rows.length === 1;
  }

  async getDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined> {
    const rows = await this.db
      .select()
      .from(gdprDeletionRequests)
      .where(eq(gdprDeletionRequests.id, requestId))
      .limit(1);

    if (rows.length === 0) return undefined;
    return this.toDeletionRequest(rows[0]);
  }

  async getDeletionRequestsByUser(userId: string): Promise<DataDeletionRequest[]> {
    const rows = await this.db
      .select()
      .from(gdprDeletionRequests)
      .where(eq(gdprDeletionRequests.userId, userId));

    return rows.map((row) => this.toDeletionRequest(row));
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
    };
  }

  private toDeletionRequest(row: typeof gdprDeletionRequests.$inferSelect): DataDeletionRequest {
    return {
      id: row.id,
      userId: row.userId,
      requestedAt: row.requestedAt.toISOString(),
      processedAt: row.processedAt?.toISOString(),
      status: parseDeletionStatus(row.status),
      dataCategories: parseDataCategories(row.dataCategories),
      reason: row.reason ?? undefined,
      retainedData: row.retainedData ?? undefined,
      deletedData: row.deletedData ?? undefined,
    };
  }
}

/**
 * Database-backed BreachStorage implementation using Drizzle ORM.
 *
 * Persists data breach records to PostgreSQL via the gdpr_breaches table.
 * Required for GDPR compliance  -  breach records must survive restarts.
 */
export class DrizzleBreachStorage implements BreachStorage {
  private get db() {
    return getClient();
  }

  async setBreach(breach: DataBreach): Promise<void> {
    await this.db
      .insert(gdprBreaches)
      .values({
        id: breach.id,
        detectedAt: new Date(breach.detectedAt),
        reportedAt: breach.reportedAt ? new Date(breach.reportedAt) : null,
        type: breach.type,
        severity: breach.severity,
        affectedUsers: breach.affectedUsers,
        dataCategories: breach.dataCategories,
        description: breach.description,
        mitigation: breach.mitigation ?? null,
        status: breach.status,
      })
      .onConflictDoUpdate({
        target: gdprBreaches.id,
        set: {
          reportedAt: breach.reportedAt ? new Date(breach.reportedAt) : null,
          status: breach.status,
          mitigation: breach.mitigation ?? null,
        },
      });
  }

  async getBreach(id: string): Promise<DataBreach | undefined> {
    const rows = await this.db.select().from(gdprBreaches).where(eq(gdprBreaches.id, id)).limit(1);

    if (rows.length === 0) return undefined;
    return this.toBreach(rows[0]);
  }

  async getAllBreaches(): Promise<DataBreach[]> {
    const rows = await this.db.select().from(gdprBreaches);
    return rows.map((row) => this.toBreach(row));
  }

  async updateBreach(id: string, updates: Partial<DataBreach>): Promise<void> {
    const setValues: Record<string, unknown> = {};
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.mitigation !== undefined) setValues.mitigation = updates.mitigation;
    if (updates.reportedAt !== undefined) {
      setValues.reportedAt = new Date(updates.reportedAt);
    }

    if (Object.keys(setValues).length > 0) {
      await this.db.update(gdprBreaches).set(setValues).where(eq(gdprBreaches.id, id));
    }
  }

  private toBreach(row: typeof gdprBreaches.$inferSelect): DataBreach {
    return {
      id: row.id,
      detectedAt: row.detectedAt.toISOString(),
      reportedAt: row.reportedAt?.toISOString(),
      type: row.type as DataBreach['type'],
      severity: row.severity as DataBreach['severity'],
      affectedUsers: row.affectedUsers,
      dataCategories: row.dataCategories as DataBreach['dataCategories'],
      description: row.description,
      mitigation: row.mitigation ?? undefined,
      status: row.status as DataBreach['status'],
    };
  }
}
