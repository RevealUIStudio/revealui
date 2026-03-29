import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPost,
  deletePost,
  getAllPosts,
  getPostById,
  getPostBySlug,
  updatePost,
} from '../posts.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createSelectChain(result: unknown[] = []) {
  // The chain must be both awaitable (for getById: `.limit(1)`) and chainable
  // (for getAllPosts: `.limit().offset()`). We make it thenable so `await chain`
  // resolves to `result`, while `.offset()` also resolves to `result`.
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

describe('post queries', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ---- getAllPosts ---------------------------------------------------------

  describe('getAllPosts', () => {
    it('returns posts with default pagination', async () => {
      const posts = [{ id: 'p1', title: 'Hello World' }];
      const chain = createSelectChain(posts);
      db.select.mockReturnValue(chain);

      const result = await getAllPosts(db as never);

      expect(result).toEqual(posts);
    });

    it('filters by status', async () => {
      const posts = [{ id: 'p1', status: 'published' }];
      const chain = createSelectChain(posts);
      db.select.mockReturnValue(chain);

      const result = await getAllPosts(db as never, { status: 'published' });

      expect(result).toEqual(posts);
      expect(chain.where).toHaveBeenCalled();
    });

    it('filters by authorId', async () => {
      const posts = [{ id: 'p1', authorId: 'u1' }];
      const chain = createSelectChain(posts);
      db.select.mockReturnValue(chain);

      const result = await getAllPosts(db as never, { authorId: 'u1' });

      expect(result).toEqual(posts);
      expect(chain.where).toHaveBeenCalled();
    });

    it('filters by both status and authorId', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getAllPosts(db as never, { status: 'draft', authorId: 'u2' });

      expect(chain.where).toHaveBeenCalled();
    });

    it('applies custom limit and offset', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getAllPosts(db as never, { limit: 5, offset: 10 });

      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(chain.offset).toHaveBeenCalledWith(10);
    });

    it('returns empty array when no posts', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getAllPosts(db as never);

      expect(result).toEqual([]);
    });

    it('passes undefined to where when no filters', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      await getAllPosts(db as never, {});

      // where is still called but with undefined (no conditions)
      expect(chain.where).toHaveBeenCalled();
    });
  });

  // ---- getPostById --------------------------------------------------------

  describe('getPostById', () => {
    it('returns a post when found', async () => {
      const post = { id: 'p1', title: 'Test Post' };
      const chain = createSelectChain([post]);
      db.select.mockReturnValue(chain);

      const result = await getPostById(db as never, 'p1');

      expect(result).toEqual(post);
      expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getPostById(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- getPostBySlug ------------------------------------------------------

  describe('getPostBySlug', () => {
    it('returns a post by slug', async () => {
      const post = { id: 'p1', slug: 'hello-world' };
      const chain = createSelectChain([post]);
      db.select.mockReturnValue(chain);

      const result = await getPostBySlug(db as never, 'hello-world');

      expect(result).toEqual(post);
    });

    it('returns null when slug not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await getPostBySlug(db as never, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- createPost ---------------------------------------------------------

  describe('createPost', () => {
    it('creates and returns a post', async () => {
      const data = { id: 'p1', title: 'New Post', slug: 'new-post' };
      const chain = createInsertChain([data]);
      db.insert.mockReturnValue(chain);

      const result = await createPost(db as never, data as never);

      expect(result).toEqual(data);
      expect(chain.values).toHaveBeenCalledWith(data);
    });

    it('returns null when insert returns empty', async () => {
      const chain = createInsertChain([]);
      db.insert.mockReturnValue(chain);

      const result = await createPost(db as never, {} as never);

      expect(result).toBeNull();
    });
  });

  // ---- updatePost ---------------------------------------------------------

  describe('updatePost', () => {
    it('updates and returns the post', async () => {
      const updated = { id: 'p1', title: 'Updated Title' };
      const chain = createUpdateChain([updated]);
      db.update.mockReturnValue(chain);

      const result = await updatePost(db as never, 'p1', { title: 'Updated Title' } as never);

      expect(result).toEqual(updated);
    });

    it('returns null when post does not exist', async () => {
      const chain = createUpdateChain([]);
      db.update.mockReturnValue(chain);

      const result = await updatePost(db as never, 'nonexistent', {} as never);

      expect(result).toBeNull();
    });

    it('sets updatedAt timestamp', async () => {
      const chain = createUpdateChain([{ id: 'p1' }]);
      db.update.mockReturnValue(chain);

      await updatePost(db as never, 'p1', { title: 'X' } as never);

      const setCall = chain.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(setCall?.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ---- deletePost ---------------------------------------------------------

  describe('deletePost', () => {
    it('soft-deletes a post by id', async () => {
      const chain = createSoftDeleteChain();
      db.update.mockReturnValue(chain);

      await deletePost(db as never, 'p1');

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
      chain.offset.mockRejectedValue(new Error('query timeout'));
      db.select.mockReturnValue(chain);

      await expect(getAllPosts(db as never)).rejects.toThrow('query timeout');
    });

    it('propagates insert errors', async () => {
      const chain = createInsertChain();
      chain.returning.mockRejectedValue(new Error('slug conflict'));
      db.insert.mockReturnValue(chain);

      await expect(createPost(db as never, {} as never)).rejects.toThrow('slug conflict');
    });

    it('propagates update errors', async () => {
      const chain = createUpdateChain();
      chain.returning.mockRejectedValue(new Error('deadlock detected'));
      db.update.mockReturnValue(chain);

      await expect(updatePost(db as never, 'p1', {} as never)).rejects.toThrow('deadlock detected');
    });

    it('propagates delete errors', async () => {
      const chain = createSoftDeleteChain();
      chain.where.mockRejectedValue(new Error('fk constraint'));
      db.update.mockReturnValue(chain);

      await expect(deletePost(db as never, 'p1')).rejects.toThrow('fk constraint');
    });
  });
});
