/**
 * Ticket comment database queries
 */

import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { ticketComments, tickets } from '../schema/tickets.js';
import { users } from '../schema/users.js';

export async function getCommentById(db: Database, id: string) {
  const result = await db.select().from(ticketComments).where(eq(ticketComments.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getCommentsByTicket(db: Database, ticketId: string) {
  return db
    .select()
    .from(ticketComments)
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(ticketComments.createdAt);
}

/** Get comments with author data joined (prevents N+1 when displaying threads) */
export async function getCommentsWithAuthors(db: Database, ticketId: string) {
  return db
    .select({
      comment: ticketComments,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(ticketComments)
    .leftJoin(users, eq(ticketComments.authorId, users.id))
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(ticketComments.createdAt);
}

/** Batch-load comments for multiple tickets (prevents N+1 on board views) */
export async function getCommentsByTicketIds(db: Database, ticketIds: string[]) {
  if (ticketIds.length === 0) return [];
  return db
    .select()
    .from(ticketComments)
    .where(inArray(ticketComments.ticketId, ticketIds))
    .orderBy(ticketComments.createdAt);
}

// NOTE: NeonDB HTTP driver does not support transactions. The insert and count
// update below are not atomic — a failure between them can leave the comment
// count out of sync. A periodic reconciliation job or manual correction may be
// needed if this becomes a problem in practice.
export async function createComment(
  db: Database,
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

export async function updateComment(db: Database, id: string, data: { body: unknown }) {
  const result = await db
    .update(ticketComments)
    .set({ body: data.body, updatedAt: new Date() })
    .where(eq(ticketComments.id, id))
    .returning();

  return result[0] ?? null;
}

// NOTE: NeonDB HTTP driver does not support transactions. The select, delete,
// and count update below are not atomic — a failure between them can leave the
// comment count out of sync or orphan a decrement without a deletion.
export async function deleteComment(db: Database, id: string) {
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
