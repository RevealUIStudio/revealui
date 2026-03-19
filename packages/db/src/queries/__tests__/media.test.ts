import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMedia, deleteMedia, getAllMedia, getMediaById, updateMedia } from '../media.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createSelectChain(result: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  // For getMediaById: limit(1) resolves directly
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

function createSoftDeleteChain() {
  return {
    set: vi.fn().mockReturnThis(),
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

describe('media queries', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ---- getAllMedia ---------------------------------------------------------

  describe('getAllMedia', () => {
    it('returns media with default pagination', async () => {
      const items = [{ id: 'm1', filename: 'image.png' }];
      const chain = createSelectChain(items);
      db.select.mockReturnValue(chain);

      const result = await getAllMedia(db as never);

      expect(result).toEqual(items);
      expect(chain.limit).toHaveBeenCalledWith(20);
      expect(chain.offset).toHaveBeenCalledWith(0);
    });

    it('applies mimeType filter when provided', async () => {
      const items = [{ id: 'm1', mimeType: 'image/png' }];
      const chain = createSelectChain(items);
      db.select.mockReturnValue(chain);

      const result = await getAllMedia(db as never, { mimeType: 'image' });

      expect(result).toEqual(items);
      expect(chain.where).toHaveBeenCalled();
    });

    it('applies custom limit and offset', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getAllMedia(db as never, { limit: 10, offset: 5 });

      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(chain.offset).toHaveBeenCalledWith(5);
    });

    it('returns empty array when no media', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getAllMedia(db as never);

      expect(result).toEqual([]);
    });
  });

  // ---- getMediaById -------------------------------------------------------

  describe('getMediaById', () => {
    it('returns media when found', async () => {
      const item = { id: 'm1', filename: 'photo.jpg' };
      const chain = createSelectChain([item]);
      // getMediaById calls .limit(1) which we need to resolve
      chain.limit.mockResolvedValue([item]);
      db.select.mockReturnValue(chain);

      const result = await getMediaById(db as never, 'm1');

      expect(result).toEqual(item);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      chain.limit.mockResolvedValue([]);
      db.select.mockReturnValue(chain);

      const result = await getMediaById(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- createMedia --------------------------------------------------------

  describe('createMedia', () => {
    it('creates and returns media', async () => {
      const data = { id: 'm1', filename: 'doc.pdf', mimeType: 'application/pdf' };
      const chain = createInsertChain([data]);
      db.insert.mockReturnValue(chain);

      const result = await createMedia(db as never, data as never);

      expect(result).toEqual(data);
      expect(chain.values).toHaveBeenCalledWith(data);
    });

    it('returns null when insert returns empty', async () => {
      const chain = createInsertChain([]);
      db.insert.mockReturnValue(chain);

      const result = await createMedia(db as never, { id: 'm1' } as never);

      expect(result).toBeNull();
    });
  });

  // ---- updateMedia --------------------------------------------------------

  describe('updateMedia', () => {
    it('updates and returns media', async () => {
      const updated = { id: 'm1', filename: 'renamed.png' };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updateMedia(db as never, 'm1', { filename: 'renamed.png' } as never);

      expect(result).toEqual(updated);
    });

    it('returns null when media does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await updateMedia(db as never, 'nonexistent', {} as never);

      expect(result).toBeNull();
    });
  });

  // ---- deleteMedia --------------------------------------------------------

  describe('deleteMedia', () => {
    it('soft-deletes media by id', async () => {
      const chain = createSoftDeleteChain();
      db.update.mockReturnValue(chain);

      await deleteMedia(db as never, 'm1');

      expect(db.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
      expect(chain.where).toHaveBeenCalled();
    });
  });

  // ---- error handling -----------------------------------------------------

  describe('error handling', () => {
    it('propagates select errors', async () => {
      const chain = createSelectChain();
      chain.offset.mockRejectedValue(new Error('connection lost'));
      db.select.mockReturnValue(chain);

      await expect(getAllMedia(db as never)).rejects.toThrow('connection lost');
    });

    it('propagates insert errors', async () => {
      const chain = createInsertChain();
      chain.returning.mockRejectedValue(new Error('disk full'));
      db.insert.mockReturnValue(chain);

      await expect(createMedia(db as never, {} as never)).rejects.toThrow('disk full');
    });

    it('propagates update errors', async () => {
      const chain = createUpdateChain();
      chain.returning.mockRejectedValue(new Error('constraint violation'));
      db.update.mockReturnValue(chain);

      await expect(updateMedia(db as never, 'm1', {} as never)).rejects.toThrow(
        'constraint violation',
      );
    });

    it('propagates delete errors', async () => {
      const chain = createSoftDeleteChain();
      chain.where.mockRejectedValue(new Error('permission denied'));
      db.update.mockReturnValue(chain);

      await expect(deleteMedia(db as never, 'm1')).rejects.toThrow('permission denied');
    });
  });
});
