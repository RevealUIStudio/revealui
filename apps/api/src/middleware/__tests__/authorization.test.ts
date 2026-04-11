/**
 * Authorization Middleware Tests
 *
 * Tests for requirePermission, requireAccess, and invalidateUserPermissions
 * Hono middleware that bridges @revealui/core's RBAC/ABAC with the API layer.
 */

import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @revealui/core/security before importing the module under test.
// Use class syntax inside vi.mock factories -- Biome converts function() to
// arrow functions which breaks `new`.
const mockHasPermission = vi.fn<(roles: string[], resource: string, action: string) => boolean>();
const mockCheckAccess =
  vi.fn<
    (ctx: unknown, resource: string, action: string) => { allowed: boolean; reason?: string }
  >();
const mockRegisterRole = vi.fn();

const mockCacheGet =
  vi.fn<(userId: string, resource: string, action: string) => boolean | undefined>();
const mockCacheSet = vi.fn();
const mockCacheClearUser = vi.fn();

vi.mock('@revealui/core/security', () => {
  return {
    AuthorizationSystem: class MockAuthorizationSystem {
      registerRole = mockRegisterRole;
      hasPermission = mockHasPermission;
      checkAccess = mockCheckAccess;
    },
    PermissionCache: class MockPermissionCache {
      get = mockCacheGet;
      set = mockCacheSet;
      clearUser = mockCacheClearUser;
    },
    CommonRoles: {
      admin: {
        id: 'admin',
        name: 'Administrator',
        permissions: [{ resource: '*', action: '*' }],
      },
      viewer: {
        id: 'viewer',
        name: 'Viewer',
        permissions: [{ resource: 'content', action: 'read' }],
      },
    },
  };
});

// Import after mocking
const { requirePermission, requireAccess, invalidateUserPermissions, authorizationSystem } =
  await import('../authorization.js');

// ---------------------------------------------------------------------------
// Helpers  -  mock Hono context
// ---------------------------------------------------------------------------

interface MockUser {
  id: string;
  role: string;
}

interface CreateMockContextOptions {
  user?: MockUser;
  headers?: Record<string, string>;
}

function createMockContext(options: CreateMockContextOptions = {}) {
  const { user, headers = {} } = options;

  const store = new Map<string, unknown>();
  if (user) {
    store.set('user', user);
  }

  return {
    get: vi.fn((key: string) => store.get(key)),
    set: vi.fn((key: string, value: unknown) => store.set(key, value)),
    req: {
      header: vi.fn((name: string) => headers[name.toLowerCase()]),
    },
  };
}

function createMockNext() {
  return vi.fn(async () => {
    // Middleware next() callback
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Authorization Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: cache returns undefined (miss)
    mockCacheGet.mockReturnValue(undefined);
  });

  // -------------------------------------------------------------------------
  // requirePermission
  // -------------------------------------------------------------------------

  describe('requirePermission', () => {
    it('throws 401 when no user is in context', async () => {
      const middleware = requirePermission('content', 'read');
      const c = createMockContext();
      const next = createMockNext();

      await expect(middleware(c as never, next)).rejects.toThrow(HTTPException);

      try {
        await middleware(c as never, next);
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(401);
      }

      expect(next).not.toHaveBeenCalled();
    });

    it('throws 403 when user lacks permission (fresh evaluation)', async () => {
      mockHasPermission.mockReturnValue(false);

      const middleware = requirePermission('admin', 'delete');
      const c = createMockContext({ user: { id: 'user-1', role: 'viewer' } });
      const next = createMockNext();

      await expect(middleware(c as never, next)).rejects.toThrow(HTTPException);

      try {
        await middleware(c as never, next);
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(403);
        expect((error as HTTPException).message).toContain('admin:delete');
      }

      expect(next).not.toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalledWith('user-1', 'admin', 'delete', false);
    });

    it('calls next() when user has permission (fresh evaluation)', async () => {
      mockHasPermission.mockReturnValue(true);

      const middleware = requirePermission('content', 'read');
      const c = createMockContext({ user: { id: 'user-1', role: 'editor' } });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(next).toHaveBeenCalledOnce();
      expect(mockHasPermission).toHaveBeenCalledWith(['editor'], 'content', 'read');
      expect(mockCacheSet).toHaveBeenCalledWith('user-1', 'content', 'read', true);
    });

    it('uses cached true result without calling hasPermission', async () => {
      mockCacheGet.mockReturnValue(true);

      const middleware = requirePermission('content', 'read');
      const c = createMockContext({ user: { id: 'user-1', role: 'editor' } });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(next).toHaveBeenCalledOnce();
      expect(mockHasPermission).not.toHaveBeenCalled();
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it('uses cached false result without calling hasPermission', async () => {
      mockCacheGet.mockReturnValue(false);

      const middleware = requirePermission('admin', 'delete');
      const c = createMockContext({ user: { id: 'user-1', role: 'viewer' } });
      const next = createMockNext();

      await expect(middleware(c as never, next)).rejects.toThrow(HTTPException);

      expect(mockHasPermission).not.toHaveBeenCalled();
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it('evaluates via AuthorizationSystem on cache miss', async () => {
      mockCacheGet.mockReturnValue(undefined);
      mockHasPermission.mockReturnValue(true);

      const middleware = requirePermission('content', 'create');
      const c = createMockContext({ user: { id: 'user-2', role: 'admin' } });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(mockCacheGet).toHaveBeenCalledWith('user-2', 'content', 'create');
      expect(mockHasPermission).toHaveBeenCalledWith(['admin'], 'content', 'create');
      expect(mockCacheSet).toHaveBeenCalledWith('user-2', 'content', 'create', true);
    });

    it('stores denied result in cache after evaluation', async () => {
      mockCacheGet.mockReturnValue(undefined);
      mockHasPermission.mockReturnValue(false);

      const middleware = requirePermission('settings', 'update');
      const c = createMockContext({ user: { id: 'user-3', role: 'viewer' } });
      const next = createMockNext();

      try {
        await middleware(c as never, next);
      } catch {
        // Expected 403
      }

      expect(mockCacheSet).toHaveBeenCalledWith('user-3', 'settings', 'update', false);
    });

    it('returns the correct MiddlewareHandler type (callable)', () => {
      const middleware = requirePermission('content', 'read');
      expect(typeof middleware).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // requireAccess (ABAC)
  // -------------------------------------------------------------------------

  describe('requireAccess', () => {
    it('throws 401 when no user is in context', async () => {
      const middleware = requireAccess('content', 'read');
      const c = createMockContext();
      const next = createMockNext();

      await expect(middleware(c as never, next)).rejects.toThrow(HTTPException);

      try {
        await middleware(c as never, next);
      } catch (error) {
        expect((error as HTTPException).status).toBe(401);
      }
    });

    it('calls next() when checkAccess returns allowed', async () => {
      mockCheckAccess.mockReturnValue({ allowed: true });

      const middleware = requireAccess('content', 'read');
      const c = createMockContext({ user: { id: 'user-1', role: 'editor' } });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('throws 403 when checkAccess returns denied', async () => {
      mockCheckAccess.mockReturnValue({
        allowed: false,
        reason: 'Denied by policy: IP restriction',
      });

      const middleware = requireAccess('admin', 'delete');
      const c = createMockContext({ user: { id: 'user-1', role: 'viewer' } });
      const next = createMockNext();

      await expect(middleware(c as never, next)).rejects.toThrow(HTTPException);

      try {
        await middleware(c as never, next);
      } catch (error) {
        expect((error as HTTPException).status).toBe(403);
        expect((error as HTTPException).message).toContain('Denied by policy: IP restriction');
      }
    });

    it('uses default denial message when no reason is provided', async () => {
      mockCheckAccess.mockReturnValue({ allowed: false });

      const middleware = requireAccess('admin', 'delete');
      const c = createMockContext({ user: { id: 'user-1', role: 'viewer' } });
      const next = createMockNext();

      try {
        await middleware(c as never, next);
      } catch (error) {
        expect((error as HTTPException).message).toContain('Access denied: admin:delete');
      }
    });

    it('builds AuthorizationContext with IP from x-forwarded-for header', async () => {
      mockCheckAccess.mockReturnValue({ allowed: true });

      const middleware = requireAccess('content', 'read');
      const c = createMockContext({
        user: { id: 'user-1', role: 'editor' },
        headers: {
          'x-forwarded-for': '203.0.113.50, 70.41.3.18',
          'user-agent': 'Mozilla/5.0 TestBrowser',
        },
      });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(mockCheckAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1', roles: ['editor'] },
          resource: { type: 'content' },
          environment: {
            ip: '203.0.113.50',
            userAgent: 'Mozilla/5.0 TestBrowser',
          },
        }),
        'content',
        'read',
      );
    });

    it('handles missing headers gracefully', async () => {
      mockCheckAccess.mockReturnValue({ allowed: true });

      const middleware = requireAccess('content', 'read');
      const c = createMockContext({
        user: { id: 'user-1', role: 'editor' },
        headers: {},
      });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(mockCheckAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: {
            ip: undefined,
            userAgent: undefined,
          },
        }),
        'content',
        'read',
      );
    });

    it('passes resource attributes from getResourceAttrs callback', async () => {
      mockCheckAccess.mockReturnValue({ allowed: true });

      const getResourceAttrs = vi.fn(() => ({
        id: 'post-42',
        owner: 'user-99',
        attributes: { status: 'draft' },
      }));

      const middleware = requireAccess('content', 'update', getResourceAttrs);
      const c = createMockContext({
        user: { id: 'user-1', role: 'editor' },
      });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(getResourceAttrs).toHaveBeenCalledWith(c);
      expect(mockCheckAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: {
            type: 'content',
            id: 'post-42',
            owner: 'user-99',
            attributes: { status: 'draft' },
          },
        }),
        'content',
        'update',
      );
    });

    it('works without getResourceAttrs callback', async () => {
      mockCheckAccess.mockReturnValue({ allowed: true });

      const middleware = requireAccess('content', 'read');
      const c = createMockContext({
        user: { id: 'user-1', role: 'editor' },
      });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(mockCheckAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: { type: 'content' },
        }),
        'content',
        'read',
      );
    });

    it('extracts first IP from comma-separated x-forwarded-for', async () => {
      mockCheckAccess.mockReturnValue({ allowed: true });

      const middleware = requireAccess('content', 'read');
      const c = createMockContext({
        user: { id: 'user-1', role: 'editor' },
        headers: {
          'x-forwarded-for': '  10.0.0.1 , 10.0.0.2 , 10.0.0.3 ',
        },
      });
      const next = createMockNext();

      await middleware(c as never, next);

      expect(mockCheckAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: expect.objectContaining({
            ip: '10.0.0.1',
          }),
        }),
        'content',
        'read',
      );
    });
  });

  // -------------------------------------------------------------------------
  // invalidateUserPermissions
  // -------------------------------------------------------------------------

  describe('invalidateUserPermissions', () => {
    it('clears cache for the specified user', () => {
      invalidateUserPermissions('user-42');

      expect(mockCacheClearUser).toHaveBeenCalledWith('user-42');
      expect(mockCacheClearUser).toHaveBeenCalledOnce();
    });

    it('does not affect other users', () => {
      invalidateUserPermissions('user-1');
      invalidateUserPermissions('user-2');

      expect(mockCacheClearUser).toHaveBeenCalledTimes(2);
      expect(mockCacheClearUser).toHaveBeenCalledWith('user-1');
      expect(mockCacheClearUser).toHaveBeenCalledWith('user-2');
    });
  });

  // -------------------------------------------------------------------------
  // authorizationSystem (shared instance)
  // -------------------------------------------------------------------------

  describe('authorizationSystem', () => {
    it('is exported and has registerRole method', () => {
      expect(authorizationSystem).toBeDefined();
      expect(typeof authorizationSystem.registerRole).toBe('function');
    });

    it('exposes registerRole method for policy registration', () => {
      // CommonRoles are registered at module import time via top-level for loop
      expect(typeof authorizationSystem.registerRole).toBe('function');
      expect(typeof authorizationSystem.hasPermission).toBe('function');
      expect(typeof authorizationSystem.checkAccess).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // Cache interaction flow (integration-style)
  // -------------------------------------------------------------------------

  describe('cache interaction flow', () => {
    it('first call evaluates and caches, second call uses cache', async () => {
      // First call: cache miss, evaluation grants permission
      mockCacheGet.mockReturnValueOnce(undefined);
      mockHasPermission.mockReturnValueOnce(true);

      const middleware = requirePermission('content', 'read');
      const user = { id: 'user-flow', role: 'editor' };

      const c1 = createMockContext({ user });
      const next1 = createMockNext();
      await middleware(c1 as never, next1);

      expect(mockHasPermission).toHaveBeenCalledOnce();
      expect(mockCacheSet).toHaveBeenCalledOnce();
      expect(next1).toHaveBeenCalledOnce();

      // Second call: cache hit
      mockCacheGet.mockReturnValueOnce(true);

      const c2 = createMockContext({ user });
      const next2 = createMockNext();
      await middleware(c2 as never, next2);

      // hasPermission should NOT be called again
      expect(mockHasPermission).toHaveBeenCalledOnce();
      expect(next2).toHaveBeenCalledOnce();
    });

    it('invalidation forces re-evaluation on next call', async () => {
      // First call: cache miss, evaluate
      mockCacheGet.mockReturnValueOnce(undefined);
      mockHasPermission.mockReturnValueOnce(true);

      const middleware = requirePermission('content', 'read');
      const user = { id: 'user-inv', role: 'editor' };

      const c1 = createMockContext({ user });
      await middleware(c1 as never, createMockNext());

      expect(mockHasPermission).toHaveBeenCalledOnce();

      // Invalidate
      invalidateUserPermissions('user-inv');
      expect(mockCacheClearUser).toHaveBeenCalledWith('user-inv');

      // Next call: cache miss again (cleared), must re-evaluate
      mockCacheGet.mockReturnValueOnce(undefined);
      mockHasPermission.mockReturnValueOnce(false);

      const c2 = createMockContext({ user });
      const next2 = createMockNext();

      await expect(middleware(c2 as never, next2)).rejects.toThrow(HTTPException);

      expect(mockHasPermission).toHaveBeenCalledTimes(2);
    });
  });
});
