/**
 * Access Control Enforcement Tests
 *
 * Proves that collection-level access.read functions are evaluated and
 * their return values are respected by find() and findByID().
 *
 * This is the most critical test file in the admin core  -  it proves that
 * non-admin users cannot read data they shouldn't see.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealFindOptions,
  RevealRequest,
} from '../../../types/index.js';
import { deleteDocument } from '../delete.js';
import { find } from '../find.js';
import { findByID } from '../findById.js';
import { update } from '../update.js';

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

const testDocs = [
  { id: '1', title: 'Public Post', status: 'published' },
  { id: '2', title: 'Draft Post', status: 'draft' },
  { id: '3', title: 'Private Post', status: 'private' },
];

// ---------------------------------------------------------------------------
// Base config (no access rules)
// ---------------------------------------------------------------------------

const baseConfig: RevealCollectionConfig = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'status', type: 'text' },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('access control enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // find() tests
  // =========================================================================

  describe('find()', () => {
    it('returns all docs when no access rule is defined (backward compatible)', async () => {
      const db = createMockDbWithCollectionStorage(testDocs);

      const result = await find(baseConfig, db as never, {});

      expect(result.docs).toHaveLength(3);
      expect(result.totalDocs).toBe(3);
    });

    it('returns empty result set when access.read returns false', async () => {
      const accessReadSpy = vi.fn().mockReturnValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await find(config, db as never, { req });

      expect(result.docs).toEqual([]);
      expect(result.totalDocs).toBe(0);
      expect(accessReadSpy).toHaveBeenCalledTimes(1);
      expect(accessReadSpy).toHaveBeenCalledWith(expect.objectContaining({ req }));
      // Database should never be queried when access is denied
      expect(db.collectionStorage.find).not.toHaveBeenCalled();
    });

    it('returns all docs when access.read returns true', async () => {
      const accessReadSpy = vi.fn().mockReturnValue(true);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await find(config, db as never, { req });

      expect(result.docs).toHaveLength(3);
      expect(accessReadSpy).toHaveBeenCalledTimes(1);
      expect(db.collectionStorage.find).toHaveBeenCalled();
    });

    it('merges WhereClause into query when access.read returns an object', async () => {
      // access.read returns a Where clause that restricts to published posts
      const accessReadSpy = vi.fn().mockReturnValue({
        status: { equals: 'published' },
      });
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      await find(config, db as never, { req });

      // The collectionStorage.find should be called with merged where clause
      expect(db.collectionStorage.find).toHaveBeenCalledTimes(1);
      const callArgs = db.collectionStorage.find.mock.calls[0];
      const passedOptions = callArgs[1] as RevealFindOptions;

      // The where clause from access.read should be present
      expect(passedOptions.where).toEqual({
        status: { equals: 'published' },
      });
      // overrideAccess should be true on the recursive call to prevent infinite loop
      expect(passedOptions.overrideAccess).toBe(true);
    });

    it('merges WhereClause with existing where when both are present', async () => {
      const accessReadSpy = vi.fn().mockReturnValue({
        status: { equals: 'published' },
      });
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      await find(config, db as never, {
        req,
        where: { title: { equals: 'Public Post' } },
      });

      const passedOptions = db.collectionStorage.find.mock.calls[0][1] as RevealFindOptions;

      // Both the user's where and the access where should be merged with AND
      expect(passedOptions.where).toEqual({
        and: [{ title: { equals: 'Public Post' } }, { status: { equals: 'published' } }],
      });
    });

    it('skips access check when overrideAccess=true even when rule would deny', async () => {
      const accessReadSpy = vi.fn().mockReturnValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await find(config, db as never, { req, overrideAccess: true });

      expect(result.docs).toHaveLength(3);
      // access.read should NOT be called when overrideAccess is true
      expect(accessReadSpy).not.toHaveBeenCalled();
    });

    it('returns empty result (denied) when access.read exists but no req is provided', async () => {
      const accessReadSpy = vi.fn().mockReturnValue(true);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);

      // No req  -  should deny access
      const result = await find(config, db as never, {});

      expect(result.docs).toEqual([]);
      expect(result.totalDocs).toBe(0);
      // access.read should NOT be called  -  denied before evaluation
      expect(accessReadSpy).not.toHaveBeenCalled();
      expect(db.collectionStorage.find).not.toHaveBeenCalled();
    });

    it('handles async access.read functions', async () => {
      const accessReadSpy = vi.fn().mockResolvedValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await find(config, db as never, { req });

      expect(result.docs).toEqual([]);
      expect(accessReadSpy).toHaveBeenCalledTimes(1);
    });

    it('passes req to the access function for user-based decisions', async () => {
      const accessReadSpy = vi
        .fn()
        .mockImplementation(({ req: accessReq }: { req: RevealRequest }) => {
          // Only allow users with 'admin' role
          return accessReq.user?.roles?.includes('admin') ?? false;
        });
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);

      // Editor user  -  should be denied
      const editorReq = mockRequest({
        user: { id: 'u1', email: 'editor@test.com', roles: ['editor'] },
      });
      const editorResult = await find(config, db as never, { req: editorReq });
      expect(editorResult.docs).toEqual([]);

      // Admin user  -  should be allowed
      const adminReq = mockRequest({
        user: { id: 'u2', email: 'admin@test.com', roles: ['admin'] },
      });
      const adminResult = await find(config, db as never, { req: adminReq });
      expect(adminResult.docs).toHaveLength(3);
    });
  });

  // =========================================================================
  // findByID() tests
  // =========================================================================

  describe('findByID()', () => {
    it('returns the doc when no access rule is defined (backward compatible)', async () => {
      const db = createMockDbWithCollectionStorage(testDocs);

      const result = await findByID(baseConfig, db as never, { id: '1' });

      expect(result).toEqual({ id: '1', title: 'Public Post', status: 'published' });
    });

    it('returns null when access.read returns false', async () => {
      const accessReadSpy = vi.fn().mockReturnValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await findByID(config, db as never, { id: '1', req });

      expect(result).toBeNull();
      expect(accessReadSpy).toHaveBeenCalledTimes(1);
      expect(accessReadSpy).toHaveBeenCalledWith(expect.objectContaining({ req, id: '1' }));
      // Database should never be queried when access is denied
      expect(db.collectionStorage.findByID).not.toHaveBeenCalled();
    });

    it('returns the doc when access.read returns true', async () => {
      const accessReadSpy = vi.fn().mockReturnValue(true);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await findByID(config, db as never, { id: '1', req });

      expect(result).toEqual({ id: '1', title: 'Public Post', status: 'published' });
      expect(accessReadSpy).toHaveBeenCalledTimes(1);
    });

    it('skips access check when overrideAccess=true', async () => {
      const accessReadSpy = vi.fn().mockReturnValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await findByID(config, db as never, { id: '1', req, overrideAccess: true });

      expect(result).toEqual({ id: '1', title: 'Public Post', status: 'published' });
      // access.read should NOT be called when overrideAccess is true
      expect(accessReadSpy).not.toHaveBeenCalled();
    });

    it('returns null (denied) when access.read exists but no req is provided', async () => {
      const accessReadSpy = vi.fn().mockReturnValue(true);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);

      // No req  -  should deny access
      const result = await findByID(config, db as never, { id: '1' });

      expect(result).toBeNull();
      expect(accessReadSpy).not.toHaveBeenCalled();
      expect(db.collectionStorage.findByID).not.toHaveBeenCalled();
    });

    it('handles async access.read functions', async () => {
      const accessReadSpy = vi.fn().mockResolvedValue(true);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await findByID(config, db as never, { id: '1', req });

      expect(result).toEqual({ id: '1', title: 'Public Post', status: 'published' });
    });

    it('allows access when access.read returns a WhereClause (constraint-based)', async () => {
      // For findByID, a Where clause means "allowed with constraints"  -
      // the access function evaluated the user's permission for this specific ID
      const accessReadSpy = vi.fn().mockReturnValue({ author: { equals: 'user-1' } });
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await findByID(config, db as never, { id: '1', req });

      // Should proceed with the fetch since the access function returned a truthy value
      expect(result).toEqual({ id: '1', title: 'Public Post', status: 'published' });
      expect(accessReadSpy).toHaveBeenCalledWith(expect.objectContaining({ req, id: '1' }));
    });

    it('passes req to the access function for user-based decisions', async () => {
      const accessReadSpy = vi
        .fn()
        .mockImplementation(({ req: accessReq }: { req: RevealRequest }) => {
          return accessReq.user?.roles?.includes('admin') ?? false;
        });
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: accessReadSpy },
      };
      const db = createMockDbWithCollectionStorage(testDocs);

      // Editor user  -  should be denied
      const editorReq = mockRequest({
        user: { id: 'u1', email: 'editor@test.com', roles: ['editor'] },
      });
      const editorResult = await findByID(config, db as never, { id: '1', req: editorReq });
      expect(editorResult).toBeNull();

      // Admin user  -  should be allowed
      const adminReq = mockRequest({
        user: { id: 'u2', email: 'admin@test.com', roles: ['admin'] },
      });
      const adminResult = await findByID(config, db as never, { id: '1', req: adminReq });
      expect(adminResult).toEqual({ id: '1', title: 'Public Post', status: 'published' });
    });
  });

  // =========================================================================
  // Integration with auth/access helpers
  // =========================================================================

  describe('integration with access helpers', () => {
    it('anyone() allows all reads', async () => {
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: () => true },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await find(config, db as never, { req });
      expect(result.docs).toHaveLength(3);
    });

    it('authenticated() denies when no user on req', async () => {
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: ({ req: r }) => !!r.user },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest({ user: undefined });

      const result = await find(config, db as never, { req });
      expect(result.docs).toEqual([]);
    });

    it('authenticated() allows when user is present', async () => {
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { read: ({ req: r }) => !!r.user },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest();

      const result = await find(config, db as never, { req });
      expect(result.docs).toHaveLength(3);
    });

    it('isAdmin() denies non-admin users', async () => {
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: {
          read: ({ req: r }) => !!r.user?.roles?.includes('admin'),
        },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest({ user: { id: 'u1', email: 'editor@test.com', roles: ['editor'] } });

      const findResult = await find(config, db as never, { req });
      expect(findResult.docs).toEqual([]);

      const findByIdResult = await findByID(config, db as never, { id: '1', req });
      expect(findByIdResult).toBeNull();
    });

    it('isAdmin() allows admin users', async () => {
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: {
          read: ({ req: r }) => !!r.user?.roles?.includes('admin'),
        },
      };
      const db = createMockDbWithCollectionStorage(testDocs);
      const req = mockRequest({
        user: { id: 'admin-1', email: 'admin@test.com', roles: ['admin'] },
      });

      const findResult = await find(config, db as never, { req });
      expect(findResult.docs).toHaveLength(3);

      const findByIdResult = await findByID(config, db as never, { id: '1', req });
      expect(findByIdResult).toEqual({ id: '1', title: 'Public Post', status: 'published' });
    });
  });

  // =========================================================================
  // deleteDocument() tests
  // =========================================================================

  describe('deleteDocument()', () => {
    const mockDeleteDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 } as DatabaseResult),
    };

    it('allows delete when no access rule is defined (backward compatible)', async () => {
      const result = await deleteDocument(baseConfig, mockDeleteDb as never, { id: '1' });

      expect(result).toEqual({ id: '1' });
      expect(mockDeleteDb.query).toHaveBeenCalled();
    });

    it('throws when access.delete returns false', async () => {
      const accessDeleteSpy = vi.fn().mockReturnValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { delete: accessDeleteSpy },
      };
      const req = mockRequest();

      await expect(deleteDocument(config, mockDeleteDb as never, { id: '1', req })).rejects.toThrow(
        'Access denied: insufficient permissions to delete this document',
      );

      expect(accessDeleteSpy).toHaveBeenCalledTimes(1);
      expect(accessDeleteSpy).toHaveBeenCalledWith(expect.objectContaining({ req, id: '1' }));
      // Database should never be queried when access is denied
      expect(mockDeleteDb.query).not.toHaveBeenCalled();
    });

    it('allows delete when access.delete returns true', async () => {
      const accessDeleteSpy = vi.fn().mockReturnValue(true);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { delete: accessDeleteSpy },
      };
      const req = mockRequest();

      const result = await deleteDocument(config, mockDeleteDb as never, { id: '1', req });

      expect(result).toEqual({ id: '1' });
      expect(accessDeleteSpy).toHaveBeenCalledTimes(1);
      expect(mockDeleteDb.query).toHaveBeenCalled();
    });

    it('skips access check when overrideAccess=true even when rule would deny', async () => {
      const accessDeleteSpy = vi.fn().mockReturnValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { delete: accessDeleteSpy },
      };
      const req = mockRequest();

      const result = await deleteDocument(config, mockDeleteDb as never, {
        id: '1',
        req,
        overrideAccess: true,
      });

      expect(result).toEqual({ id: '1' });
      // access.delete should NOT be called when overrideAccess is true
      expect(accessDeleteSpy).not.toHaveBeenCalled();
    });

    it('throws (denied) when access.delete exists but no req is provided', async () => {
      const accessDeleteSpy = vi.fn().mockReturnValue(true);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { delete: accessDeleteSpy },
      };

      // No req  -  should deny access
      await expect(deleteDocument(config, mockDeleteDb as never, { id: '1' })).rejects.toThrow(
        'Access denied',
      );

      expect(accessDeleteSpy).not.toHaveBeenCalled();
      expect(mockDeleteDb.query).not.toHaveBeenCalled();
    });

    it('handles async access.delete functions', async () => {
      const accessDeleteSpy = vi.fn().mockResolvedValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { delete: accessDeleteSpy },
      };
      const req = mockRequest();

      await expect(deleteDocument(config, mockDeleteDb as never, { id: '1', req })).rejects.toThrow(
        'Access denied',
      );

      expect(accessDeleteSpy).toHaveBeenCalledTimes(1);
    });

    it('passes req to the access function for user-based decisions', async () => {
      const accessDeleteSpy = vi
        .fn()
        .mockImplementation(({ req: accessReq }: { req: RevealRequest }) => {
          return accessReq.user?.roles?.includes('admin') ?? false;
        });
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { delete: accessDeleteSpy },
      };

      // Editor user  -  should be denied
      const editorReq = mockRequest({
        user: { id: 'u1', email: 'editor@test.com', roles: ['editor'] },
      });
      await expect(
        deleteDocument(config, mockDeleteDb as never, { id: '1', req: editorReq }),
      ).rejects.toThrow('Access denied');

      // Admin user  -  should be allowed
      const adminReq = mockRequest({
        user: { id: 'u2', email: 'admin@test.com', roles: ['admin'] },
      });
      const result = await deleteDocument(config, mockDeleteDb as never, {
        id: '1',
        req: adminReq,
      });
      expect(result).toEqual({ id: '1' });
    });
  });

  // =========================================================================
  // update() tests  -  access control enforcement only
  // =========================================================================

  describe('update() access control', () => {
    it('throws when access.update returns false', async () => {
      const accessUpdateSpy = vi.fn().mockReturnValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { update: accessUpdateSpy },
      };
      const req = mockRequest();

      await expect(update(config, null, { id: '1', data: { title: 'New' }, req })).rejects.toThrow(
        'Access denied: insufficient permissions to update this document',
      );

      expect(accessUpdateSpy).toHaveBeenCalledTimes(1);
      expect(accessUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ req, id: '1', data: { title: 'New' } }),
      );
    });

    it('skips access check when overrideAccess=true even when rule would deny', async () => {
      const accessUpdateSpy = vi.fn().mockReturnValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { update: accessUpdateSpy },
      };
      const req = mockRequest();

      // With overrideAccess, the function should proceed past access control.
      // It may fail on DB operations (null db)  -  that's expected; the point is
      // it doesn't throw the access denied error.
      const result = await update(config, null, {
        id: '1',
        data: { title: 'New' },
        req,
        overrideAccess: true,
      });

      // With null db, update returns { ...data, id }
      expect(result).toEqual({ title: 'New', id: '1' });
      expect(accessUpdateSpy).not.toHaveBeenCalled();
    });

    it('throws (denied) when access.update exists but no req is provided', async () => {
      const accessUpdateSpy = vi.fn().mockReturnValue(true);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { update: accessUpdateSpy },
      };

      await expect(update(config, null, { id: '1', data: { title: 'New' } })).rejects.toThrow(
        'Access denied',
      );

      expect(accessUpdateSpy).not.toHaveBeenCalled();
    });

    it('allows update when no access rule is defined (backward compatible)', async () => {
      // No access rules = allow all. With null db, returns { ...data, id }.
      const result = await update(baseConfig, null, {
        id: '1',
        data: { title: 'New' },
      });

      expect(result).toEqual({ title: 'New', id: '1' });
    });

    it('handles async access.update functions', async () => {
      const accessUpdateSpy = vi.fn().mockResolvedValue(false);
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { update: accessUpdateSpy },
      };
      const req = mockRequest();

      await expect(update(config, null, { id: '1', data: { title: 'New' }, req })).rejects.toThrow(
        'Access denied',
      );

      expect(accessUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('passes req to the access function for user-based decisions', async () => {
      const accessUpdateSpy = vi
        .fn()
        .mockImplementation(({ req: accessReq }: { req: RevealRequest }) => {
          return accessReq.user?.roles?.includes('admin') ?? false;
        });
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { update: accessUpdateSpy },
      };

      // Editor user  -  should be denied
      const editorReq = mockRequest({
        user: { id: 'u1', email: 'editor@test.com', roles: ['editor'] },
      });
      await expect(
        update(config, null, { id: '1', data: { title: 'New' }, req: editorReq }),
      ).rejects.toThrow('Access denied');

      // Admin user  -  should be allowed (null db = returns { ...data, id })
      const adminReq = mockRequest({
        user: { id: 'u2', email: 'admin@test.com', roles: ['admin'] },
      });
      const result = await update(config, null, {
        id: '1',
        data: { title: 'New' },
        req: adminReq,
      });
      expect(result).toEqual({ title: 'New', id: '1' });
    });

    it('passes data to the access function for content-based decisions', async () => {
      const accessUpdateSpy = vi
        .fn()
        .mockImplementation(({ data }: { req: RevealRequest; data?: Record<string, unknown> }) => {
          // Deny changing status to 'published' for non-admins
          return data?.status !== 'published';
        });
      const config: RevealCollectionConfig = {
        ...baseConfig,
        access: { update: accessUpdateSpy },
      };
      const req = mockRequest({ user: { id: 'u1', email: 'editor@test.com', roles: ['editor'] } });

      // Publishing  -  denied by content-based rule
      await expect(
        update(config, null, { id: '1', data: { status: 'published' }, req }),
      ).rejects.toThrow('Access denied');

      // Drafting  -  allowed by content-based rule
      const result = await update(config, null, {
        id: '1',
        data: { status: 'draft' },
        req,
      });
      expect(result).toEqual({ status: 'draft', id: '1' });
    });
  });
});
