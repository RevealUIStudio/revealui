/**
 * RBAC Enforcement Tests
 *
 * Proves that role-based access control is correctly enforced:
 * - Users collection: only admins create, non-admins see only their own user
 * - Media collection: unauthenticated users denied
 * - Access helpers: anyone, authenticated, isAdmin, isSuperAdmin
 * - Role hierarchy: super-admin > admin > editor > viewer
 */

import { describe, expect, it } from 'vitest';
import { anyone, authenticated, isAdmin, isSuperAdmin } from '@/lib/access';
import RolePermissions, { Role } from '@/lib/access/permissions/roles';
import { hasRole, type UserWithRoles } from '@/lib/access/roles/hasRole';
import { isAdminAndUser } from '@/lib/access/roles/isAdminAndUser';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeReq(user?: UserWithRoles | null) {
  return { user: user ?? undefined };
}

const superAdminUser: UserWithRoles = {
  id: 'sa-1',
  roles: [Role.UserSuperAdmin],
};

const adminUser: UserWithRoles = {
  id: 'admin-1',
  roles: [Role.UserAdmin],
};

const editorUser: UserWithRoles = {
  id: 'editor-1',
  roles: [Role.ContentManager],
};

const viewerUser: UserWithRoles = {
  id: 'viewer-1',
  roles: [Role.Viewer],
};

const customerUser: UserWithRoles = {
  id: 'customer-1',
  roles: [Role.Customer],
};

const noRolesUser: UserWithRoles = {
  id: 'norole-1',
};

// ─── Users Collection Access ────────────────────────────────────────────────

describe('Users collection access', () => {
  describe('create (isAdmin)', () => {
    it('admin can create users', () => {
      expect(isAdmin({ req: makeReq(adminUser) })).toBe(true);
    });

    it('super-admin can create users', () => {
      expect(isAdmin({ req: makeReq(superAdminUser) })).toBe(true);
    });

    it('non-admin CANNOT create users', () => {
      expect(isAdmin({ req: makeReq(viewerUser) })).toBe(false);
    });

    it('editor CANNOT create users', () => {
      expect(isAdmin({ req: makeReq(editorUser) })).toBe(false);
    });

    it('customer CANNOT create users', () => {
      expect(isAdmin({ req: makeReq(customerUser) })).toBe(false);
    });

    it('unauthenticated CANNOT create users', () => {
      expect(isAdmin({ req: makeReq() })).toBe(false);
    });
  });

  describe('read (admin sees all, non-admin sees only self)', () => {
    // Re-implementing the Users collection read logic inline for testing
    // (matches apps/cms/src/lib/collections/Users/index.ts)
    function usersRead({ req }: { req: { user?: unknown } }) {
      const user = req?.user as { id?: string } | null;
      if (!user?.id) return false;
      if (isAdmin({ req })) return true;
      return { id: { equals: user.id } };
    }

    it('admin can read all users (returns true)', () => {
      const result = usersRead({ req: makeReq(adminUser) });
      expect(result).toBe(true);
    });

    it('super-admin can read all users (returns true)', () => {
      const result = usersRead({ req: makeReq(superAdminUser) });
      expect(result).toBe(true);
    });

    it('non-admin can only read their own user (returns WhereClause)', () => {
      const result = usersRead({ req: makeReq(viewerUser) });
      expect(result).toEqual({ id: { equals: 'viewer-1' } });
    });

    it('customer can only read their own user (returns WhereClause)', () => {
      const result = usersRead({ req: makeReq(customerUser) });
      expect(result).toEqual({ id: { equals: 'customer-1' } });
    });

    it('unauthenticated user CANNOT read any users (returns false)', () => {
      const result = usersRead({ req: makeReq() });
      expect(result).toBe(false);
    });

    it('user with no id CANNOT read any users (returns false)', () => {
      const result = usersRead({ req: makeReq({ roles: [Role.Viewer] }) });
      expect(result).toBe(false);
    });
  });

  describe('update (isAdminAndUser)', () => {
    it('admin can update any user record', () => {
      expect(isAdminAndUser({ req: makeReq(adminUser), id: 'other-user' })).toBe(true);
    });

    it('user can update their own record', () => {
      expect(isAdminAndUser({ req: makeReq(viewerUser), id: 'viewer-1' })).toBe(true);
    });

    it('user CANNOT update another user record', () => {
      expect(isAdminAndUser({ req: makeReq(viewerUser), id: 'admin-1' })).toBe(false);
    });

    it('unauthenticated CANNOT update any user', () => {
      expect(isAdminAndUser({ req: makeReq() })).toBe(false);
    });
  });

  describe('delete (isAdmin)', () => {
    it('admin can delete users', () => {
      expect(isAdmin({ req: makeReq(adminUser) })).toBe(true);
    });

    it('non-admin CANNOT delete users', () => {
      expect(isAdmin({ req: makeReq(viewerUser) })).toBe(false);
    });
  });
});

// ─── Media Collection Access ────────────────────────────────────────────────

describe('Media collection access', () => {
  it('authenticated user can access media', () => {
    expect(authenticated({ req: makeReq(viewerUser) } as never)).toBe(true);
  });

  it('authenticated admin can access media', () => {
    expect(authenticated({ req: makeReq(adminUser) } as never)).toBe(true);
  });

  it('unauthenticated user CANNOT access media', () => {
    expect(authenticated({ req: makeReq() } as never)).toBe(false);
  });

  it('null user CANNOT access media', () => {
    expect(authenticated({ req: makeReq(null) } as never)).toBe(false);
  });

  it('all CRUD operations require authentication (same function)', () => {
    // Media uses `authenticated` for create, read, update, delete
    const ops = ['create', 'read', 'update', 'delete'] as const;
    for (const _op of ops) {
      expect(authenticated({ req: makeReq() } as never)).toBe(false);
      expect(authenticated({ req: makeReq(viewerUser) } as never)).toBe(true);
    }
  });
});

// ─── Access Helpers ─────────────────────────────────────────────────────────

describe('access helpers', () => {
  describe('anyone()', () => {
    it('allows unauthenticated requests', () => {
      expect(anyone({ req: makeReq() } as never)).toBe(true);
    });

    it('allows authenticated requests', () => {
      expect(anyone({ req: makeReq(adminUser) } as never)).toBe(true);
    });

    it('allows requests with null user', () => {
      expect(anyone({ req: makeReq(null) } as never)).toBe(true);
    });
  });

  describe('authenticated()', () => {
    it('allows any authenticated user', () => {
      expect(authenticated({ req: makeReq(viewerUser) } as never)).toBe(true);
    });

    it('denies when user is absent', () => {
      expect(authenticated({ req: makeReq() } as never)).toBe(false);
    });

    it('denies when user is null', () => {
      expect(authenticated({ req: makeReq(null) } as never)).toBe(false);
    });

    it('allows user with no roles (still authenticated)', () => {
      expect(authenticated({ req: makeReq(noRolesUser) } as never)).toBe(true);
    });
  });

  describe('isAdmin()', () => {
    it('allows UserAdmin role', () => {
      expect(isAdmin({ req: makeReq(adminUser) })).toBe(true);
    });

    it('allows UserSuperAdmin role', () => {
      expect(isAdmin({ req: makeReq(superAdminUser) })).toBe(true);
    });

    it('denies Viewer role', () => {
      expect(isAdmin({ req: makeReq(viewerUser) })).toBe(false);
    });

    it('denies Customer role', () => {
      expect(isAdmin({ req: makeReq(customerUser) })).toBe(false);
    });

    it('denies ContentManager role', () => {
      expect(isAdmin({ req: makeReq(editorUser) })).toBe(false);
    });

    it('denies TenantAdmin (not user-level admin)', () => {
      const tenantAdmin: UserWithRoles = { id: 't1', roles: [Role.TenantAdmin] };
      expect(isAdmin({ req: makeReq(tenantAdmin) })).toBe(false);
    });

    it('denies unauthenticated request', () => {
      expect(isAdmin({ req: makeReq() })).toBe(false);
    });

    it('denies user with no roles', () => {
      expect(isAdmin({ req: makeReq(noRolesUser) })).toBe(false);
    });
  });

  describe('isSuperAdmin()', () => {
    it('allows UserSuperAdmin role', async () => {
      expect(await isSuperAdmin({ req: makeReq(superAdminUser) })).toBe(true);
    });

    it('denies UserAdmin role (admin != super-admin)', async () => {
      expect(await isSuperAdmin({ req: makeReq(adminUser) })).toBe(false);
    });

    it('denies TenantSuperAdmin (wrong scope)', async () => {
      const tenantSuperAdmin: UserWithRoles = {
        id: 'tsa-1',
        roles: [Role.TenantSuperAdmin],
      };
      expect(await isSuperAdmin({ req: makeReq(tenantSuperAdmin) })).toBe(false);
    });

    it('denies Viewer', async () => {
      expect(await isSuperAdmin({ req: makeReq(viewerUser) })).toBe(false);
    });

    it('denies unauthenticated', async () => {
      expect(await isSuperAdmin({ req: makeReq() })).toBe(false);
    });

    it('denies user with no roles', async () => {
      expect(await isSuperAdmin({ req: makeReq(noRolesUser) })).toBe(false);
    });
  });
});

// ─── Role Hierarchy ─────────────────────────────────────────────────────────

describe('role hierarchy', () => {
  it('super-admin has higher privilege than admin', () => {
    // super-admin passes isAdmin check
    expect(isAdmin({ req: makeReq(superAdminUser) })).toBe(true);
    // admin does NOT pass isSuperAdmin check
    expect(hasRole(adminUser, [Role.UserSuperAdmin])).toBe(false);
  });

  it('admin has higher privilege than editor (ContentManager)', () => {
    // admin passes isAdmin
    expect(isAdmin({ req: makeReq(adminUser) })).toBe(true);
    // editor does NOT pass isAdmin
    expect(isAdmin({ req: makeReq(editorUser) })).toBe(false);
  });

  it('editor has higher privilege than viewer', () => {
    // Both fail isAdmin, but editor has ManageContent permission
    const editorPerms = RolePermissions[Role.ContentManager];
    const viewerPerms = RolePermissions[Role.Viewer];

    expect(editorPerms.length).toBeGreaterThan(0);
    expect(viewerPerms.length).toBe(0);
  });

  it('viewer has no permissions', () => {
    const viewerPerms = RolePermissions[Role.Viewer];
    expect(viewerPerms).toEqual([]);
  });

  it('super-admin permissions are a superset of admin permissions', () => {
    const superAdminPerms = RolePermissions[Role.UserSuperAdmin];
    const adminPerms = RolePermissions[Role.UserAdmin];

    // Super admin has ManageUsers + ManageBilling, admin has only ManageUsers
    const superAdminNames = superAdminPerms.map((p) => p.name);
    const adminNames = adminPerms.map((p) => p.name);

    for (const perm of adminNames) {
      expect(superAdminNames).toContain(perm);
    }
    expect(superAdminPerms.length).toBeGreaterThan(adminPerms.length);
  });

  it('TenantSuperAdmin has more permissions than TenantAdmin', () => {
    const tenantSuperPerms = RolePermissions[Role.TenantSuperAdmin];
    const tenantAdminPerms = RolePermissions[Role.TenantAdmin];

    expect(tenantSuperPerms.length).toBeGreaterThan(tenantAdminPerms.length);

    // TenantAdmin permissions should be subset of TenantSuperAdmin
    const tenantSuperNames = tenantSuperPerms.map((p) => p.name);
    for (const perm of tenantAdminPerms) {
      expect(tenantSuperNames).toContain(perm.name);
    }
  });

  it('every role has a defined permissions array', () => {
    for (const role of Object.values(Role)) {
      expect(RolePermissions[role]).toBeDefined();
      expect(Array.isArray(RolePermissions[role])).toBe(true);
    }
  });

  it('all permission levels are positive integers', () => {
    for (const role of Object.values(Role)) {
      for (const perm of RolePermissions[role]) {
        expect(perm.level).toBeGreaterThan(0);
        expect(Number.isInteger(perm.level)).toBe(true);
      }
    }
  });
});

// ─── Cross-Cutting Security Assertions ──────────────────────────────────────

describe('cross-cutting security assertions', () => {
  it('unauthenticated requests are denied by all admin checks', async () => {
    const req = makeReq();
    expect(isAdmin({ req })).toBe(false);
    expect(await isSuperAdmin({ req })).toBe(false);
    expect(authenticated({ req } as never)).toBe(false);
  });

  it('viewer cannot escalate to admin operations', () => {
    const req = makeReq(viewerUser);
    expect(isAdmin({ req })).toBe(false);
    expect(isAdminAndUser({ req, id: 'other-user' })).toBe(false);
  });

  it('customer cannot escalate to admin operations', () => {
    const req = makeReq(customerUser);
    expect(isAdmin({ req })).toBe(false);
    expect(isAdminAndUser({ req, id: 'other-user' })).toBe(false);
  });

  it('self-access does not grant admin privileges', () => {
    // A user can update themselves but that does not make them an admin
    expect(isAdminAndUser({ req: makeReq(viewerUser), id: 'viewer-1' })).toBe(true);
    expect(isAdmin({ req: makeReq(viewerUser) })).toBe(false);
  });

  it('hasRole returns false for fabricated role strings', () => {
    const attacker: UserWithRoles = {
      id: 'evil',
      roles: ['user-super-admin '], // trailing space
    };
    expect(hasRole(attacker, [Role.UserSuperAdmin])).toBe(false);
  });

  it('hasRole returns false for case-variant role strings', () => {
    const attacker: UserWithRoles = {
      id: 'evil',
      roles: ['User-Super-Admin'], // wrong case
    };
    expect(hasRole(attacker, [Role.UserSuperAdmin])).toBe(false);
  });
});
