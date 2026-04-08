/**
 * Board database queries
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { boardColumns, boards } from '../schema/tickets.js';

const DEFAULT_COLUMNS = [
  { name: 'Backlog', slug: 'backlog', position: 0 },
  { name: 'To Do', slug: 'todo', position: 1, isDefault: true },
  { name: 'In Progress', slug: 'in-progress', position: 2 },
  { name: 'Review', slug: 'review', position: 3 },
  { name: 'Done', slug: 'done', position: 4 },
] as const;

export async function getAllBoards(db: Database, tenantId?: string) {
  if (tenantId) {
    return db.select().from(boards).where(eq(boards.tenantId, tenantId)).orderBy(boards.createdAt);
  }
  return db.select().from(boards).orderBy(boards.createdAt);
}

export async function getBoardById(db: Database, id: string) {
  const result = await db.select().from(boards).where(eq(boards.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getBoardBySlug(db: Database, slug: string, tenantId?: string) {
  const conditions = [eq(boards.slug, slug)];
  if (tenantId) conditions.push(eq(boards.tenantId, tenantId));

  const result = await db
    .select()
    .from(boards)
    .where(and(...conditions))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Create a board with default kanban columns.
 *
 * NOTE: NeonDB HTTP driver does not support transactions. The board insert and
 * column insert below are not atomic — a failure after the board is created but
 * before columns are inserted will leave a board without its default columns.
 */
export async function createBoard(
  db: Database,
  data: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    ownerId?: string;
    tenantId?: string;
    isDefault?: boolean;
  },
) {
  const result = await db.insert(boards).values(data).returning();
  const board = result[0];

  if (board) {
    // Create default columns
    await db.insert(boardColumns).values(
      DEFAULT_COLUMNS.map((col, _i) => ({
        id: `${board.id}-col-${col.slug}`,
        boardId: board.id,
        name: col.name,
        slug: col.slug,
        position: col.position,
        isDefault: 'isDefault' in col ? col.isDefault : false,
      })),
    );
  }

  return board;
}

export async function updateBoard(
  db: Database,
  id: string,
  data: Partial<{ name: string; slug: string; description: string; ownerId: string | null }>,
) {
  const result = await db
    .update(boards)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(boards.id, id))
    .returning();

  return result[0] ?? null;
}

export async function deleteBoard(db: Database, id: string) {
  await db.delete(boards).where(eq(boards.id, id));
}

export async function getColumnById(db: Database, id: string) {
  const result = await db.select().from(boardColumns).where(eq(boardColumns.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getColumnsByBoard(db: Database, boardId: string) {
  return db
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.boardId, boardId))
    .orderBy(boardColumns.position);
}

export async function createColumn(
  db: Database,
  data: {
    id: string;
    boardId: string;
    name: string;
    slug: string;
    position: number;
    wipLimit?: number;
    color?: string;
  },
) {
  const result = await db.insert(boardColumns).values(data).returning();
  return result[0];
}

export async function updateColumn(
  db: Database,
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    position: number;
    wipLimit: number | null;
    color: string | null;
  }>,
) {
  const result = await db
    .update(boardColumns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(boardColumns.id, id))
    .returning();

  return result[0] ?? null;
}

export async function deleteColumn(db: Database, id: string) {
  await db.delete(boardColumns).where(eq(boardColumns.id, id));
}
