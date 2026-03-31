import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSite,
  deleteSite,
  getAllSites,
  getSiteById,
  getSiteBySlug,
  updateSite,
} from '../sites.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createSelectChain(result: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn().mockResolvedValue(result),
  };
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  for (const key of ['from', 'where', 'orderBy', 'limit']) {
    chain[key]!.mockReturnValue(chain);
  }
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

describe('site queries', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ---- getAllSites ---------------------------------------------------------

  describe('getAllSites', () => {
    it('returns sites with default pagination', async () => {
      const sites = [{ id: 's1', name: 'My Site' }];
      const chain = createSelectChain(sites);
      db.select.mockReturnValue(chain);

      const result = await getAllSites(db as never);

      expect(result).toEqual(sites);
    });

    it('filters by ownerId', async () => {
      const sites = [{ id: 's1', ownerId: 'u1' }];
      const chain = createSelectChain(sites);
      db.select.mockReturnValue(chain);

      const result = await getAllSites(db as never, { ownerId: 'u1' });

      expect(result).toEqual(sites);
      expect(chain.where).toHaveBeenCalled();
    });

    it('filters by status', async () => {
      const sites = [{ id: 's1', status: 'active' }];
      const chain = createSelectChain(sites);
      db.select.mockReturnValue(chain);

      const result = await getAllSites(db as never, { status: 'active' });

      expect(result).toEqual(sites);
      expect(chain.where).toHaveBeenCalled();
    });

    it('filters by both ownerId and status', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getAllSites(db as never, { ownerId: 'u1', status: 'active' });

      expect(chain.where).toHaveBeenCalled();
    });

    it('applies custom limit and offset', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getAllSites(db as never, { limit: 10, offset: 30 });

      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(chain.offset).toHaveBeenCalledWith(30);
    });

    it('returns empty array when no sites', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getAllSites(db as never);

      expect(result).toEqual([]);
    });
  });

  // ---- getSiteById --------------------------------------------------------

  describe('getSiteById', () => {
    it('returns a site when found', async () => {
      const site = { id: 's1', name: 'Test Site' };
      const chain = createSelectChain([site]);
      db.select.mockReturnValue(chain);

      const result = await getSiteById(db as never, 's1');

      expect(result).toEqual(site);
      expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getSiteById(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- getSiteBySlug ------------------------------------------------------

  describe('getSiteBySlug', () => {
    it('returns a site by slug', async () => {
      const site = { id: 's1', slug: 'my-site' };
      const chain = createSelectChain([site]);
      db.select.mockReturnValue(chain);

      const result = await getSiteBySlug(db as never, 'my-site');

      expect(result).toEqual(site);
    });

    it('returns null when slug not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getSiteBySlug(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- createSite ---------------------------------------------------------

  describe('createSite', () => {
    it('creates and returns a site', async () => {
      const data = { id: 's1', name: 'New Site', slug: 'new-site' };
      const chain = createInsertChain([data]);
      db.insert.mockReturnValue(chain);

      const result = await createSite(db as never, data as never);

      expect(result).toEqual(data);
      expect(chain.values).toHaveBeenCalledWith(data);
    });

    it('returns null when insert returns empty', async () => {
      const chain = createInsertChain([]);
      db.insert.mockReturnValue(chain);

      const result = await createSite(db as never, {} as never);

      expect(result).toBeNull();
    });
  });

  // ---- updateSite ---------------------------------------------------------

  describe('updateSite', () => {
    it('updates and returns the site', async () => {
      const updated = { id: 's1', name: 'Updated Site' };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updateSite(db as never, 's1', { name: 'Updated Site' } as never);

      expect(result).toEqual(updated);
    });

    it('returns null when site does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await updateSite(db as never, 'nonexistent', {} as never);

      expect(result).toBeNull();
    });

    it('sets updatedAt timestamp', async () => {
      const chain = createUpdateChain([{ id: 's1' }]);
      db.update.mockReturnValue(chain);

      await updateSite(db as never, 's1', { name: 'X' } as never);

      const setCall = chain.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(setCall?.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ---- deleteSite ---------------------------------------------------------

  describe('deleteSite', () => {
    it('soft-deletes a site by id', async () => {
      const chain = createUpdateChain();
      db.update.mockReturnValue(chain);

      await deleteSite(db as never, 's1');

      expect(db.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });
  });

  // ---- error handling -----------------------------------------------------

  describe('error handling', () => {
    it('propagates select errors', async () => {
      const chain = createSelectChain();
      chain.offset.mockRejectedValue(new Error('pool exhausted'));
      db.select.mockReturnValue(chain);

      await expect(getAllSites(db as never)).rejects.toThrow('pool exhausted');
    });

    it('propagates insert errors', async () => {
      const chain = createInsertChain();
      chain.returning.mockRejectedValue(new Error('slug taken'));
      db.insert.mockReturnValue(chain);

      await expect(createSite(db as never, {} as never)).rejects.toThrow('slug taken');
    });

    it('propagates update errors', async () => {
      const chain = createUpdateChain();
      chain.returning.mockRejectedValue(new Error('optimistic lock'));
      db.update.mockReturnValue(chain);

      await expect(updateSite(db as never, 's1', {} as never)).rejects.toThrow('optimistic lock');
    });

    it('propagates delete errors', async () => {
      const chain = createUpdateChain();
      chain.where.mockRejectedValue(new Error('cascade blocked'));
      db.update.mockReturnValue(chain);

      await expect(deleteSite(db as never, 's1')).rejects.toThrow('cascade blocked');
    });
  });
});
