/**
 * Order database queries
 */

import { and, desc, eq } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { orders } from '../schema/products.js';

export async function getAllOrders(
  db: DatabaseClient,
  options: { customerId?: string; status?: string; limit?: number; offset?: number } = {},
) {
  const { customerId, status, limit = 20, offset = 0 } = options;
  const conditions = [
    ...(customerId ? [eq(orders.customerId, customerId)] : []),
    ...(status ? [eq(orders.status, status)] : []),
  ];
  return db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getOrderById(db: DatabaseClient, id: string) {
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createOrder(db: DatabaseClient, data: typeof orders.$inferInsert) {
  const result = await db.insert(orders).values(data).returning();
  return result[0] ?? null;
}

export async function updateOrder(
  db: DatabaseClient,
  id: string,
  data: Partial<typeof orders.$inferInsert>,
) {
  const result = await db
    .update(orders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  return result[0] ?? null;
}
