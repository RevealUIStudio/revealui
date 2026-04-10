/**
 * Post database queries
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { posts } from '../schema/admin.js';
import { users } from '../schema/users.js';

export async function getAllPosts(
  db: Database,
  options: { status?: string; authorId?: string; limit?: number; offset?: number } = {},
) {
  const { status, authorId, limit = 20, offset = 0 } = options;
  const conditions = [
    isNull(posts.deletedAt),
    ...(status ? [eq(posts.status, status)] : []),
    ...(authorId ? [eq(posts.authorId, authorId)] : []),
  ];
  return db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

/** List posts with author data joined (prevents N+1 when listing posts) */
export async function getPostsWithAuthor(
  db: Database,
  options: { status?: string; limit?: number; offset?: number } = {},
) {
  const { status, limit = 20, offset = 0 } = options;
  const conditions = [isNull(posts.deletedAt), ...(status ? [eq(posts.status, status)] : [])];
  return db
    .select({
      post: posts,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPostById(db: Database, id: string) {
  const result = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function getPostBySlug(db: Database, slug: string) {
  const result = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), isNull(posts.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function createPost(db: Database, data: typeof posts.$inferInsert) {
  const result = await db.insert(posts).values(data).returning();
  return result[0] ?? null;
}

export async function updatePost(
  db: Database,
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

export async function deletePost(db: Database, id: string) {
  await db
    .update(posts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)));
}
