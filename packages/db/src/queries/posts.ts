/**
 * Post database queries
 */

import { and, desc, eq } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { posts } from '../schema/cms.js';

export async function getAllPosts(
  db: DatabaseClient,
  options: { status?: string; authorId?: string; limit?: number; offset?: number } = {},
) {
  const { status, authorId, limit = 20, offset = 0 } = options;
  const conditions = [
    ...(status ? [eq(posts.status, status)] : []),
    ...(authorId ? [eq(posts.authorId, authorId)] : []),
  ];
  return db
    .select()
    .from(posts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPostById(db: DatabaseClient, id: string) {
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getPostBySlug(db: DatabaseClient, slug: string) {
  const result = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function createPost(db: DatabaseClient, data: typeof posts.$inferInsert) {
  const result = await db.insert(posts).values(data).returning();
  return result[0] ?? null;
}

export async function updatePost(
  db: DatabaseClient,
  id: string,
  data: Partial<typeof posts.$inferInsert>,
) {
  const result = await db
    .update(posts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();
  return result[0] ?? null;
}

export async function deletePost(db: DatabaseClient, id: string) {
  await db.delete(posts).where(eq(posts.id, id));
}
