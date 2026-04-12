import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTicket,
  deleteTicket,
  getOverdueTickets,
  getSubtickets,
  getTicketById,
  getTicketByNumber,
  getTicketsByBoard,
  getTicketsByColumn,
  moveTicket,
  updateTicket,
} from '../tickets.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createSelectChain(result: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
  };
  // Make chain thenable so `await db.select().from().where()` resolves
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function createInsertChain(result: unknown[] = []) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function createUpdateChain(result: unknown[] = []) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function createDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
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

describe('ticket queries', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ---- getTicketsByBoard --------------------------------------------------

  describe('getTicketsByBoard', () => {
    it('returns tickets for a board', async () => {
      const tickets = [{ id: 't1', boardId: 'b1', title: 'Fix bug' }];
      const chain = createSelectChain(tickets);
      db.select.mockReturnValue(chain);

      const result = await getTicketsByBoard(db as never, 'b1');

      expect(result).toEqual(tickets);
      expect(chain.where).toHaveBeenCalled();
    });

    it('applies status filter', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getTicketsByBoard(db as never, 'b1', { status: 'open' });

      expect(chain.where).toHaveBeenCalled();
    });

    it('applies priority filter', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getTicketsByBoard(db as never, 'b1', { priority: 'high' });

      expect(chain.where).toHaveBeenCalled();
    });

    it('applies type filter', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getTicketsByBoard(db as never, 'b1', { type: 'bug' });

      expect(chain.where).toHaveBeenCalled();
    });

    it('applies assigneeId filter', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getTicketsByBoard(db as never, 'b1', { assigneeId: 'u1' });

      expect(chain.where).toHaveBeenCalled();
    });

    it('applies columnId filter', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getTicketsByBoard(db as never, 'b1', { columnId: 'c1' });

      expect(chain.where).toHaveBeenCalled();
    });

    it('applies multiple filters simultaneously', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getTicketsByBoard(db as never, 'b1', {
        status: 'open',
        priority: 'high',
        type: 'bug',
        assigneeId: 'u1',
        columnId: 'c1',
      });

      expect(chain.where).toHaveBeenCalled();
    });

    it('returns empty array when no tickets', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getTicketsByBoard(db as never, 'b1');

      expect(result).toEqual([]);
    });
  });

  // ---- getTicketById ------------------------------------------------------

  describe('getTicketById', () => {
    it('returns a ticket when found', async () => {
      const ticket = { id: 't1', title: 'Test Ticket' };
      const chain = createSelectChain([ticket]);
      db.select.mockReturnValue(chain);

      const result = await getTicketById(db as never, 't1');

      expect(result).toEqual(ticket);
      expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getTicketById(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- getTicketByNumber --------------------------------------------------

  describe('getTicketByNumber', () => {
    it('returns a ticket by board and number', async () => {
      const ticket = { id: 't1', boardId: 'b1', ticketNumber: 42 };
      const chain = createSelectChain([ticket]);
      db.select.mockReturnValue(chain);

      const result = await getTicketByNumber(db as never, 'b1', 42);

      expect(result).toEqual(ticket);
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns null when ticket number not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getTicketByNumber(db as never, 'b1', 9999);

      expect(result).toBeNull();
    });
  });

  // ---- createTicket -------------------------------------------------------

  describe('createTicket', () => {
    it('creates ticket with atomic ticket number subquery', async () => {
      const created = { id: 't1', boardId: 'b1', title: 'New', ticketNumber: 6 };
      const insertChain = createInsertChain([created]);
      db.insert.mockReturnValue(insertChain);

      const result = await createTicket(db as never, {
        id: 't1',
        boardId: 'b1',
        title: 'New',
      });

      expect(result).toEqual(created);
      // ticketNumber is now a SQL subquery object, not a plain number
      const insertedValues = insertChain.values.mock.calls[0]?.[0] as
        | Record<string, unknown>
        | undefined;
      expect(insertedValues?.ticketNumber).toBeDefined();
      // No separate SELECT call  -  ticket number is computed atomically in INSERT
      expect(db.select).not.toHaveBeenCalled();
    });

    it('sets description to null when not provided', async () => {
      const insertChain = createInsertChain([{ id: 't1' }]);
      db.insert.mockReturnValue(insertChain);

      await createTicket(db as never, { id: 't1', boardId: 'b1', title: 'No desc' });

      const insertedValues = insertChain.values.mock.calls[0]?.[0] as
        | Record<string, unknown>
        | undefined;
      expect(insertedValues?.description).toBeNull();
    });

    it('passes optional fields through', async () => {
      const insertChain = createInsertChain([{ id: 't1' }]);
      db.insert.mockReturnValue(insertChain);

      await createTicket(db as never, {
        id: 't1',
        boardId: 'b1',
        title: 'Detailed',
        columnId: 'c1',
        status: 'open',
        priority: 'high',
        type: 'feature',
        assigneeId: 'u1',
        reporterId: 'u2',
        dueDate: new Date('2026-12-31'),
        estimatedEffort: 8,
        description: { text: 'rich content' },
      });

      const insertedValues = insertChain.values.mock.calls[0]?.[0] as
        | Record<string, unknown>
        | undefined;
      expect(insertedValues?.columnId).toBe('c1');
      expect(insertedValues?.priority).toBe('high');
      expect(insertedValues?.estimatedEffort).toBe(8);
      expect(insertedValues?.description).toEqual({ text: 'rich content' });
    });
  });

  // ---- updateTicket -------------------------------------------------------

  describe('updateTicket', () => {
    it('updates and returns the ticket', async () => {
      const updated = { id: 't1', title: 'Updated' };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updateTicket(db as never, 't1', { title: 'Updated' });

      expect(result).toEqual(updated);
      expect(chain.set).toHaveBeenCalled();
    });

    it('returns null when ticket does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await updateTicket(db as never, 'nonexistent', { title: 'X' });

      expect(result).toBeNull();
    });

    it('sets updatedAt timestamp', async () => {
      const chain = createUpdateChain([{ id: 't1' }]);
      db.update.mockReturnValue(chain);

      await updateTicket(db as never, 't1', { status: 'closed' });

      const setCall = chain.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(setCall?.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ---- deleteTicket -------------------------------------------------------

  describe('deleteTicket', () => {
    it('deletes a ticket by id', async () => {
      const chain = createDeleteChain();
      db.delete.mockReturnValue(chain);

      await deleteTicket(db as never, 't1');

      expect(db.delete).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });
  });

  // ---- moveTicket ---------------------------------------------------------

  describe('moveTicket', () => {
    it('moves ticket to new column with sort order', async () => {
      const moved = { id: 't1', columnId: 'c2', sortOrder: 3 };
      const chain = createUpdateChain([moved]);
      db.update.mockReturnValue(chain);

      const result = await moveTicket(db as never, 't1', 'c2', 3);

      expect(result).toEqual(moved);
      const setCall = chain.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(setCall?.columnId).toBe('c2');
      expect(setCall?.sortOrder).toBe(3);
      expect(setCall?.updatedAt).toBeInstanceOf(Date);
    });

    it('returns null when ticket does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await moveTicket(db as never, 'nonexistent', 'c1', 0);

      expect(result).toBeNull();
    });
  });

  // ---- getSubtickets ------------------------------------------------------

  describe('getSubtickets', () => {
    it('returns subtickets for a parent ticket', async () => {
      const subtickets = [
        { id: 't2', parentTicketId: 't1' },
        { id: 't3', parentTicketId: 't1' },
      ];
      const chain = createSelectChain(subtickets);
      db.select.mockReturnValue(chain);

      const result = await getSubtickets(db as never, 't1');

      expect(result).toEqual(subtickets);
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns empty array when no subtickets', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getSubtickets(db as never, 't1');

      expect(result).toEqual([]);
    });
  });

  // ---- getTicketsByColumn -------------------------------------------------

  describe('getTicketsByColumn', () => {
    it('returns tickets in a column ordered by sort order', async () => {
      const tickets = [{ id: 't1', columnId: 'c1', sortOrder: 0 }];
      const chain = createSelectChain(tickets);
      db.select.mockReturnValue(chain);

      const result = await getTicketsByColumn(db as never, 'c1');

      expect(result).toEqual(tickets);
    });

    it('returns empty array when column has no tickets', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getTicketsByColumn(db as never, 'c1');

      expect(result).toEqual([]);
    });
  });

  // ---- getOverdueTickets --------------------------------------------------

  describe('getOverdueTickets', () => {
    it('returns overdue tickets for a board', async () => {
      const overdue = [{ id: 't1', dueDate: new Date('2025-01-01') }];
      const chain = createSelectChain(overdue);
      db.select.mockReturnValue(chain);

      const result = await getOverdueTickets(db as never, 'b1');

      expect(result).toEqual(overdue);
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns empty array when no overdue tickets', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getOverdueTickets(db as never, 'b1');

      expect(result).toEqual([]);
    });
  });

  // ---- error handling -----------------------------------------------------

  describe('error handling', () => {
    it('propagates select errors', async () => {
      const chain = createSelectChain();
      chain.orderBy.mockRejectedValue(new Error('db unavailable'));
      db.select.mockReturnValue(chain);

      await expect(getTicketsByBoard(db as never, 'b1')).rejects.toThrow('db unavailable');
    });

    it('propagates insert errors in createTicket', async () => {
      // First select for max ticket number succeeds
      const maxChain = createSelectChain([{ max: 0 }]);
      db.select.mockReturnValue(maxChain);

      const insertChain = createInsertChain();
      insertChain.returning.mockRejectedValue(new Error('insert failed'));
      db.insert.mockReturnValue(insertChain);

      await expect(
        createTicket(db as never, { id: 't1', boardId: 'b1', title: 'Fail' }),
      ).rejects.toThrow('insert failed');
    });

    it('propagates update errors', async () => {
      const chain = createUpdateChain();
      chain.returning.mockRejectedValue(new Error('lock timeout'));
      db.update.mockReturnValue(chain);

      await expect(updateTicket(db as never, 't1', { title: 'X' })).rejects.toThrow('lock timeout');
    });

    it('propagates delete errors', async () => {
      const chain = createDeleteChain();
      chain.where.mockRejectedValue(new Error('cascade error'));
      db.delete.mockReturnValue(chain);

      await expect(deleteTicket(db as never, 't1')).rejects.toThrow('cascade error');
    });
  });
});
