/**
 * Ticket comment database queries
 */

import { eq, sql } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { ticketComments, tickets } from '../schema/tickets.js';

export async function getCommentById(db: DatabaseClient, id: string) {
  const result = await db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getCommentsByTicket(db: DatabaseClient, ticketId: string) {
  return db
    .select()
    .from(ticketComments)
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(ticketComments.createdAt);
}

export async function createComment(
  db: DatabaseClient,
  data: { id: string; ticketId: string; authorId?: string; body: unknown },
) {
  const result = await db.insert(ticketComments).values(data).returning();

  // Increment comment count on the ticket
  await db
    .update(tickets)
    .set({
      commentCount: sql`${tickets.commentCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, data.ticketId));

  return result[0];
}

export async function updateComment(db: DatabaseClient, id: string, data: { body: unknown }) {
  const result = await db
    .update(ticketComments)
    .set({ body: data.body, updatedAt: new Date() })
    .where(eq(ticketComments.id, id))
    .returning();

  return result[0] ?? null;
}

export async function deleteComment(db: DatabaseClient, id: string) {
  // Get the ticket ID before deleting
  const comment = await db
    .select({ ticketId: ticketComments.ticketId })
    .from(ticketComments)
    .where(eq(ticketComments.id, id))
    .limit(1);

  await db.delete(ticketComments).where(eq(ticketComments.id, id));

  // Decrement comment count
  if (comment[0]) {
    await db
      .update(tickets)
      .set({
        commentCount: sql`GREATEST(${tickets.commentCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, comment[0].ticketId));
  }
}
