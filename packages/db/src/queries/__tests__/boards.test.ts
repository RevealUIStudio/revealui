import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBoard,
  createColumn,
  deleteBoard,
  deleteColumn,
  getAllBoards,
  getBoardById,
  getBoardBySlug,
  getColumnById,
  getColumnsByBoard,
  updateBoard,
  updateColumn,
} from '../boards.js';

// ---------------------------------------------------------------------------
// Mock helpers  -  chainable Drizzle query builders
// ---------------------------------------------------------------------------

function createSelectChain(result: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  // When no limit is called, the chain itself resolves
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(result);
  return chain;
}

function createInsertChain(result: unknown[] = []) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function createUpdateChain(result: unknown[] = []) {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function createDeleteChain() {
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('board queries', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ---- getAllBoards --------------------------------------------------------

  describe('getAllBoards', () => {
    it('returns all boards without tenant filter', async () => {
      const boards = [{ id: 'b1', name: 'Board 1' }];
      const chain = createSelectChain(boards);
      db.select.mockReturnValue(chain);

      const result = await getAllBoards(db as never);

      expect(db.select).toHaveBeenCalled();
      expect(chain.from).toHaveBeenCalled();
      expect(result).toEqual(boards);
    });

    it('filters by tenantId when provided', async () => {
      const boards = [{ id: 'b1', name: 'Board 1', tenantId: 't1' }];
      const chain = createSelectChain(boards);
      db.select.mockReturnValue(chain);
      // When tenantId is provided, .where() is called before .orderBy()
      chain.where.mockReturnValue(chain);

      const result = await getAllBoards(db as never, 't1');

      expect(chain.where).toHaveBeenCalled();
      expect(result).toEqual(boards);
    });

    it('returns empty array when no boards exist', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getAllBoards(db as never);

      expect(result).toEqual([]);
    });
  });

  // ---- getBoardById -------------------------------------------------------

  describe('getBoardById', () => {
    it('returns a board when found', async () => {
      const board = { id: 'b1', name: 'Board 1' };
      const chain = createSelectChain([board]);
      db.select.mockReturnValue(chain);

      const result = await getBoardById(db as never, 'b1');

      expect(result).toEqual(board);
      expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getBoardById(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- getBoardBySlug -----------------------------------------------------

  describe('getBoardBySlug', () => {
    it('returns a board by slug', async () => {
      const board = { id: 'b1', slug: 'my-board' };
      const chain = createSelectChain([board]);
      db.select.mockReturnValue(chain);

      const result = await getBoardBySlug(db as never, 'my-board');

      expect(result).toEqual(board);
    });

    it('filters by tenantId when provided', async () => {
      const board = { id: 'b1', slug: 'my-board', tenantId: 't1' };
      const chain = createSelectChain([board]);
      db.select.mockReturnValue(chain);

      const result = await getBoardBySlug(db as never, 'my-board', 't1');

      expect(result).toEqual(board);
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getBoardBySlug(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- createBoard --------------------------------------------------------

  describe('createBoard', () => {
    it('creates a board and default columns', async () => {
      const boardData = { id: 'b1', name: 'New Board', slug: 'new-board' };
      const createdBoard = { ...boardData, createdAt: new Date() };

      const insertChain1 = createInsertChain([createdBoard]);
      const insertChain2 = createInsertChain([]);

      db.insert.mockReturnValueOnce(insertChain1).mockReturnValueOnce(insertChain2);

      const result = await createBoard(db as never, boardData);

      expect(result).toEqual(createdBoard);
      // First insert: board. Second insert: default columns.
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('does not insert columns when board insert returns empty', async () => {
      const boardData = { id: 'b1', name: 'New Board', slug: 'new-board' };
      const insertChain = createInsertChain([]);
      db.insert.mockReturnValue(insertChain);

      const result = await createBoard(db as never, boardData);

      expect(result).toBeUndefined();
      // Only the board insert, no column insert
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('passes optional fields through', async () => {
      const boardData = {
        id: 'b2',
        name: 'Owned Board',
        slug: 'owned',
        description: 'A described board',
        ownerId: 'u1',
        tenantId: 't1',
        isDefault: true,
      };
      const insertChain1 = createInsertChain([boardData]);
      const insertChain2 = createInsertChain([]);
      db.insert.mockReturnValueOnce(insertChain1).mockReturnValueOnce(insertChain2);

      const result = await createBoard(db as never, boardData);

      expect(result).toEqual(boardData);
      expect(insertChain1.values).toHaveBeenCalledWith(boardData);
    });
  });

  // ---- updateBoard --------------------------------------------------------

  describe('updateBoard', () => {
    it('updates and returns the board', async () => {
      const updated = { id: 'b1', name: 'Updated' };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updateBoard(db as never, 'b1', { name: 'Updated' });

      expect(result).toEqual(updated);
      expect(chain.set).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns null when board does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await updateBoard(db as never, 'nonexistent', { name: 'X' });

      expect(result).toBeNull();
    });
  });

  // ---- deleteBoard --------------------------------------------------------

  describe('deleteBoard', () => {
    it('deletes a board by id', async () => {
      const chain = createDeleteChain();
      db.delete.mockReturnValue(chain);

      await deleteBoard(db as never, 'b1');

      expect(db.delete).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });
  });

  // ---- getColumnById ------------------------------------------------------

  describe('getColumnById', () => {
    it('returns a column when found', async () => {
      const column = { id: 'c1', name: 'To Do' };
      const chain = createSelectChain([column]);
      db.select.mockReturnValue(chain);

      const result = await getColumnById(db as never, 'c1');

      expect(result).toEqual(column);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getColumnById(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- getColumnsByBoard --------------------------------------------------

  describe('getColumnsByBoard', () => {
    it('returns columns ordered by position', async () => {
      const columns = [
        { id: 'c1', position: 0 },
        { id: 'c2', position: 1 },
      ];
      const chain = createSelectChain(columns);
      db.select.mockReturnValue(chain);

      const result = await getColumnsByBoard(db as never, 'b1');

      expect(result).toEqual(columns);
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns empty array when no columns', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);
      // orderBy resolves to empty
      chain.orderBy.mockResolvedValue([]);

      const result = await getColumnsByBoard(db as never, 'b1');

      expect(result).toEqual([]);
    });
  });

  // ---- createColumn -------------------------------------------------------

  describe('createColumn', () => {
    it('creates and returns a column', async () => {
      const colData = { id: 'c1', boardId: 'b1', name: 'Backlog', slug: 'backlog', position: 0 };
      const chain = createInsertChain([colData]);
      db.insert.mockReturnValue(chain);

      const result = await createColumn(db as never, colData);

      expect(result).toEqual(colData);
      expect(chain.values).toHaveBeenCalledWith(colData);
    });

    it('passes optional wipLimit and color', async () => {
      const colData = {
        id: 'c2',
        boardId: 'b1',
        name: 'In Progress',
        slug: 'in-progress',
        position: 1,
        wipLimit: 5,
        color: '#ff0000',
      };
      const chain = createInsertChain([colData]);
      db.insert.mockReturnValue(chain);

      const result = await createColumn(db as never, colData);

      expect(result).toEqual(colData);
    });
  });

  // ---- updateColumn -------------------------------------------------------

  describe('updateColumn', () => {
    it('updates and returns the column', async () => {
      const updated = { id: 'c1', name: 'Renamed' };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updateColumn(db as never, 'c1', { name: 'Renamed' });

      expect(result).toEqual(updated);
    });

    it('returns null when column does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await updateColumn(db as never, 'nonexistent', { name: 'X' });

      expect(result).toBeNull();
    });
  });

  // ---- deleteColumn -------------------------------------------------------

  describe('deleteColumn', () => {
    it('deletes a column by id', async () => {
      const chain = createDeleteChain();
      db.delete.mockReturnValue(chain);

      await deleteColumn(db as never, 'c1');

      expect(db.delete).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });
  });

  // ---- error handling -----------------------------------------------------

  describe('error handling', () => {
    it('propagates database errors from select', async () => {
      const chain = createSelectChain();
      chain.orderBy.mockRejectedValue(new Error('connection failed'));
      db.select.mockReturnValue(chain);

      await expect(getAllBoards(db as never)).rejects.toThrow('connection failed');
    });

    it('propagates database errors from insert', async () => {
      const chain = createInsertChain();
      chain.returning.mockRejectedValue(new Error('unique constraint'));
      db.insert.mockReturnValue(chain);

      await expect(
        createBoard(db as never, { id: 'b1', name: 'Board', slug: 'board' }),
      ).rejects.toThrow('unique constraint');
    });

    it('propagates database errors from update', async () => {
      const chain = createUpdateChain();
      chain.returning.mockRejectedValue(new Error('db timeout'));
      db.update.mockReturnValue(chain);

      await expect(updateBoard(db as never, 'b1', { name: 'X' })).rejects.toThrow('db timeout');
    });

    it('propagates database errors from delete', async () => {
      const chain = createDeleteChain();
      chain.where.mockRejectedValue(new Error('foreign key violation'));
      db.delete.mockReturnValue(chain);

      await expect(deleteBoard(db as never, 'b1')).rejects.toThrow('foreign key violation');
    });
  });
});
