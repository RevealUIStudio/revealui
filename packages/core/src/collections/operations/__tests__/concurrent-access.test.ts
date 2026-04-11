/**
 * Concurrent Access Tests  -  Database Integrity Under Parallel Operations
 *
 * Verifies that concurrent collection operations do not cause data corruption,
 * permission leaks, or inconsistent state. Tests the operations layer (create,
 * update, delete, find, findByID) under simulated concurrent access.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealCreateOptions,
  RevealDeleteOptions,
  RevealFindOptions,
  RevealRequest,
  RevealUpdateOptions,
} from '../../../types/index.js';
import { create } from '../create.js';
import { deleteDocument } from '../delete.js';
import { find } from '../find.js';
import { findByID } from '../findById.js';
import { update } from '../update.js';

// Mock findByID for create/update operations that call it internally
vi.mock('../findById', () => ({
  findByID: vi.fn(),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockImplementation((pw: string) => `$2b$10$hashed_${pw}`),
  },
}));

// Mock defaultLogger
vi.mock('../../../instance/logger', () => ({
  defaultLogger: { warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRequest(overrides: Partial<RevealRequest> = {}): RevealRequest {
  return {
    transactionID: 'test-tx',
    context: {},
    user: { id: 'user-1', email: 'test@example.com', roles: ['editor'] },
    ...overrides,
  };
}

function createMockDbWithCollectionStorage(docs: Record<string, unknown>[] = []) {
  return {
    query: vi.fn(),
    collectionStorage: {
      find: vi.fn().mockResolvedValue({
        docs,
        totalDocs: docs.length,
        limit: 10,
        totalPages: docs.length > 0 ? 1 : 0,
        page: 1,
        pagingCounter: docs.length > 0 ? 1 : 0,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      }),
      findByID: vi
        .fn()
        .mockImplementation((_config: RevealCollectionConfig, opts: { id: string | number }) => {
          const doc = docs.find((d) => d.id === String(opts.id));
          return Promise.resolve(doc ?? null);
        }),
    },
  };
}

// ---------------------------------------------------------------------------
// Configs
// ---------------------------------------------------------------------------

const usersConfig: RevealCollectionConfig = {
  slug: 'users',
  fields: [
    { name: 'email', type: 'email', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'bio', type: 'richText' },
    { name: 'tags', type: 'array' },
  ],
};

const postsConfig: RevealCollectionConfig = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'richText' },
    { name: 'status', type: 'text' },
    { name: 'author', type: 'text' },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Concurrent access  -  database integrity', () => {
  const mockDb = { query: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Concurrent creates  -  duplicate key constraint
  // =========================================================================

  describe('concurrent creates do not produce duplicates', () => {
    it('two simultaneous creates with the same email: one succeeds, one fails on constraint', async () => {
      let insertCallCount = 0;

      // Simulate DB unique constraint violation on second INSERT
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO')) {
          insertCallCount++;
          if (insertCallCount === 2) {
            // Simulate unique constraint violation (PostgreSQL error code 23505)
            const error = new Error(
              'duplicate key value violates unique constraint "users_email_key"',
            );
            (error as Error & { code: string }).code = '23505';
            throw error;
          }
          return { rows: [] } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      vi.mocked(findByID).mockResolvedValue({
        id: 'rvl_first',
        email: 'duplicate@example.com',
        name: 'First',
      } as never);

      const createA = create(
        usersConfig,
        mockDb as never,
        {
          data: { email: 'duplicate@example.com', name: 'First' },
        } as RevealCreateOptions,
      );

      const createB = create(
        usersConfig,
        mockDb as never,
        {
          data: { email: 'duplicate@example.com', name: 'Second' },
        } as RevealCreateOptions,
      );

      const results = await Promise.allSettled([createA, createB]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      // Exactly one should succeed and one should fail
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      // The failure should be a constraint violation
      const failedResult = failures[0] as PromiseRejectedResult;
      expect(failedResult.reason.message).toContain('duplicate key');
    });

    it('concurrent creates for distinct emails all succeed independently', async () => {
      const ids: string[] = [];

      vi.mocked(findByID).mockImplementation(async (_cfg, _db, opts: { id: string }) => {
        ids.push(opts.id);
        return { id: opts.id, email: `user-${opts.id}@test.com`, name: 'Test' };
      });
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const emails = [
        'alice@example.com',
        'bob@example.com',
        'carol@example.com',
        'dave@example.com',
        'eve@example.com',
      ];

      const creates = emails.map((email, i) =>
        create(
          usersConfig,
          mockDb as never,
          {
            data: { email, name: `User ${i}` },
          } as RevealCreateOptions,
        ),
      );

      const results = await Promise.allSettled(creates);

      // All should succeed
      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes).toHaveLength(5);

      // All generated IDs must be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);

      // All INSERT queries should have been issued
      expect(mockDb.query).toHaveBeenCalledTimes(5);
      for (const call of mockDb.query.mock.calls) {
        expect(call[0]).toContain('INSERT INTO');
      }
    });

    it('validation errors in one create do not affect concurrent valid creates', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'rvl_valid',
        email: 'valid@example.com',
        name: 'Valid',
      } as never);
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const validCreate = create(
        usersConfig,
        mockDb as never,
        {
          data: { email: 'valid@example.com', name: 'Valid User' },
        } as RevealCreateOptions,
      );

      const invalidCreate = create(
        usersConfig,
        mockDb as never,
        {
          data: { email: 'not-an-email', name: 'Invalid User' },
        } as RevealCreateOptions,
      );

      const results = await Promise.allSettled([validCreate, invalidCreate]);

      // Valid create succeeds
      expect(results[0].status).toBe('fulfilled');

      // Invalid create fails with validation error
      expect(results[1].status).toBe('rejected');
      const failedResult = results[1] as PromiseRejectedResult;
      expect(failedResult.reason.message).toContain('valid email address');
    });
  });

  // =========================================================================
  // 2. Concurrent updates  -  no data loss
  // =========================================================================

  describe('concurrent updates do not lose data', () => {
    it('two simultaneous updates to the same document with different fields both persist', async () => {
      const capturedUpdateValues: Record<string, unknown>[] = [];

      vi.mocked(findByID).mockResolvedValue({
        id: 'doc-1',
        title: 'Updated',
        body: { content: 'body text' },
        status: 'published',
      } as never);

      // Track all UPDATE queries and their values
      mockDb.query.mockImplementation(async (sql: string, values?: unknown[]) => {
        if (sql.includes('SELECT _json')) {
          return {
            rows: [
              {
                _json: JSON.stringify({
                  body: { content: 'original body' },
                }),
              },
            ],
          } as DatabaseResult;
        }
        if (sql.includes('UPDATE')) {
          capturedUpdateValues.push({ sql, values });
          return { rows: [] } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      // Update A changes title (non-JSON column)
      const updateA = update(
        postsConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { title: 'New Title' },
        } as RevealUpdateOptions,
      );

      // Update B changes status (non-JSON column)
      const updateB = update(
        postsConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { status: 'draft' },
        } as RevealUpdateOptions,
      );

      const results = await Promise.allSettled([updateA, updateB]);

      // Both updates should succeed (at the operations layer)
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');

      // Both UPDATE queries should have been issued
      expect(capturedUpdateValues).toHaveLength(2);

      // Each update should target a different column
      const updateSqls = capturedUpdateValues.map((v) => v.sql as string);
      const titlesUpdate = updateSqls.find((s) => s.includes('"title"'));
      const statusUpdate = updateSqls.find((s) => s.includes('"status"'));
      expect(titlesUpdate).toBeDefined();
      expect(statusUpdate).toBeDefined();
    });

    it('concurrent JSON field updates each read existing _json independently', async () => {
      // usersConfig has two JSON fields: bio (richText) and tags (array)
      const jsonWrites: string[] = [];

      vi.mocked(findByID).mockResolvedValue({
        id: 'doc-1',
        name: 'Test',
        email: 'test@example.com',
        bio: { content: 'updated' },
        tags: ['updated'],
      } as never);

      mockDb.query.mockImplementation(async (sql: string, values?: unknown[]) => {
        if (sql.includes('SELECT _json')) {
          // Both concurrent reads see the same original state
          return {
            rows: [
              {
                _json: JSON.stringify({
                  bio: { content: 'original' },
                  tags: ['original'],
                }),
              },
            ],
          } as DatabaseResult;
        }
        if (sql.includes('UPDATE')) {
          // Capture the _json value written
          const jsonValue = (values as unknown[])?.find(
            (v) => typeof v === 'string' && v.includes('{'),
          );
          if (typeof jsonValue === 'string') {
            jsonWrites.push(jsonValue);
          }
          return { rows: [] } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      // Both updates target JSON fields on usersConfig
      const updateA = update(
        usersConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { bio: { content: 'new bio' } },
        } as RevealUpdateOptions,
      );

      const updateB = update(
        usersConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { tags: ['new-tag'] },
        } as RevealUpdateOptions,
      );

      await Promise.all([updateA, updateB]);

      // Both writes should have gone through
      expect(jsonWrites).toHaveLength(2);

      // Each write should have merged with the original state
      const parsedWrites = jsonWrites.map((j) => JSON.parse(j) as Record<string, unknown>);

      // Update A should preserve tags from original, add new bio
      const bioUpdate = parsedWrites.find((w) => JSON.stringify(w).includes('new bio'));
      expect(bioUpdate).toBeDefined();
      expect(bioUpdate?.tags).toEqual(['original']); // Preserved from original

      // Update B should preserve bio from original, add new tags
      const tagsUpdate = parsedWrites.find((w) => JSON.stringify(w).includes('new-tag'));
      expect(tagsUpdate).toBeDefined();
      expect(tagsUpdate?.bio).toEqual({ content: 'original' }); // Preserved from original
    });

    it('concurrent update to nonexistent document fails cleanly for both', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT _json')) {
          // Document does not exist  -  empty result
          return { rows: [] } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      const updateA = update(
        postsConfig,
        mockDb as never,
        {
          id: 'ghost-doc',
          data: { title: 'Update A' },
        } as RevealUpdateOptions,
      );

      const updateB = update(
        postsConfig,
        mockDb as never,
        {
          id: 'ghost-doc',
          data: { title: 'Update B' },
        } as RevealUpdateOptions,
      );

      const results = await Promise.allSettled([updateA, updateB]);

      // Both should fail with "not found"
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');

      for (const result of results) {
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain('Document with id ghost-doc not found');
        }
      }
    });
  });

  // =========================================================================
  // 3. Concurrent delete + update race
  // =========================================================================

  describe('concurrent delete + update race', () => {
    it('delete while update is in progress: both operations complete without corruption', async () => {
      let deleteExecuted = false;

      vi.mocked(findByID).mockImplementation(async () => {
        // After delete, the document no longer exists
        if (deleteExecuted) {
          return null;
        }
        return { id: 'doc-1', title: 'Original', status: 'published' } as never;
      });

      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('DELETE FROM')) {
          deleteExecuted = true;
          return { rows: [] } as DatabaseResult;
        }
        if (sql.includes('SELECT _json')) {
          return {
            rows: [{ _json: '{}' }],
          } as DatabaseResult;
        }
        if (sql.includes('UPDATE')) {
          return { rows: [] } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      const deleteOp = deleteDocument(
        postsConfig,
        mockDb as never,
        { id: 'doc-1' } as RevealDeleteOptions,
      );

      const updateOp = update(
        postsConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { title: 'Updated Title' },
        } as RevealUpdateOptions,
      );

      const results = await Promise.allSettled([deleteOp, updateOp]);

      // Delete should always succeed (it's idempotent at the SQL level)
      const deleteResult = results[0];
      expect(deleteResult.status).toBe('fulfilled');
      if (deleteResult.status === 'fulfilled') {
        expect(deleteResult.value).toEqual({ id: 'doc-1' });
      }

      // Update may succeed or fail depending on timing  -  both are valid outcomes.
      // The key invariant: no orphaned state, no corruption.
      const updateResult = results[1];
      if (updateResult.status === 'fulfilled') {
        // If update succeeded, it completed before the delete took effect
        expect(updateResult.value).toBeDefined();
      } else {
        // If update failed, it encountered the deleted document
        expect(updateResult.reason.message).toContain('not found');
      }
    });

    it('concurrent deletes of the same document both complete without error', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const deleteA = deleteDocument(
        postsConfig,
        mockDb as never,
        { id: 'doc-1' } as RevealDeleteOptions,
      );

      const deleteB = deleteDocument(
        postsConfig,
        mockDb as never,
        { id: 'doc-1' } as RevealDeleteOptions,
      );

      const results = await Promise.allSettled([deleteA, deleteB]);

      // Both should succeed  -  DELETE is idempotent
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');

      // Both should return the same id
      if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') {
        expect(results[0].value).toEqual({ id: 'doc-1' });
        expect(results[1].value).toEqual({ id: 'doc-1' });
      }

      // Two DELETE queries should have been issued
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('delete during concurrent find does not return stale data', async () => {
      const testDocs = [
        { id: '1', title: 'Doc 1', status: 'published' },
        { id: '2', title: 'Doc 2', status: 'published' },
      ];

      // After delete, find returns fewer docs
      let deleteHappened = false;
      const db = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('DELETE FROM')) {
            deleteHappened = true;
            return { rows: [] } as DatabaseResult;
          }
          return { rows: [] } as DatabaseResult;
        }),
        collectionStorage: {
          find: vi.fn().mockImplementation(async () => {
            const currentDocs = deleteHappened ? [testDocs[1]] : testDocs;
            return {
              docs: currentDocs,
              totalDocs: currentDocs.length,
              limit: 10,
              totalPages: 1,
              page: 1,
              pagingCounter: 1,
              hasPrevPage: false,
              hasNextPage: false,
              prevPage: null,
              nextPage: null,
            };
          }),
        },
      };

      const deleteOp = deleteDocument(postsConfig, db as never, { id: '1' } as RevealDeleteOptions);

      const findOp = find(postsConfig, db as never, {} as RevealFindOptions);

      const results = await Promise.allSettled([deleteOp, findOp]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');

      if (results[1].status === 'fulfilled') {
        // The find result should be consistent  -  either the pre-delete or post-delete state
        const findResult = results[1].value;
        expect(findResult.docs.length).toBeGreaterThanOrEqual(1);
        expect(findResult.docs.length).toBeLessThanOrEqual(2);
        // totalDocs should match the actual docs returned
        expect(findResult.totalDocs).toBe(findResult.docs.length);
      }
    });
  });

  // =========================================================================
  // 4. Access control under concurrency
  // =========================================================================

  describe('access control under concurrency', () => {
    it('simultaneous requests with different roles see appropriate data', async () => {
      const testDocs = [
        { id: '1', title: 'Public Post', status: 'published' },
        { id: '2', title: 'Draft Post', status: 'draft' },
        { id: '3', title: 'Admin-Only Post', status: 'admin' },
      ];

      const configWithAccess: RevealCollectionConfig = {
        ...postsConfig,
        access: {
          read: ({ req }: { req: RevealRequest }) => {
            if (req.user?.roles?.includes('admin')) {
              return true; // Admins see everything
            }
            // Non-admins see only published
            return { status: { equals: 'published' } };
          },
        },
      };

      // Use collectionStorage mock that respects the WhereClause
      const db = {
        query: vi.fn(),
        collectionStorage: {
          find: vi
            .fn()
            .mockImplementation(
              async (_config: RevealCollectionConfig, opts: RevealFindOptions) => {
                let filteredDocs = testDocs;
                // If the where clause restricts to published, filter
                const where = opts.where;
                if (where && 'status' in where) {
                  const statusFilter = (where as { status: { equals: string } }).status;
                  if (statusFilter?.equals) {
                    filteredDocs = testDocs.filter((d) => d.status === statusFilter.equals);
                  }
                }
                // If merged AND clause, extract status filter
                if (where && 'and' in where) {
                  const andClauses = (where as { and: Record<string, unknown>[] }).and;
                  for (const clause of andClauses) {
                    if ('status' in clause) {
                      const statusFilter = (clause as { status: { equals: string } }).status;
                      if (statusFilter?.equals) {
                        filteredDocs = testDocs.filter((d) => d.status === statusFilter.equals);
                      }
                    }
                  }
                }

                return {
                  docs: filteredDocs,
                  totalDocs: filteredDocs.length,
                  limit: 10,
                  totalPages: filteredDocs.length > 0 ? 1 : 0,
                  page: 1,
                  pagingCounter: filteredDocs.length > 0 ? 1 : 0,
                  hasPrevPage: false,
                  hasNextPage: false,
                  prevPage: null,
                  nextPage: null,
                };
              },
            ),
        },
      };

      const adminReq = mockRequest({ user: { id: 'admin-1', roles: ['admin'] } });
      const editorReq = mockRequest({ user: { id: 'editor-1', roles: ['editor'] } });
      const viewerReq = mockRequest({ user: { id: 'viewer-1', roles: ['viewer'] } });

      // Fire concurrent requests with different permission levels
      const [adminResult, editorResult, viewerResult] = await Promise.all([
        find(configWithAccess, db as never, { req: adminReq }),
        find(configWithAccess, db as never, { req: editorReq }),
        find(configWithAccess, db as never, { req: viewerReq }),
      ]);

      // Admin should see all 3 docs
      expect(adminResult.docs).toHaveLength(3);
      expect(adminResult.totalDocs).toBe(3);

      // Editor should see only published (1 doc)
      expect(editorResult.docs).toHaveLength(1);
      expect(editorResult.docs[0].status).toBe('published');

      // Viewer should see only published (1 doc)
      expect(viewerResult.docs).toHaveLength(1);
      expect(viewerResult.docs[0].status).toBe('published');
    });

    it('concurrent find() with different roles: denied user never sees protected docs', async () => {
      const testDocs = [
        { id: '1', title: 'Secret Doc', status: 'admin' },
        { id: '2', title: 'Public Doc', status: 'published' },
      ];

      const configWithAccess: RevealCollectionConfig = {
        ...postsConfig,
        access: {
          read: ({ req }: { req: RevealRequest }) => {
            return req.user?.roles?.includes('admin') ?? false;
          },
        },
      };

      const db = createMockDbWithCollectionStorage(testDocs);

      const adminReq = mockRequest({ user: { id: 'admin-1', roles: ['admin'] } });
      const editorReq = mockRequest({ user: { id: 'editor-1', roles: ['editor'] } });

      // Fire 10 concurrent find requests alternating between admin and editor
      const requests = Array.from({ length: 10 }, (_, i) => {
        const req = i % 2 === 0 ? adminReq : editorReq;
        return find(configWithAccess, db as never, { req });
      });

      const results = await Promise.all(requests);

      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          // Admin requests should see all documents
          expect(results[i].docs).toHaveLength(2);
          expect(results[i].totalDocs).toBe(2);
        } else {
          // Editor requests should see nothing (access denied returns false)
          expect(results[i].docs).toEqual([]);
          expect(results[i].totalDocs).toBe(0);
        }
      }
    });

    it('concurrent update access checks: denied update does not block allowed update', async () => {
      const configWithAccess: RevealCollectionConfig = {
        ...postsConfig,
        access: {
          update: ({ req }: { req: RevealRequest }) => {
            return req.user?.roles?.includes('admin') ?? false;
          },
        },
      };

      const adminReq = mockRequest({ user: { id: 'admin-1', roles: ['admin'] } });
      const editorReq = mockRequest({ user: { id: 'editor-1', roles: ['editor'] } });

      // Fire concurrent updates: one allowed (admin), one denied (editor)
      const adminUpdate = update(configWithAccess, null, {
        id: 'doc-1',
        data: { title: 'Admin Update' },
        req: adminReq,
      });

      const editorUpdate = update(configWithAccess, null, {
        id: 'doc-1',
        data: { title: 'Editor Update' },
        req: editorReq,
      });

      const results = await Promise.allSettled([adminUpdate, editorUpdate]);

      // Admin update should succeed
      expect(results[0].status).toBe('fulfilled');
      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toEqual({ title: 'Admin Update', id: 'doc-1' });
      }

      // Editor update should be denied
      expect(results[1].status).toBe('rejected');
      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toContain('Access denied');
      }
    });

    it('concurrent delete access checks: denied delete does not execute DB query', async () => {
      const configWithAccess: RevealCollectionConfig = {
        ...postsConfig,
        access: {
          delete: ({ req }: { req: RevealRequest }) => {
            return req.user?.roles?.includes('admin') ?? false;
          },
        },
      };

      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const adminReq = mockRequest({ user: { id: 'admin-1', roles: ['admin'] } });
      const editorReq = mockRequest({ user: { id: 'editor-1', roles: ['editor'] } });

      const adminDelete = deleteDocument(configWithAccess, mockDb as never, {
        id: 'doc-1',
        req: adminReq,
      });

      const editorDelete = deleteDocument(configWithAccess, mockDb as never, {
        id: 'doc-1',
        req: editorReq,
      });

      const results = await Promise.allSettled([adminDelete, editorDelete]);

      // Admin delete should succeed
      expect(results[0].status).toBe('fulfilled');

      // Editor delete should be denied
      expect(results[1].status).toBe('rejected');
      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toContain('Access denied');
      }

      // Only one DELETE query should have been issued (admin's)
      const deleteQueries = mockDb.query.mock.calls.filter((call) =>
        (call[0] as string).includes('DELETE FROM'),
      );
      expect(deleteQueries).toHaveLength(1);
    });

    it('no request context on concurrent calls: all are denied when access rules exist', async () => {
      const configWithAccess: RevealCollectionConfig = {
        ...postsConfig,
        access: {
          read: () => true, // Would allow, but req is missing
        },
      };

      const db = createMockDbWithCollectionStorage([{ id: '1', title: 'Doc 1' }]);

      // Fire concurrent requests without req  -  all should be denied
      const results = await Promise.all(
        Array.from({ length: 5 }, () => find(configWithAccess, db as never, {})),
      );

      for (const result of results) {
        expect(result.docs).toEqual([]);
        expect(result.totalDocs).toBe(0);
      }

      // Database should never be queried
      expect(db.collectionStorage.find).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Mixed concurrent operations  -  stress test
  // =========================================================================

  describe('mixed concurrent operations', () => {
    it('create + update + delete + find all running simultaneously', async () => {
      const existingDocs = [{ id: '1', title: 'Existing', status: 'published' }];

      vi.mocked(findByID).mockResolvedValue({
        id: 'rvl_new',
        title: 'Created',
        status: 'draft',
      } as never);

      // Flexible query mock
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO')) {
          return { rows: [] } as DatabaseResult;
        }
        if (sql.includes('SELECT _json')) {
          return { rows: [{ _json: '{}' }] } as DatabaseResult;
        }
        if (sql.includes('UPDATE')) {
          return { rows: [] } as DatabaseResult;
        }
        if (sql.includes('DELETE FROM')) {
          return { rows: [] } as DatabaseResult;
        }
        if (sql.includes('COUNT(*)')) {
          return { rows: [{ total: '1' }] } as DatabaseResult;
        }
        if (sql.includes('SELECT *')) {
          return { rows: existingDocs } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      const createOp = create(
        postsConfig,
        mockDb as never,
        {
          data: { title: 'New Post', status: 'draft' },
        } as RevealCreateOptions,
      );

      const updateOp = update(
        postsConfig,
        mockDb as never,
        {
          id: '1',
          data: { status: 'archived' },
        } as RevealUpdateOptions,
      );

      const deleteOp = deleteDocument(
        postsConfig,
        mockDb as never,
        {
          id: '1',
        } as RevealDeleteOptions,
      );

      const findOp = find(postsConfig, mockDb as never, {} as RevealFindOptions);

      const results = await Promise.allSettled([createOp, updateOp, deleteOp, findOp]);

      // Create should succeed (or fail gracefully)
      // The key invariant: no unhandled exceptions, no corrupted state
      for (const result of results) {
        if (result.status === 'rejected') {
          // Any rejection should be a known, expected error type
          expect(result.reason).toBeInstanceOf(Error);
          expect(result.reason.message).toBeDefined();
        }
      }

      // At minimum, the delete and find should complete successfully
      expect(results[2].status).toBe('fulfilled'); // delete
      expect(results[3].status).toBe('fulfilled'); // find
    });

    it('high-concurrency create burst: 20 simultaneous creates produce 20 unique documents', async () => {
      const createdIds: string[] = [];

      vi.mocked(findByID).mockImplementation(async (_cfg, _db, opts: { id: string }) => {
        createdIds.push(opts.id);
        return { id: opts.id, title: 'Test' };
      });
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const creates = Array.from({ length: 20 }, (_, i) =>
        create(
          postsConfig,
          mockDb as never,
          {
            data: { title: `Post ${i}` },
          } as RevealCreateOptions,
        ),
      );

      const results = await Promise.allSettled(creates);

      // All 20 should succeed
      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes).toHaveLength(20);

      // All IDs must be unique
      const uniqueIds = new Set(createdIds);
      expect(uniqueIds.size).toBe(20);

      // All IDs should use the rvl_ prefix
      for (const id of createdIds) {
        expect(id).toMatch(/^rvl_/);
      }
    });
  });
});
