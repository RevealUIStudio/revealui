/**
 * Site database queries
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { sites } from '../schema/sites.js';

/** Condition that excludes soft-deleted sites */
const notDeleted = isNull(sites.deletedAt);

export async function getAllSites(
  db: Database,
  options: {
    ownerId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  } = {},
) {
  const { ownerId, status, limit = 20, offset = 0, includeDeleted = false } = options;
  const conditions = [
    ...(includeDeleted ? [] : [notDeleted]),
    ...(ownerId ? [eq(sites.ownerId, ownerId)] : []),
    ...(status ? [eq(sites.status, status)] : []),
  ];
  return db
    .select()
    .from(sites)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sites.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getSiteById(db: Database, id: string) {
  const result = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, id), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

export async function getSiteBySlug(db: Database, slug: string) {
  const result = await db
    .select()
    .from(sites)
    .where(and(eq(sites.slug, slug), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

export async function createSite(db: Database, data: typeof sites.$inferInsert) {
  const result = await db.insert(sites).values(data).returning();
  return result[0] ?? null;
}

export async function updateSite(
  db: Database,
  id: string,
  data: Partial<typeof sites.$inferInsert>,
) {
  const result = await db
    .update(sites)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(sites.id, id), notDeleted))
    .returning();
  return result[0] ?? null;
}

/** Soft-delete: sets deletedAt timestamp instead of removing the row */
export async function deleteSite(db: Database, id: string) {
  await db
    .update(sites)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sites.id, id), notDeleted));
}

/** Restore a soft-deleted site */
export async function restoreSite(db: Database, id: string) {
  const result = await db
    .update(sites)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(sites.id, id))
    .returning();
  return result[0] ?? null;
}

/** Permanently remove a soft-deleted site (admin cleanup) */
export async function purgeSite(db: Database, id: string) {
  await db.delete(sites).where(eq(sites.id, id));
}

export async function incrementPageCount(db: Database, siteId: string): Promise<void> {
  await db
    .update(sites)
    .set({ pageCount: sql`COALESCE(${sites.pageCount}, 0) + 1` })
    .where(eq(sites.id, siteId));
}

export async function decrementPageCount(db: Database, siteId: string): Promise<void> {
  await db
    .update(sites)
    .set({ pageCount: sql`GREATEST(COALESCE(${sites.pageCount}, 0) - 1, 0)` })
    .where(eq(sites.id, siteId));
}
