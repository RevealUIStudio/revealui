/**
 * Site database queries
 */

import { and, desc, eq } from 'drizzle-orm'
import type { DatabaseClient } from '../client/types.js'
import { sites } from '../schema/sites.js'

export async function getAllSites(
  db: DatabaseClient,
  options: { ownerId?: string; status?: string; limit?: number; offset?: number } = {},
) {
  const { ownerId, status, limit = 20, offset = 0 } = options
  const conditions = [
    ...(ownerId ? [eq(sites.ownerId, ownerId)] : []),
    ...(status ? [eq(sites.status, status)] : []),
  ]
  return db
    .select()
    .from(sites)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sites.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function getSiteById(db: DatabaseClient, id: string) {
  const result = await db.select().from(sites).where(eq(sites.id, id)).limit(1)
  return result[0] ?? null
}

export async function getSiteBySlug(db: DatabaseClient, slug: string) {
  const result = await db.select().from(sites).where(eq(sites.slug, slug)).limit(1)
  return result[0] ?? null
}

export async function createSite(db: DatabaseClient, data: typeof sites.$inferInsert) {
  const result = await db.insert(sites).values(data).returning()
  return result[0] ?? null
}

export async function updateSite(
  db: DatabaseClient,
  id: string,
  data: Partial<typeof sites.$inferInsert>,
) {
  const result = await db
    .update(sites)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sites.id, id))
    .returning()
  return result[0] ?? null
}

export async function deleteSite(db: DatabaseClient, id: string) {
  await db.delete(sites).where(eq(sites.id, id))
}
