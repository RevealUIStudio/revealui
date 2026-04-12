import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createComment,
  deleteComment,
  getCommentById,
  getCommentsByTicket,
  updateComment,
} from '../ticket-comments.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createSelectChain(result: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
  };
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

describe('ticket-comment queries', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ---- getCommentById -----------------------------------------------------

  describe('getCommentById', () => {
    it('returns a comment when found', async () => {
      const comment = { id: 'c1', body: 'Hello' };
      const chain = createSelectChain([comment]);
      db.select.mockReturnValue(chain);

      const result = await getCommentById(db as never, 'c1');

      expect(result).toEqual(comment);
      expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getCommentById(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- getCommentsByTicket ------------------------------------------------

  describe('getCommentsByTicket', () => {
    it('returns comments ordered by createdAt', async () => {
      const comments = [
        { id: 'c1', ticketId: 't1', body: 'First' },
        { id: 'c2', ticketId: 't1', body: 'Second' },
      ];
      const chain = createSelectChain(comments);
      db.select.mockReturnValue(chain);

      const result = await getCommentsByTicket(db as never, 't1');

      expect(result).toEqual(comments);
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns empty array when no comments', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getCommentsByTicket(db as never, 't1');

      expect(result).toEqual([]);
    });
  });

  // ---- createComment ------------------------------------------------------

  describe('createComment', () => {
    it('creates comment and increments ticket comment count', async () => {
      const commentData = { id: 'c1', ticketId: 't1', authorId: 'u1', body: 'Great work' };
      const created = { ...commentData, createdAt: new Date() };

      const insertChain = createInsertChain([created]);
      db.insert.mockReturnValue(insertChain);

      // The update call to increment comment count
      const updateChain = createUpdateChain();
      db.update.mockReturnValue(updateChain);

      const result = await createComment(db as never, commentData);

      expect(result).toEqual(created);
      // Verify insert was called for comment
      expect(db.insert).toHaveBeenCalledTimes(1);
      // Verify update was called to increment comment count
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('creates comment without authorId', async () => {
      const commentData = { id: 'c1', ticketId: 't1', body: 'Anonymous comment' };
      const insertChain = createInsertChain([commentData]);
      db.insert.mockReturnValue(insertChain);

      const updateChain = createUpdateChain();
      db.update.mockReturnValue(updateChain);

      const result = await createComment(db as never, commentData);

      expect(result).toEqual(commentData);
    });
  });

  // ---- updateComment ------------------------------------------------------

  describe('updateComment', () => {
    it('updates comment body and returns result', async () => {
      const updated = { id: 'c1', body: 'Edited comment' };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updateComment(db as never, 'c1', { body: 'Edited comment' });

      expect(result).toEqual(updated);
      const setCall = chain.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(setCall?.body).toBe('Edited comment');
      expect(setCall?.updatedAt).toBeInstanceOf(Date);
    });

    it('returns null when comment does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await updateComment(db as never, 'nonexistent', { body: 'X' });

      expect(result).toBeNull();
    });

    it('handles rich text body (object)', async () => {
      const richBody = { type: 'doc', content: [{ type: 'paragraph', text: 'Hello' }] };
      const updated = { id: 'c1', body: richBody };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updateComment(db as never, 'c1', { body: richBody });

      expect(result).toEqual(updated);
    });
  });

  // ---- deleteComment ------------------------------------------------------

  describe('deleteComment', () => {
    it('deletes comment and decrements ticket comment count', async () => {
      // First select: get ticketId from comment
      const selectChain = createSelectChain([{ ticketId: 't1' }]);
      db.select.mockReturnValue(selectChain);

      // Delete the comment
      const deleteChain = createDeleteChain();
      db.delete.mockReturnValue(deleteChain);

      // Update to decrement comment count
      const updateChain = createUpdateChain();
      db.update.mockReturnValue(updateChain);

      await deleteComment(db as never, 'c1');

      expect(db.select).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('does not decrement when comment is not found', async () => {
      // Select returns empty  -  comment already gone
      const selectChain = createSelectChain([]);
      db.select.mockReturnValue(selectChain);

      const deleteChain = createDeleteChain();
      db.delete.mockReturnValue(deleteChain);

      await deleteComment(db as never, 'nonexistent');

      // Delete is still called (idempotent), but update should NOT be called
      expect(db.delete).toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  // ---- error handling -----------------------------------------------------

  describe('error handling', () => {
    it('propagates select errors', async () => {
      const chain = createSelectChain();
      chain.orderBy.mockRejectedValue(new Error('connection reset'));
      db.select.mockReturnValue(chain);

      await expect(getCommentsByTicket(db as never, 't1')).rejects.toThrow('connection reset');
    });

    it('propagates insert errors', async () => {
      const chain = createInsertChain();
      chain.returning.mockRejectedValue(new Error('body too large'));
      db.insert.mockReturnValue(chain);

      await expect(
        createComment(db as never, { id: 'c1', ticketId: 't1', body: 'X' }),
      ).rejects.toThrow('body too large');
    });

    it('propagates update errors', async () => {
      const chain = createUpdateChain();
      chain.returning.mockRejectedValue(new Error('concurrent modification'));
      db.update.mockReturnValue(chain);

      await expect(updateComment(db as never, 'c1', { body: 'X' })).rejects.toThrow(
        'concurrent modification',
      );
    });

    it('propagates delete select errors', async () => {
      const chain = createSelectChain();
      chain.limit.mockRejectedValue(new Error('read timeout'));
      db.select.mockReturnValue(chain);

      await expect(deleteComment(db as never, 'c1')).rejects.toThrow('read timeout');
    });
  });
});
