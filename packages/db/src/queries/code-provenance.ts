/**
 * Code Provenance database queries
 */

import { and, desc, eq, like, sql } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { codeProvenance, codeReviews } from '../schema/code-provenance.js';

// =============================================================================
// Provenance Queries
// =============================================================================

export async function getProvenanceByFile(db: Database, filePath: string) {
  return db
    .select()
    .from(codeProvenance)
    .where(eq(codeProvenance.filePath, filePath))
    .orderBy(codeProvenance.lineStart);
}

export async function getProvenanceById(db: Database, id: string) {
  const result = await db.select().from(codeProvenance).where(eq(codeProvenance.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getProvenanceByCommit(db: Database, gitCommitHash: string) {
  return db
    .select()
    .from(codeProvenance)
    .where(eq(codeProvenance.gitCommitHash, gitCommitHash))
    .orderBy(codeProvenance.filePath);
}

export async function getUnreviewedProvenance(
  db: Database,
  filters?: {
    authorType?: string;
    filePathPrefix?: string;
  },
) {
  const conditions = [eq(codeProvenance.reviewStatus, 'unreviewed')];

  if (filters?.authorType) {
    conditions.push(eq(codeProvenance.authorType, filters.authorType));
  }
  if (filters?.filePathPrefix) {
    conditions.push(like(codeProvenance.filePath, `${filters.filePathPrefix}%`));
  }

  return db
    .select()
    .from(codeProvenance)
    .where(and(...conditions))
    .orderBy(desc(codeProvenance.createdAt));
}

export async function getAllProvenance(
  db: Database,
  filters?: {
    authorType?: string;
    reviewStatus?: string;
    filePathPrefix?: string;
    limit?: number;
    offset?: number;
  },
) {
  const conditions = [];

  if (filters?.authorType) {
    conditions.push(eq(codeProvenance.authorType, filters.authorType));
  }
  if (filters?.reviewStatus) {
    conditions.push(eq(codeProvenance.reviewStatus, filters.reviewStatus));
  }
  if (filters?.filePathPrefix) {
    conditions.push(like(codeProvenance.filePath, `${filters.filePathPrefix}%`));
  }

  const cap = Math.min(filters?.limit ?? 100, 500);
  const off = filters?.offset ?? 0;

  const query = db.select().from(codeProvenance);

  if (conditions.length > 0) {
    return query
      .where(and(...conditions))
      .orderBy(desc(codeProvenance.createdAt))
      .limit(cap)
      .offset(off);
  }

  return query.orderBy(desc(codeProvenance.createdAt)).limit(cap).offset(off);
}

export async function createProvenance(
  db: Database,
  data: {
    id: string;
    filePath: string;
    authorType: string;
    functionName?: string;
    lineStart?: number;
    lineEnd?: number;
    aiModel?: string;
    aiSessionId?: string;
    gitCommitHash?: string;
    gitAuthor?: string;
    confidence?: number;
    linesOfCode?: number;
    metadata?: unknown;
  },
) {
  const result = await db
    .insert(codeProvenance)
    .values({
      ...data,
      metadata: data.metadata ?? {},
    })
    .returning();

  return result[0];
}

export async function updateProvenance(
  db: Database,
  id: string,
  data: Partial<{
    filePath: string;
    functionName: string | null;
    lineStart: number | null;
    lineEnd: number | null;
    authorType: string;
    aiModel: string | null;
    aiSessionId: string | null;
    gitCommitHash: string | null;
    gitAuthor: string | null;
    confidence: number;
    reviewStatus: string;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    linesOfCode: number;
    metadata: unknown;
  }>,
) {
  const result = await db
    .update(codeProvenance)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(codeProvenance.id, id))
    .returning();

  return result[0] ?? null;
}

export async function updateReviewStatus(
  db: Database,
  id: string,
  reviewStatus: string,
  reviewedBy?: string,
) {
  const result = await db
    .update(codeProvenance)
    .set({
      reviewStatus,
      reviewedBy: reviewedBy ?? null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(codeProvenance.id, id))
    .returning();

  return result[0] ?? null;
}

export async function deleteProvenance(db: Database, id: string) {
  await db.delete(codeProvenance).where(eq(codeProvenance.id, id));
}

export async function getProvenanceStats(db: Database) {
  const byAuthorType = await db
    .select({
      authorType: codeProvenance.authorType,
      count: sql<number>`COUNT(*)`,
      totalLines: sql<number>`COALESCE(SUM(${codeProvenance.linesOfCode}), 0)`,
    })
    .from(codeProvenance)
    .groupBy(codeProvenance.authorType);

  const byReviewStatus = await db
    .select({
      reviewStatus: codeProvenance.reviewStatus,
      count: sql<number>`COUNT(*)`,
    })
    .from(codeProvenance)
    .groupBy(codeProvenance.reviewStatus);

  return { byAuthorType, byReviewStatus };
}

// =============================================================================
// Code Review Queries
// =============================================================================

export async function getReviewsForProvenance(db: Database, provenanceId: string) {
  return db
    .select()
    .from(codeReviews)
    .where(eq(codeReviews.provenanceId, provenanceId))
    .orderBy(desc(codeReviews.createdAt));
}

export async function createReview(
  db: Database,
  data: {
    id: string;
    provenanceId: string;
    reviewerId?: string;
    reviewType: string;
    status: string;
    comment?: string;
    metadata?: unknown;
  },
) {
  const result = await db
    .insert(codeReviews)
    .values({
      ...data,
      metadata: data.metadata ?? {},
    })
    .returning();

  return result[0];
}
