import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPage,
  deletePage,
  getPageById,
  getPageByPath,
  getPagesBySite,
  updatePage,
} from '../pages.js';

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

describe('page queries', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ---- getPagesBySite -----------------------------------------------------

  describe('getPagesBySite', () => {
    it('returns pages for a site', async () => {
      const pages = [{ id: 'p1', siteId: 's1', path: '/about' }];
      const chain = createSelectChain(pages);
      db.select.mockReturnValue(chain);

      const result = await getPagesBySite(db as never, 's1');

      expect(result).toEqual(pages);
      expect(chain.where).toHaveBeenCalled();
    });

    it('filters by status when provided', async () => {
      const pages = [{ id: 'p1', status: 'published' }];
      const chain = createSelectChain(pages);
      db.select.mockReturnValue(chain);

      const result = await getPagesBySite(db as never, 's1', { status: 'published' });

      expect(result).toEqual(pages);
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns empty array when no pages', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getPagesBySite(db as never, 's1');

      expect(result).toEqual([]);
    });
  });

  // ---- getPageById --------------------------------------------------------

  describe('getPageById', () => {
    it('returns a page when found', async () => {
      const page = { id: 'p1', title: 'About Us' };
      const chain = createSelectChain([page]);
      db.select.mockReturnValue(chain);

      const result = await getPageById(db as never, 'p1');

      expect(result).toEqual(page);
      expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getPageById(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- getPageByPath ------------------------------------------------------

  describe('getPageByPath', () => {
    it('returns a page by site and path', async () => {
      const page = { id: 'p1', siteId: 's1', path: '/contact' };
      const chain = createSelectChain([page]);
      db.select.mockReturnValue(chain);

      const result = await getPageByPath(db as never, 's1', '/contact');

      expect(result).toEqual(page);
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns null when no matching page', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getPageByPath(db as never, 's1', '/nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- createPage ---------------------------------------------------------

  describe('createPage', () => {
    it('creates and returns a page', async () => {
      const data = { id: 'p1', siteId: 's1', title: 'New Page', path: '/new' };
      const chain = createInsertChain([data]);
      db.insert.mockReturnValue(chain);

      const result = await createPage(db as never, data as never);

      expect(result).toEqual(data);
      expect(chain.values).toHaveBeenCalledWith(data);
      // pageCount is maintained by DB trigger  -  no app-level update expected
      expect(db.update).not.toHaveBeenCalled();
    });

    it('returns null when insert returns empty', async () => {
      const chain = createInsertChain([]);
      db.insert.mockReturnValue(chain);

      const result = await createPage(db as never, {} as never);

      expect(result).toBeNull();
    });
  });

  // ---- updatePage ---------------------------------------------------------

  describe('updatePage', () => {
    it('updates and returns the page', async () => {
      const updated = { id: 'p1', title: 'Updated' };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updatePage(db as never, 'p1', { title: 'Updated' } as never);

      expect(result).toEqual(updated);
      expect(chain.set).toHaveBeenCalled();
    });

    it('returns null when page does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await updatePage(db as never, 'nonexistent', {} as never);

      expect(result).toBeNull();
    });
  });

  // ---- deletePage ---------------------------------------------------------

  describe('deletePage', () => {
    it('soft-deletes a page by id', async () => {
      // getPageById needs a select chain that resolves to the page
      const selectChain = createSelectChain([{ id: 'p1', siteId: 's1' }]);
      db.select.mockReturnValue(selectChain);
      // pageCount is maintained by DB trigger  -  only the soft-delete update
      const softDeleteChain = createSoftDeleteChain();
      db.update.mockReturnValue(softDeleteChain);

      await deletePage(db as never, 'p1');

      // getPageById must be called to look up the page
      expect(db.select).toHaveBeenCalled();
      // only one db.update: the soft-delete (pageCount handled by trigger)
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(softDeleteChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('does nothing when page not found', async () => {
      const selectChain = createSelectChain([]);
      db.select.mockReturnValue(selectChain);

      await deletePage(db as never, 'nonexistent');

      expect(db.update).not.toHaveBeenCalled();
    });
  });

  // ---- error handling -----------------------------------------------------

  describe('error handling', () => {
    it('propagates select errors', async () => {
      const chain = createSelectChain();
      chain.orderBy.mockRejectedValue(new Error('connection refused'));
      db.select.mockReturnValue(chain);

      await expect(getPagesBySite(db as never, 's1')).rejects.toThrow('connection refused');
    });

    it('propagates insert errors', async () => {
      const chain = createInsertChain();
      chain.returning.mockRejectedValue(new Error('duplicate path'));
      db.insert.mockReturnValue(chain);

      await expect(createPage(db as never, {} as never)).rejects.toThrow('duplicate path');
    });

    it('propagates update errors', async () => {
      const chain = createUpdateChain();
      chain.returning.mockRejectedValue(new Error('serialization failure'));
      db.update.mockReturnValue(chain);

      await expect(updatePage(db as never, 'p1', {} as never)).rejects.toThrow(
        'serialization failure',
      );
    });

    it('propagates delete errors', async () => {
      // getPageById needs a select chain (runs before soft-delete)
      db.select.mockReturnValue(createSelectChain([{ id: 'p1', siteId: 's1' }]));
      const chain = createSoftDeleteChain();
      chain.where.mockRejectedValue(new Error('cascade violation'));
      db.update.mockReturnValue(chain);

      await expect(deletePage(db as never, 'p1')).rejects.toThrow('cascade violation');
    });
  });
});
