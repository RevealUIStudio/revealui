/**
 * Media database queries
 */

import { and, desc, eq, isNull, like } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { media } from '../schema/cms.js';

export async function getAllMedia(
  db: DatabaseClient,
  options: { mimeType?: string; uploadedBy?: string; limit?: number; offset?: number } = {},
) {
  const { mimeType, uploadedBy, limit = 20, offset = 0 } = options;
  const conditions = [
    isNull(media.deletedAt),
    ...(mimeType ? [like(media.mimeType, `${mimeType}%`)] : []),
    ...(uploadedBy ? [eq(media.uploadedBy, uploadedBy)] : []),
  ];
  return db
    .select()
    .from(media)
    .where(and(...conditions))
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getMediaById(db: DatabaseClient, id: string) {
  const result = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), isNull(media.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function createMedia(db: DatabaseClient, data: typeof media.$inferInsert) {
  const result = await db.insert(media).values(data).returning();
  return result[0] ?? null;
}

export async function updateMedia(
  db: DatabaseClient,
  id: string,
  data: Partial<typeof media.$inferInsert>,
) {
  const result = await db
    .update(media)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(media.id, id))
    .returning();
  return result[0] ?? null;
}

export async function deleteMedia(db: DatabaseClient, id: string) {
  await db
    .update(media)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(media.id, id), isNull(media.deletedAt)));
}
