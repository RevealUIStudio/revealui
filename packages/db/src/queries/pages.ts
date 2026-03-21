/**
 * Page database queries
 */

import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { pages } from '../schema/pages.js';

export async function getPagesBySite(
  db: DatabaseClient,
  siteId: string,
  options: { status?: string } = {},
) {
  const { status } = options;
  const conditions = [
    eq(pages.siteId, siteId),
    isNull(pages.deletedAt),
    ...(status ? [eq(pages.status, status)] : []),
  ];
  return db
    .select()
    .from(pages)
    .where(and(...conditions))
    .orderBy(asc(pages.path));
}

export async function getPageById(db: DatabaseClient, id: string) {
  const result = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, id), isNull(pages.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function getPageByPath(db: DatabaseClient, siteId: string, path: string) {
  const result = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.path, path), isNull(pages.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function createPage(db: DatabaseClient, data: typeof pages.$inferInsert) {
  const result = await db.insert(pages).values(data).returning();
  return result[0] ?? null;
}

export async function updatePage(
  db: DatabaseClient,
  id: string,
  data: Partial<typeof pages.$inferInsert>,
) {
  const result = await db
    .update(pages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  return result[0] ?? null;
}

export async function deletePage(db: DatabaseClient, id: string) {
  const page = await getPageById(db, id);
  if (!page) return;
  await db
    .update(pages)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(pages.id, id), isNull(pages.deletedAt)));
}
