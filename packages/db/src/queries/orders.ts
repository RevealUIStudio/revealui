/**
 * Order database queries
 */

import { and, count, desc, eq } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { orders } from '../schema/products.js';

/** Count orders matching filters (for pagination) */
export async function countOrders(
  db: Database,
  options: { customerId?: string; status?: string } = {},
) {
  const { customerId, status } = options;
  const conditions = [
    ...(customerId ? [eq(orders.customerId, customerId)] : []),
    ...(status ? [eq(orders.status, status)] : []),
  ];
  const result = await db
    .select({ total: count() })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return result[0]?.total ?? 0;
}

export async function getAllOrders(
  db: Database,
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

export async function getOrderById(db: Database, id: string) {
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createOrder(db: Database, data: typeof orders.$inferInsert) {
  const result = await db.insert(orders).values(data).returning();
  return result[0] ?? null;
}

export async function updateOrder(
  db: Database,
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
