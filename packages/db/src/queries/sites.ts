/**
 * Site database queries
 */

import {
  canAdministerAllContent,
  canManageSiteContent,
  type PlatformAuthUser,
} from '@revealui/utils/validation';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { sites } from '../schema/sites.js';
import { users } from '../schema/users.js';

/** Condition that excludes soft-deleted sites */
const notDeleted = isNull(sites.deletedAt);

/** Count sites matching filters (for pagination) */
export async function countSites(
  db: Database,
  options: { ownerId?: string; status?: string; includeDeleted?: boolean } = {},
) {
  const { ownerId, status, includeDeleted = false } = options;
  const conditions = [
    ...(includeDeleted ? [] : [notDeleted]),
    ...(ownerId ? [eq(sites.ownerId, ownerId)] : []),
    ...(status ? [eq(sites.status, status)] : []),
  ];
  const result = await db
    .select({ total: count() })
    .from(sites)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return result[0]?.total ?? 0;
}

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

/** Resolve authorization fields from the canonical user row, never flattened CMS roles. */
export async function getSiteContentActor(
  db: Database,
  userId: string,
): Promise<PlatformAuthUser | null> {
  const [actor] = await db
    .select({
      id: users.id,
      role: users.role,
      emailVerified: users.emailVerified,
      _json: users._json,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt), eq(users.status, 'active')))
    .limit(1);
  return actor ?? null;
}

/** Owner/operator authority. Deployment posture is supplied by maintained server configuration. */
export async function actorCanManageSite(
  db: Database,
  actor: PlatformAuthUser | null,
  siteId: string,
  mode: 'hosted' | 'forge' | null,
): Promise<boolean> {
  const site = await getSiteById(db, siteId);
  return Boolean(site && canManageSiteContent(actor, site.ownerId, mode));
}

/** Unpaginated SQL subquery for page reads; deleted sites never grant visibility. */
export function getSiteIdsForContentRead(
  db: Database,
  actor: PlatformAuthUser | null,
  mode: 'hosted' | 'forge' | null,
) {
  return db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        notDeleted,
        !actor ? eq(sites.status, 'published') : undefined,
        actor && !canAdministerAllContent(actor, mode)
          ? eq(sites.ownerId, String(actor.id))
          : undefined,
      ),
    );
}
