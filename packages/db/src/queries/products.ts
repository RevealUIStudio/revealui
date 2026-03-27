/**
 * Product database queries
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { products } from '../schema/products.js';

export async function getAllProducts(
  db: DatabaseClient,
  options: { status?: string; ownerId?: string; limit?: number; offset?: number } = {},
) {
  const { status, ownerId, limit = 20, offset = 0 } = options;
  const conditions = [
    isNull(products.deletedAt),
    ...(status ? [eq(products.status, status)] : []),
    ...(ownerId ? [eq(products.ownerId, ownerId)] : []),
  ];
  return db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getProductById(db: DatabaseClient, id: string) {
  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function getProductBySlug(db: DatabaseClient, slug: string) {
  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), isNull(products.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function createProduct(db: DatabaseClient, data: typeof products.$inferInsert) {
  const result = await db.insert(products).values(data).returning();
  return result[0] ?? null;
}

export async function updateProduct(
  db: DatabaseClient,
  id: string,
  data: Partial<typeof products.$inferInsert>,
) {
  const result = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .returning();
  return result[0] ?? null;
}

export async function deleteProduct(db: DatabaseClient, id: string) {
  await db
    .update(products)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(products.id, id), isNull(products.deletedAt)));
}
