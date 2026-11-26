/**
 * Page database queries
 */

import { isPlatformSuperAdmin, type PlatformAuthUser } from '@revealui/utils/validation';
import { and, asc, count, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { pages } from '../schema/pages.js';
import { sites } from '../schema/sites.js';
import { getLiveSiteIds, getSiteIdsForContentRead } from './sites.js';

interface PageListOptions {
  siteId?: string;
  siteOwnerId?: string;
  status?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
  access?: PageReadAccess;
}

export interface PageReadAccess {
  actor: PlatformAuthUser | null;
  mode: 'hosted' | 'forge' | null;
  includePublic?: boolean;
}

/** SQL audience enforcement before pagination/counting; viewers never receive drafts. */
export function pageContentReadCondition(db: Database, access: PageReadAccess) {
  const { actor, mode, includePublic } = access;
  return and(
    isNull(pages.deletedAt),
    isPlatformSuperAdmin(actor)
      ? undefined
      : inArray(
          pages.siteId,
          db
            .select({ id: sites.id })
            .from(sites)
            .where(
              or(
                sql`NOT COALESCE(${sites.settings} ? 'consultation', false)`,
                inArray(pages.slug, ['session-notes', 'recommended-next-step']),
                and(
                  sql`${sites.settings}->'consultationLifecycle'->'domainPackPurchased' = 'true'::jsonb`,
                  sql`${sites.settings}->'consultationLifecycle'->>'domainPack' IN ('entitled', 'retained')`,
                ),
              ),
            ),
        ),
    or(
      and(
        eq(pages.status, 'published'),
        inArray(pages.siteId, getSiteIdsForContentRead(db, actor, mode, { includePublic })),
      ),
      inArray(pages.siteId, getSiteIdsForContentRead(db, actor, mode, { draft: true })),
    ),
  );
}

function pageListConditions(db: Database, options: PageListOptions) {
  const { siteId, siteOwnerId, status, createdBy } = options;
  if (!(siteId || siteOwnerId || options.access))
    throw new Error('Page collection reads require a site or owner scope');
  const conditions = [
    isNull(pages.deletedAt),
    inArray(pages.siteId, getLiveSiteIds(db)),
    ...(options.access ? [pageContentReadCondition(db, options.access)] : []),
    ...(siteId ? [eq(pages.siteId, siteId)] : []),
    ...(siteOwnerId
      ? [
          inArray(
            pages.siteId,
            db.select({ id: sites.id }).from(sites).where(eq(sites.ownerId, siteOwnerId)),
          ),
        ]
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
  options: { status?: string; createdBy?: string; access?: PageReadAccess } = {},
) {
  return getPages(db, { ...options, siteId });
}

export async function getPageById(db: Database, id: string, access?: PageReadAccess) {
  const result = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.id, id),
        isNull(pages.deletedAt),
        access ? pageContentReadCondition(db, access) : undefined,
      ),
    )
    .limit(1);
  return result[0] ?? null;
}

export async function getPageByPath(
  db: Database,
  siteId: string,
  path: string,
  access?: PageReadAccess,
) {
  const result = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.siteId, siteId),
        eq(pages.path, path),
        isNull(pages.deletedAt),
        access ? pageContentReadCondition(db, access) : undefined,
      ),
    )
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
  // Creation identity and site ownership are immutable in ordinary updates.
  const mutable = {
    ...data,
    id: undefined,
    siteId: undefined,
    createdBy: undefined,
    createdAt: undefined,
  };
  const result = await db
    .update(pages)
    .set({ ...mutable, updatedAt: new Date() })
    .where(
      and(
        eq(pages.id, id),
        isNull(pages.deletedAt),
        data.siteId !== undefined ? eq(pages.siteId, data.siteId) : undefined,
      ),
    )
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
