/**
 * Comprehensive tests for the authorization system
 *
 * Covers: AuthorizationSystem, PermissionCache, decorators,
 * middleware, builders, helpers, glob matching, condition evaluation,
 * CommonRoles, and resource ownership.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext, Role } from '../authorization.js';
import {
  AuthorizationSystem,
  authorization,
  CommonRoles,
  canAccessResource,
  checkAttributeAccess,
  createAuthorizationMiddleware,
  PermissionBuilder,
  PermissionCache,
  PolicyBuilder,
  RequirePermission,
  RequireRole,
} from '../authorization.js';

/* ------------------------------------------------------------------ */
/*  AuthorizationSystem -- RBAC                                        */
/* ------------------------------------------------------------------ */

describe('AuthorizationSystem', () => {
  let auth: AuthorizationSystem;

  beforeEach(() => {
    auth = new AuthorizationSystem();
  });

  describe('registerRole / getRole', () => {
    it('registers and retrieves a role', () => {
      const role: Role = {
        id: 'editor',
        name: 'Editor',
        permissions: [{ resource: 'posts', action: 'read' }],
      };
      auth.registerRole(role);
      expect(auth.getRole('editor')).toBe(role);
    });

    it('returns undefined for unknown role', () => {
      expect(auth.getRole('nonexistent')).toBeUndefined();
    });

    it('overwrites a role with the same id', () => {
      auth.registerRole({ id: 'e', name: 'V1', permissions: [] });
      auth.registerRole({ id: 'e', name: 'V2', permissions: [{ resource: 'x', action: 'y' }] });
      expect(auth.getRole('e')?.name).toBe('V2');
    });
  });

  describe('hasPermission', () => {
    beforeEach(() => {
      auth.registerRole({
        id: 'viewer',
        name: 'Viewer',
        permissions: [
          { resource: 'posts', action: 'read' },
          { resource: 'comments', action: 'read' },
        ],
      });
      auth.registerRole({
        id: 'editor',
        name: 'Editor',
        permissions: [
          { resource: 'posts', action: 'create' },
          { resource: 'posts', action: 'update' },
        ],
        inherits: ['viewer'],
      });
      auth.registerRole({
        id: 'admin',
        name: 'Admin',
        permissions: [{ resource: '*', action: '*' }],
      });
    });

    it('grants exact match permission', () => {
      expect(auth.hasPermission(['viewer'], 'posts', 'read')).toBe(true);
    });

    it('denies missing permission', () => {
      expect(auth.hasPermission(['viewer'], 'posts', 'delete')).toBe(false);
    });

    it('denies unknown resource', () => {
      expect(auth.hasPermission(['viewer'], 'users', 'read')).toBe(false);
    });

    it('returns false for empty roles', () => {
      expect(auth.hasPermission([], 'posts', 'read')).toBe(false);
    });

    it('returns false for unknown role', () => {
      expect(auth.hasPermission(['ghost'], 'posts', 'read')).toBe(false);
    });

    it('grants via wildcard (*) resource and action', () => {
      expect(auth.hasPermission(['admin'], 'anything', 'everything')).toBe(true);
    });

    it('unions permissions from multiple roles', () => {
      expect(auth.hasPermission(['viewer', 'editor'], 'posts', 'read')).toBe(true);
      expect(auth.hasPermission(['viewer', 'editor'], 'posts', 'create')).toBe(true);
    });
  });

  describe('glob matching - resource patterns', () => {
    it('matches content.* to content.posts', () => {
      auth.registerRole({
        id: 'r',
        name: 'R',
        permissions: [{ resource: 'content.*', action: 'read' }],
      });
      expect(auth.hasPermission(['r'], 'content.posts', 'read')).toBe(true);
      expect(auth.hasPermission(['r'], 'content.pages', 'read')).toBe(true);
      expect(auth.hasPermission(['r'], 'users', 'read')).toBe(false);
    });

    it('matches ? single-character wildcard', () => {
      auth.registerRole({
        id: 'r',
        name: 'R',
        permissions: [{ resource: 'item?', action: 'read' }],
      });
      expect(auth.hasPermission(['r'], 'itemA', 'read')).toBe(true);
      expect(auth.hasPermission(['r'], 'items', 'read')).toBe(true);
      expect(auth.hasPermission(['r'], 'item', 'read')).toBe(false);
      expect(auth.hasPermission(['r'], 'itemAB', 'read')).toBe(false);
    });
  });

  describe('glob matching - action patterns', () => {
    it('matches read:* action', () => {
      auth.registerRole({
        id: 'r',
        name: 'R',
        permissions: [{ resource: 'logs', action: 'read:*' }],
      });
      expect(auth.hasPermission(['r'], 'logs', 'read:all')).toBe(true);
      expect(auth.hasPermission(['r'], 'logs', 'read:own')).toBe(true);
      expect(auth.hasPermission(['r'], 'logs', 'delete')).toBe(false);
    });
  });

  describe('role inheritance', () => {
    beforeEach(() => {
      auth.registerRole({
        id: 'base',
        name: 'Base',
        permissions: [{ resource: 'public', action: 'read' }],
      });
      auth.registerRole({
        id: 'mid',
        name: 'Mid',
        permissions: [{ resource: 'content', action: 'write' }],
        inherits: ['base'],
      });
      auth.registerRole({
        id: 'top',
        name: 'Top',
        permissions: [{ resource: 'users', action: 'manage' }],
        inherits: ['mid'],
      });
    });

    it('inherits from parent', () => {
      expect(auth.hasPermission(['mid'], 'public', 'read')).toBe(true);
    });

    it('inherits transitively (grandparent)', () => {
      expect(auth.hasPermission(['top'], 'public', 'read')).toBe(true);
      expect(auth.hasPermission(['top'], 'content', 'write')).toBe(true);
    });

    it('handles circular inheritance without infinite loop', () => {
      auth.registerRole({
        id: 'a',
        name: 'A',
        permissions: [{ resource: 'x', action: 'y' }],
        inherits: ['b'],
      });
      auth.registerRole({
        id: 'b',
        name: 'B',
        permissions: [{ resource: 'p', action: 'q' }],
        inherits: ['a'],
      });
      expect(auth.hasPermission(['a'], 'x', 'y')).toBe(true);
      expect(auth.hasPermission(['a'], 'p', 'q')).toBe(true);
    });

    it('handles self-referencing inheritance', () => {
      auth.registerRole({
        id: 'self',
        name: 'Self',
        permissions: [{ resource: 'x', action: 'y' }],
        inherits: ['self'],
      });
      expect(auth.hasPermission(['self'], 'x', 'y')).toBe(true);
    });

    it('handles inheritance from nonexistent role', () => {
      auth.registerRole({
        id: 'orphan',
        name: 'Orphan',
        permissions: [{ resource: 'a', action: 'b' }],
        inherits: ['does-not-exist'],
      });
      expect(auth.hasPermission(['orphan'], 'a', 'b')).toBe(true);
    });
  });

  describe('checkAccess - ABAC', () => {
    it('allows if RBAC grants (skips policies)', () => {
      auth.registerRole({
        id: 'admin',
        name: 'Admin',
        permissions: [{ resource: '*', action: '*' }],
      });
      const ctx: AuthorizationContext = { user: { id: '1', roles: ['admin'] } };
      expect(auth.checkAccess(ctx, 'any', 'thing').allowed).toBe(true);
    });

    it('denies with reason when no RBAC and no policies', () => {
      const ctx: AuthorizationContext = { user: { id: '1', roles: [] } };
      const result = auth.checkAccess(ctx, 'posts', 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No matching policy');
    });

    it('applies allow policy', () => {
      auth.registerPolicy({
        id: 'p1',
        name: 'Allow reads',
        effect: 'allow',
        resources: ['posts'],
        actions: ['read'],
        conditions: [],
      });
      const ctx: AuthorizationContext = { user: { id: '1', roles: [] } };
      expect(auth.checkAccess(ctx, 'posts', 'read').allowed).toBe(true);
    });

    it('applies deny policy with reason', () => {
      auth.registerPolicy({
        id: 'p1',
        name: 'Block writes',
        effect: 'deny',
        resources: ['posts'],
        actions: ['write'],
        conditions: [],
      });
      const ctx: AuthorizationContext = { user: { id: '1', roles: [] } };
      const result = auth.checkAccess(ctx, 'posts', 'write');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Denied by policy: Block writes');
    });

    it('higher priority policy wins', () => {
      auth.registerPolicy({
        id: 'low',
        name: 'Low Allow',
        effect: 'allow',
        resources: ['posts'],
        actions: ['delete'],
        conditions: [],
        priority: 1,
      });
      auth.registerPolicy({
        id: 'high',
        name: 'High Deny',
        effect: 'deny',
        resources: ['posts'],
        actions: ['delete'],
        conditions: [],
        priority: 10,
      });
      const ctx: AuthorizationContext = { user: { id: '1', roles: [] } };
      expect(auth.checkAccess(ctx, 'posts', 'delete').allowed).toBe(false);
    });

    it('skips policy with unmet conditions', () => {
      auth.registerPolicy({
        id: 'p',
        name: 'P',
        effect: 'allow',
        resources: ['r'],
        actions: ['a'],
        conditions: [{ field: 'user.id', operator: 'eq', value: 'special' }],
      });
      const ctx: AuthorizationContext = { user: { id: 'normal', roles: [] } };
      expect(auth.checkAccess(ctx, 'r', 'a').allowed).toBe(false);
    });

    it('applies policy when conditions are met', () => {
      auth.registerPolicy({
        id: 'p',
        name: 'P',
        effect: 'allow',
        resources: ['r'],
        actions: ['a'],
        conditions: [{ field: 'user.id', operator: 'eq', value: 'special' }],
      });
      const ctx: AuthorizationContext = { user: { id: 'special', roles: [] } };
      expect(auth.checkAccess(ctx, 'r', 'a').allowed).toBe(true);
    });
  });

  describe('condition operators', () => {
    function check(
      operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains',
      value: unknown,
      contextValue: unknown,
    ): boolean {
      const a = new AuthorizationSystem();
      a.registerPolicy({
        id: 't',
        name: 'T',
        effect: 'allow',
        resources: ['r'],
        actions: ['a'],
        conditions: [{ field: 'user.attributes.x', operator, value }],
      });
      return a.checkAccess(
        { user: { id: '1', roles: [], attributes: { x: contextValue } } },
        'r',
        'a',
      ).allowed;
    }

    it('eq', () => {
      expect(check('eq', 'foo', 'foo')).toBe(true);
      expect(check('eq', 'foo', 'bar')).toBe(false);
    });

    it('ne', () => {
      expect(check('ne', 'foo', 'bar')).toBe(true);
      expect(check('ne', 'foo', 'foo')).toBe(false);
    });

    it('gt', () => {
      expect(check('gt', 5, 10)).toBe(true);
      expect(check('gt', 5, 5)).toBe(false);
      expect(check('gt', 5, 3)).toBe(false);
    });

    it('gte', () => {
      expect(check('gte', 5, 5)).toBe(true);
      expect(check('gte', 5, 6)).toBe(true);
      expect(check('gte', 5, 4)).toBe(false);
    });

    it('lt', () => {
      expect(check('lt', 10, 5)).toBe(true);
      expect(check('lt', 10, 10)).toBe(false);
    });

    it('lte', () => {
      expect(check('lte', 10, 10)).toBe(true);
      expect(check('lte', 10, 9)).toBe(true);
      expect(check('lte', 10, 11)).toBe(false);
    });

    it('in', () => {
      expect(check('in', ['a', 'b'], 'b')).toBe(true);
      expect(check('in', ['a', 'b'], 'c')).toBe(false);
    });

    it('contains', () => {
      expect(check('contains', 'world', 'hello world')).toBe(true);
      expect(check('contains', 'xyz', 'hello world')).toBe(false);
    });

    it('gt returns false for non-number', () => {
      expect(check('gt', 5, 'not-a-number')).toBe(false);
    });

    it('contains returns false for non-string', () => {
      expect(check('contains', 'x', 42)).toBe(false);
    });
  });

  describe('context value resolution', () => {
    it('resolves nested fields', () => {
      auth.registerPolicy({
        id: 'p',
        name: 'P',
        effect: 'allow',
        resources: ['r'],
        actions: ['a'],
        conditions: [{ field: 'resource.attributes.tier', operator: 'eq', value: 'pro' }],
      });
      const ctx: AuthorizationContext = {
        user: { id: '1', roles: [] },
        resource: { type: 'r', attributes: { tier: 'pro' } },
      };
      expect(auth.checkAccess(ctx, 'r', 'a').allowed).toBe(true);
    });

    it('resolves environment fields', () => {
      auth.registerPolicy({
        id: 'p',
        name: 'P',
        effect: 'allow',
        resources: ['r'],
        actions: ['a'],
        conditions: [{ field: 'environment.ip', operator: 'eq', value: '10.0.0.1' }],
      });
      const ctx: AuthorizationContext = {
        user: { id: '1', roles: [] },
        environment: { ip: '10.0.0.1' },
      };
      expect(auth.checkAccess(ctx, 'r', 'a').allowed).toBe(true);
    });

    it('returns undefined for missing path', () => {
      auth.registerPolicy({
        id: 'p',
        name: 'P',
        effect: 'allow',
        resources: ['r'],
        actions: ['a'],
        conditions: [{ field: 'user.attributes.missing', operator: 'eq', value: undefined }],
      });
      const ctx: AuthorizationContext = { user: { id: '1', roles: [] } };
      expect(auth.checkAccess(ctx, 'r', 'a').allowed).toBe(true);
    });
  });

  describe('ownsResource', () => {
    it('returns true when user is owner', () => {
      expect(auth.ownsResource('u1', { owner: 'u1' })).toBe(true);
    });

    it('returns false when user is not owner', () => {
      expect(auth.ownsResource('u1', { owner: 'u2' })).toBe(false);
    });

    it('returns false when resource has no owner', () => {
      expect(auth.ownsResource('u1', {})).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all roles and policies', () => {
      auth.registerRole({ id: 'r', name: 'R', permissions: [{ resource: '*', action: '*' }] });
      auth.registerPolicy({
        id: 'p',
        name: 'P',
        effect: 'allow',
        resources: ['*'],
        actions: ['*'],
      });
      auth.clear();
      expect(auth.getRole('r')).toBeUndefined();
      expect(auth.hasPermission(['r'], 'x', 'y')).toBe(false);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  PermissionCache                                                    */
/* ------------------------------------------------------------------ */

describe('PermissionCache', () => {
  let cache: PermissionCache;

  beforeEach(() => {
    cache = new PermissionCache(300_000, 100);
  });

  it('stores and retrieves permissions', () => {
    cache.set('u1', 'posts', 'read', true);
    expect(cache.get('u1', 'posts', 'read')).toBe(true);
  });

  it('returns undefined for cache miss', () => {
    expect(cache.get('u1', 'posts', 'read')).toBeUndefined();
  });

  it('stores false (denied) permissions', () => {
    cache.set('u1', 'admin', 'delete', false);
    expect(cache.get('u1', 'admin', 'delete')).toBe(false);
  });

  it('expires entries after TTL', () => {
    const shortCache = new PermissionCache(1, 100);
    shortCache.set('u1', 'r', 'a', true);
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin until TTL expires */
    }
    expect(shortCache.get('u1', 'r', 'a')).toBeUndefined();
  });

  it('clears all entries for a user', () => {
    cache.set('u1', 'posts', 'read', true);
    cache.set('u1', 'posts', 'write', true);
    cache.set('u2', 'posts', 'read', true);
    cache.clearUser('u1');
    expect(cache.get('u1', 'posts', 'read')).toBeUndefined();
    expect(cache.get('u1', 'posts', 'write')).toBeUndefined();
    expect(cache.get('u2', 'posts', 'read')).toBe(true);
  });

  it('clears all entries', () => {
    cache.set('u1', 'r', 'a', true);
    cache.set('u2', 'r', 'a', true);
    cache.clear();
    expect(cache.get('u1', 'r', 'a')).toBeUndefined();
    expect(cache.get('u2', 'r', 'a')).toBeUndefined();
  });

  it('evicts FIFO when at max capacity', () => {
    const tiny = new PermissionCache(60_000, 3);
    tiny.set('u1', 'r', 'a', true);
    tiny.set('u2', 'r', 'a', true);
    tiny.set('u3', 'r', 'a', true);
    tiny.set('u4', 'r', 'a', true);
    expect(tiny.get('u1', 'r', 'a')).toBeUndefined();
    expect(tiny.get('u4', 'r', 'a')).toBe(true);
  });

  it('evicts expired entries before FIFO when at capacity', () => {
    const tiny = new PermissionCache(1, 3);
    tiny.set('u1', 'r', 'a', true);
    tiny.set('u2', 'r', 'a', true);
    tiny.set('u3', 'r', 'a', true);
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin until TTL */
    }
    tiny.set('u4', 'r', 'a', true);
    expect(tiny.get('u4', 'r', 'a')).toBe(true);
  });

  it('differentiates by resource and action', () => {
    cache.set('u1', 'posts', 'read', true);
    cache.set('u1', 'posts', 'delete', false);
    cache.set('u1', 'users', 'read', false);
    expect(cache.get('u1', 'posts', 'read')).toBe(true);
    expect(cache.get('u1', 'posts', 'delete')).toBe(false);
    expect(cache.get('u1', 'users', 'read')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  PermissionBuilder                                                  */
/* ------------------------------------------------------------------ */

describe('PermissionBuilder', () => {
  it('builds a permission with resource and action', () => {
    const perm = new PermissionBuilder().resource('posts').action('read').build();
    expect(perm).toEqual({ resource: 'posts', action: 'read' });
  });

  it('builds a permission with conditions', () => {
    const perm = new PermissionBuilder()
      .resource('posts')
      .action('update')
      .conditions({ owner: true })
      .build();
    expect(perm.conditions).toEqual({ owner: true });
  });

  it('throws when resource is missing', () => {
    expect(() => new PermissionBuilder().action('read').build()).toThrow(
      'Resource and action are required',
    );
  });

  it('throws when action is missing', () => {
    expect(() => new PermissionBuilder().resource('posts').build()).toThrow(
      'Resource and action are required',
    );
  });

  it('throws when both are missing', () => {
    expect(() => new PermissionBuilder().build()).toThrow('Resource and action are required');
  });

  it('supports fluent chaining', () => {
    const builder = new PermissionBuilder();
    expect(builder.resource('r')).toBe(builder);
    expect(builder.action('a')).toBe(builder);
    expect(builder.conditions({})).toBe(builder);
  });
});

/* ------------------------------------------------------------------ */
/*  PolicyBuilder                                                      */
/* ------------------------------------------------------------------ */

describe('PolicyBuilder', () => {
  it('builds a complete allow policy', () => {
    const policy = new PolicyBuilder()
      .id('p1')
      .name('Allow reads')
      .allow()
      .resources('posts')
      .actions('read')
      .build();
    expect(policy.id).toBe('p1');
    expect(policy.effect).toBe('allow');
    expect(policy.resources).toEqual(['posts']);
  });

  it('builds a deny policy', () => {
    const policy = new PolicyBuilder()
      .id('p2')
      .name('Deny writes')
      .deny()
      .resources('posts', 'pages')
      .actions('write', 'delete')
      .priority(100)
      .build();
    expect(policy.effect).toBe('deny');
    expect(policy.resources).toEqual(['posts', 'pages']);
    expect(policy.priority).toBe(100);
  });

  it('defaults to allow effect', () => {
    const policy = new PolicyBuilder().id('p').name('P').resources('r').actions('a').build();
    expect(policy.effect).toBe('allow');
  });

  it('accumulates multiple conditions', () => {
    const policy = new PolicyBuilder()
      .id('p')
      .name('P')
      .resources('r')
      .actions('a')
      .condition('user.id', 'eq', '1')
      .condition('resource.owner', 'eq', '1')
      .build();
    expect(policy.conditions).toHaveLength(2);
  });

  it('throws when id is missing', () => {
    expect(() => new PolicyBuilder().name('P').resources('r').actions('a').build()).toThrow(
      'ID and name are required',
    );
  });

  it('throws when name is missing', () => {
    expect(() => new PolicyBuilder().id('p').resources('r').actions('a').build()).toThrow(
      'ID and name are required',
    );
  });

  it('supports fluent chaining', () => {
    const b = new PolicyBuilder();
    expect(b.id('p')).toBe(b);
    expect(b.name('P')).toBe(b);
    expect(b.allow()).toBe(b);
    expect(b.deny()).toBe(b);
    expect(b.resources('r')).toBe(b);
    expect(b.actions('a')).toBe(b);
    expect(b.condition('f', 'eq', 'v')).toBe(b);
    expect(b.priority(1)).toBe(b);
  });
});

/* ------------------------------------------------------------------ */
/*  CommonRoles                                                        */
/* ------------------------------------------------------------------ */

describe('CommonRoles', () => {
  it('defines all six roles', () => {
    expect(Object.keys(CommonRoles)).toEqual([
      'owner',
      'admin',
      'editor',
      'viewer',
      'agent',
      'contributor',
    ]);
  });

  it('owner inherits admin', () => {
    expect(CommonRoles.owner.inherits).toContain('admin');
  });

  it('admin has wildcard permissions', () => {
    expect(CommonRoles.admin.permissions).toContainEqual({ resource: '*', action: '*' });
  });

  it('viewer has read-only permissions', () => {
    for (const perm of CommonRoles.viewer.permissions) {
      expect(perm.action).toBe('read');
    }
  });

  it('editor cannot delete content', () => {
    expect(CommonRoles.editor.permissions.some((p) => p.action === 'delete')).toBe(false);
  });

  it('agent can access tasks and rag resources', () => {
    const resources = CommonRoles.agent.permissions.map((p) => p.resource);
    expect(resources).toContain('tasks');
    expect(resources).toContain('rag');
  });

  it('contributor cannot delete content', () => {
    expect(CommonRoles.contributor.permissions.some((p) => p.action === 'delete')).toBe(false);
  });

  it('CommonRoles work with AuthorizationSystem', () => {
    const a = new AuthorizationSystem();
    for (const role of Object.values(CommonRoles)) a.registerRole(role);
    expect(a.hasPermission(['admin'], 'whatever', 'anything')).toBe(true);
    expect(a.hasPermission(['editor'], 'content', 'read')).toBe(true);
    expect(a.hasPermission(['viewer'], 'content', 'create')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Decorators                                                         */
/* ------------------------------------------------------------------ */

describe('Decorators', () => {
  afterEach(() => {
    authorization.clear();
  });

  describe('RequirePermission', () => {
    it('allows method call when user has permission', () => {
      authorization.registerRole({
        id: 'editor',
        name: 'E',
        permissions: [{ resource: 'posts', action: 'read' }],
      });

      class C {
        user = { roles: ['editor'] };

        @RequirePermission('posts', 'read')
        getPost() {
          return 'data';
        }
      }

      expect(new C().getPost()).toBe('data');
    });

    it('throws when user lacks permission', () => {
      authorization.registerRole({
        id: 'viewer',
        name: 'V',
        permissions: [{ resource: 'posts', action: 'read' }],
      });

      class C {
        user = { roles: ['viewer'] };

        @RequirePermission('posts', 'delete')
        deletePost() {
          return 'deleted';
        }
      }

      expect(() => new C().deletePost()).toThrow('Permission denied: posts:delete');
    });

    it('throws when user has no roles', () => {
      class C {
        user = { roles: [] as string[] };

        @RequirePermission('posts', 'read')
        getPost() {
          return 'data';
        }
      }

      expect(() => new C().getPost()).toThrow('Permission denied');
    });

    it('handles missing user object', () => {
      class C {
        @RequirePermission('posts', 'read')
        getPost() {
          return 'data';
        }
      }

      expect(() => new C().getPost()).toThrow('Permission denied');
    });

    it('passes through arguments and return value', () => {
      authorization.registerRole({
        id: 'admin',
        name: 'A',
        permissions: [{ resource: '*', action: '*' }],
      });

      class C {
        user = { roles: ['admin'] };

        @RequirePermission('posts', 'read')
        getPost(id: number) {
          return { id, title: 'Test' };
        }
      }

      expect(new C().getPost(42)).toEqual({ id: 42, title: 'Test' });
    });
  });

  describe('RequireRole', () => {
    it('allows method call when user has the required role', () => {
      class C {
        user = { roles: ['admin'] };

        @RequireRole('admin')
        adminAction() {
          return 'ok';
        }
      }

      expect(new C().adminAction()).toBe('ok');
    });

    it('throws when user does not have the required role', () => {
      class C {
        user = { roles: ['viewer'] };

        @RequireRole('admin')
        adminAction() {
          return 'ok';
        }
      }

      expect(() => new C().adminAction()).toThrow('Role required: admin');
    });

    it('throws when user has no roles', () => {
      class C {
        user = { roles: [] as string[] };

        @RequireRole('admin')
        adminAction() {
          return 'ok';
        }
      }

      expect(() => new C().adminAction()).toThrow('Role required: admin');
    });

    it('handles missing user object', () => {
      class C {
        @RequireRole('admin')
        adminAction() {
          return 'ok';
        }
      }

      expect(() => new C().adminAction()).toThrow('Role required: admin');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  createAuthorizationMiddleware                                      */
/* ------------------------------------------------------------------ */

describe('createAuthorizationMiddleware', () => {
  afterEach(() => {
    authorization.clear();
  });

  it('calls next() when permission is granted', async () => {
    authorization.registerRole({
      id: 'editor',
      name: 'E',
      permissions: [{ resource: 'posts', action: 'read' }],
    });

    const middleware = createAuthorizationMiddleware(
      (req: { roles: string[] }) => ({ id: '1', roles: req.roles }),
      'posts',
      'read',
    );

    const next = vi.fn(async () => 'ok');
    await middleware({ roles: ['editor'] }, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('throws when permission is denied', () => {
    const middleware = createAuthorizationMiddleware(
      (req: { roles: string[] }) => ({ id: '1', roles: req.roles }),
      'posts',
      'delete',
    );

    expect(() => middleware({ roles: [] }, async () => 'ok')).toThrow(
      'Permission denied: posts:delete',
    );
  });

  it('does not call next() when permission is denied', () => {
    const middleware = createAuthorizationMiddleware(
      (req: { roles: string[] }) => ({ id: '1', roles: req.roles }),
      'posts',
      'delete',
    );

    const next = vi.fn(async () => 'ok');
    try {
      middleware({ roles: [] }, next);
    } catch {
      /* expected */
    }
    expect(next).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  canAccessResource                                                  */
/* ------------------------------------------------------------------ */

describe('canAccessResource', () => {
  afterEach(() => {
    authorization.clear();
  });

  it('allows via RBAC permission', () => {
    authorization.registerRole({
      id: 'editor',
      name: 'E',
      permissions: [{ resource: 'posts', action: 'read' }],
    });
    expect(canAccessResource('u1', ['editor'], { type: 'posts', owner: 'u2' }, 'read')).toBe(true);
  });

  it('allows via resource ownership', () => {
    expect(canAccessResource('u1', [], { type: 'posts', id: 'p1', owner: 'u1' }, 'delete')).toBe(
      true,
    );
  });

  it('denies when neither permission nor ownership', () => {
    expect(canAccessResource('u1', [], { type: 'posts', id: 'p1', owner: 'u2' }, 'delete')).toBe(
      false,
    );
  });

  it('allows when both permission and ownership exist', () => {
    authorization.registerRole({
      id: 'editor',
      name: 'E',
      permissions: [{ resource: 'posts', action: 'read' }],
    });
    expect(canAccessResource('u1', ['editor'], { type: 'posts', owner: 'u1' }, 'read')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  checkAttributeAccess                                               */
/* ------------------------------------------------------------------ */

describe('checkAttributeAccess', () => {
  afterEach(() => {
    authorization.clear();
  });

  it('allows when RBAC grants and no required attributes', () => {
    authorization.registerRole({
      id: 'admin',
      name: 'A',
      permissions: [{ resource: '*', action: '*' }],
    });
    const ctx: AuthorizationContext = { user: { id: '1', roles: ['admin'] } };
    expect(checkAttributeAccess(ctx, 'posts', 'read')).toBe(true);
  });

  it('allows when RBAC grants and attributes match', () => {
    authorization.registerRole({
      id: 'admin',
      name: 'A',
      permissions: [{ resource: '*', action: '*' }],
    });
    const ctx: AuthorizationContext = {
      user: { id: '1', roles: ['admin'], attributes: { tier: 'pro' } },
    };
    expect(checkAttributeAccess(ctx, 'posts', 'read', { tier: 'pro' })).toBe(true);
  });

  it('denies when attributes do not match', () => {
    authorization.registerRole({
      id: 'admin',
      name: 'A',
      permissions: [{ resource: '*', action: '*' }],
    });
    const ctx: AuthorizationContext = {
      user: { id: '1', roles: ['admin'], attributes: { tier: 'free' } },
    };
    expect(checkAttributeAccess(ctx, 'posts', 'read', { tier: 'pro' })).toBe(false);
  });

  it('denies when RBAC denies even if attributes match', () => {
    const ctx: AuthorizationContext = {
      user: { id: '1', roles: [], attributes: { tier: 'pro' } },
    };
    expect(checkAttributeAccess(ctx, 'posts', 'read', { tier: 'pro' })).toBe(false);
  });

  it('handles missing user attributes gracefully', () => {
    authorization.registerRole({
      id: 'admin',
      name: 'A',
      permissions: [{ resource: '*', action: '*' }],
    });
    const ctx: AuthorizationContext = { user: { id: '1', roles: ['admin'] } };
    expect(checkAttributeAccess(ctx, 'posts', 'read', { tier: 'pro' })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Global instances                                                   */
/* ------------------------------------------------------------------ */

describe('global instances', () => {
  afterEach(() => {
    authorization.clear();
  });

  it('authorization is an AuthorizationSystem instance', () => {
    expect(authorization).toBeInstanceOf(AuthorizationSystem);
  });

  it('decorators and middleware use the global authorization instance', () => {
    authorization.registerRole({
      id: 'admin',
      name: 'A',
      permissions: [{ resource: '*', action: '*' }],
    });

    // Decorator uses global
    class C {
      user = { roles: ['admin'] };

      @RequirePermission('x', 'y')
      method() {
        return true;
      }
    }
    expect(new C().method()).toBe(true);

    // Middleware uses global
    const mw = createAuthorizationMiddleware(
      (r: { roles: string[] }) => ({ id: '1', roles: r.roles }),
      'x',
      'y',
    );
    const next = vi.fn(async () => 'ok');
    mw({ roles: ['admin'] }, next);
    expect(next).toHaveBeenCalled();
  });
});
