/**
 * Media database queries
 */

import { and, desc, eq, isNull, like } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { media } from '../schema/admin.js';

export async function getAllMedia(
  db: Database,
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

export async function getMediaById(db: Database, id: string) {
  const result = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), isNull(media.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function createMedia(db: Database, data: typeof media.$inferInsert) {
  const result = await db.insert(media).values(data).returning();
  return result[0] ?? null;
}

export async function updateMedia(
  db: Database,
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

export async function deleteMedia(db: Database, id: string) {
  await db
    .update(media)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(media.id, id), isNull(media.deletedAt)));
}
