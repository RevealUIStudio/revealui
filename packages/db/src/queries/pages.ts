/**
 * Page database queries
 */

import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { pages } from '../schema/pages.js';
import { getLiveSiteIds, getSiteIdsForContentRead } from './sites.js';

interface PageListOptions {
  siteId?: string;
  siteOwnerId?: string;
  status?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

function pageListConditions(db: Database, options: PageListOptions) {
  const { siteId, siteOwnerId, status, createdBy } = options;
  if (!(siteId || siteOwnerId))
    throw new Error('Page collection reads require a site or owner scope');
  const conditions = [
    isNull(pages.deletedAt),
    inArray(pages.siteId, getLiveSiteIds(db)),
    ...(siteId ? [eq(pages.siteId, siteId)] : []),
    ...(siteOwnerId
      ? [inArray(pages.siteId, getSiteIdsForContentRead(db, { id: siteOwnerId }, null))]
      : []),
    ...(status ? [eq(pages.status, status)] : []),
    ...(createdBy ? [eq(pages.createdBy, createdBy)] : []),
  ];
  return and(...conditions);
}

/** Shared collection/site list query. Ownership comes from trusted callers. */
export async function getPages(db: Database, options: PageListOptions) {
  const query = db
    .select()
    .from(pages)
    .where(pageListConditions(db, options))
    .orderBy(asc(pages.path), asc(pages.id));
  if (options.limit === undefined && options.offset === undefined) return query;
  const bounded = query.$dynamic();
  if (options.limit !== undefined) bounded.limit(options.limit);
  if (options.offset !== undefined) bounded.offset(options.offset);
  return bounded;
}

export async function countPages(db: Database, options: PageListOptions) {
  const result = await db
    .select({ total: count() })
    .from(pages)
    .where(pageListConditions(db, options));
  return result[0]?.total ?? 0;
}

export async function getPagesBySite(
  db: Database,
  siteId: string,
  options: { status?: string; createdBy?: string } = {},
) {
  return getPages(db, { ...options, siteId });
}

export async function getPageById(db: Database, id: string) {
  const result = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, id), isNull(pages.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function getPageByPath(db: Database, siteId: string, path: string) {
  const result = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.path, path), isNull(pages.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function createPage(db: Database, data: typeof pages.$inferInsert) {
  const result = await db.insert(pages).values(data).returning();
  return result[0] ?? null;
}

export async function updatePage(
  db: Database,
  id: string,
  data: Partial<typeof pages.$inferInsert>,
) {
  // Creation attribution is immutable; ordinary updates cannot claim a page.
  const mutable = { ...data, createdBy: undefined };
  const result = await db
    .update(pages)
    .set({ ...mutable, updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  return result[0] ?? null;
}

export async function deletePage(db: Database, id: string) {
  const page = await getPageById(db, id);
  if (!page) return;
  await db
    .update(pages)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(pages.id, id), isNull(pages.deletedAt)));
}
