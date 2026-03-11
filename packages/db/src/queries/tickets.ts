/**
 * Ticket database queries
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { tickets } from '../schema/tickets.js';

export async function getTicketsByBoard(
  db: DatabaseClient,
  boardId: string,
  filters?: {
    status?: string;
    priority?: string;
    type?: string;
    assigneeId?: string;
    columnId?: string;
  },
) {
  const conditions = [eq(tickets.boardId, boardId)];

  if (filters?.status) conditions.push(eq(tickets.status, filters.status));
  if (filters?.priority) conditions.push(eq(tickets.priority, filters.priority));
  if (filters?.type) conditions.push(eq(tickets.type, filters.type));
  if (filters?.assigneeId) conditions.push(eq(tickets.assigneeId, filters.assigneeId));
  if (filters?.columnId) conditions.push(eq(tickets.columnId, filters.columnId));

  return db
    .select()
    .from(tickets)
    .where(and(...conditions))
    .orderBy(tickets.sortOrder);
}

export async function getTicketById(db: DatabaseClient, id: string) {
  const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getTicketByNumber(db: DatabaseClient, boardId: string, ticketNumber: number) {
  const result = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.boardId, boardId), eq(tickets.ticketNumber, ticketNumber)))
    .limit(1);
  return result[0] ?? null;
}

export async function createTicket(
  db: DatabaseClient,
  data: {
    id: string;
    boardId: string;
    columnId?: string;
    parentTicketId?: string;
    title: string;
    description?: unknown;
    status?: string;
    priority?: string;
    type?: string;
    assigneeId?: string;
    reporterId?: string;
    dueDate?: Date;
    estimatedEffort?: number;
  },
) {
  // Atomic ticket number assignment — the subquery computes MAX+1 inside the
  // INSERT so concurrent inserts cannot produce duplicate numbers. The UNIQUE
  // constraint on (board_id, ticket_number) acts as a safety net.
  const result = await db
    .insert(tickets)
    .values({
      ...data,
      ticketNumber: sql<number>`(SELECT COALESCE(MAX(${tickets.ticketNumber}), 0) + 1 FROM ${tickets} WHERE ${tickets.boardId} = ${data.boardId})`,
      description: data.description ?? null,
    })
    .returning();

  return result[0];
}

export async function updateTicket(
  db: DatabaseClient,
  id: string,
  data: Partial<{
    title: string;
    description: unknown;
    status: string;
    priority: string;
    type: string;
    assigneeId: string | null;
    reporterId: string | null;
    columnId: string | null;
    dueDate: Date | null;
    estimatedEffort: number | null;
    sortOrder: number;
    closedAt: Date | null;
    metadata: Record<string, unknown>;
  }>,
) {
  const result = await db
    .update(tickets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();

  return result[0] ?? null;
}

export async function deleteTicket(db: DatabaseClient, id: string) {
  await db.delete(tickets).where(eq(tickets.id, id));
}

export async function moveTicket(
  db: DatabaseClient,
  id: string,
  columnId: string,
  sortOrder: number,
) {
  const result = await db
    .update(tickets)
    .set({ columnId, sortOrder, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();

  return result[0] ?? null;
}

export async function getSubtickets(db: DatabaseClient, parentTicketId: string) {
  return db
    .select()
    .from(tickets)
    .where(eq(tickets.parentTicketId, parentTicketId))
    .orderBy(tickets.sortOrder);
}

export async function getTicketsByColumn(db: DatabaseClient, columnId: string) {
  return db.select().from(tickets).where(eq(tickets.columnId, columnId)).orderBy(tickets.sortOrder);
}

export async function getOverdueTickets(db: DatabaseClient, boardId: string) {
  return db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.boardId, boardId),
        sql`${tickets.dueDate} < NOW()`,
        sql`${tickets.status} NOT IN ('done', 'closed')`,
      ),
    )
    .orderBy(desc(tickets.dueDate));
}
