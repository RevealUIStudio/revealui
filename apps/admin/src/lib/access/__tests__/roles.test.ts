/**
 * Access Control Role Tests
 *
 * Tests for all role-based access functions used by CMS collections.
 */

import { describe, expect, it } from 'vitest';
import { Role } from '../permissions/roles';
import { anyone } from '../roles/anyone';
import { authenticated } from '../roles/authenticated';
import { authenticatedOrPublished } from '../roles/authenticatedOrPublished';
import { hasRole, type UserWithRoles } from '../roles/hasRole';
import { isAdmin } from '../roles/isAdmin';
import { isAdminAndUser } from '../roles/isAdminAndUser';
import { isAdminOrLoggedIn } from '../roles/isAdminOrLoggedIn';
import { isAdminOrPublished } from '../roles/isAdminOrPublished';
import { isSuperAdmin } from '../roles/isSuperAdmin';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeReq(user?: UserWithRoles | null) {
  return { user: user ?? undefined };
}

const superAdmin: UserWithRoles = {
  id: 'u1',
  roles: [Role.UserSuperAdmin],
};

const admin: UserWithRoles = {
  id: 'u2',
  roles: [Role.UserAdmin],
};

const tenantAdmin: UserWithRoles = {
  id: 'u3',
  roles: [Role.TenantAdmin],
};

const viewer: UserWithRoles = {
  id: 'u4',
  roles: [Role.Viewer],
};

const customer: UserWithRoles = {
  id: 'u5',
  roles: [Role.Customer],
};

const noRoles: UserWithRoles = {
  id: 'u6',
};

// ─── hasRole ─────────────────────────────────────────────────────────────────

describe('hasRole', () => {
  it('returns true when user has matching role', () => {
    expect(hasRole(admin, [Role.UserAdmin])).toBe(true);
  });

  it('returns true when user has one of multiple checked roles', () => {
    expect(hasRole(admin, [Role.UserSuperAdmin, Role.UserAdmin])).toBe(true);
  });

  it('returns false when user has no matching role', () => {
    expect(hasRole(viewer, [Role.UserAdmin])).toBe(false);
  });

  it('returns false for null user', () => {
    expect(hasRole(null, [Role.UserAdmin])).toBe(false);
  });

  it('returns false for undefined user', () => {
    expect(hasRole(undefined, [Role.UserAdmin])).toBe(false);
  });

  it('returns false when user has no roles array', () => {
    expect(hasRole(noRoles, [Role.UserAdmin])).toBe(false);
  });

  it('checks globalRoles when roles is absent', () => {
    const user: UserWithRoles = { id: 'g1', globalRoles: [Role.UserAdmin] };
    expect(hasRole(user, [Role.UserAdmin])).toBe(true);
  });

  it('prefers globalRoles over roles', () => {
    const user: UserWithRoles = {
      id: 'g2',
      globalRoles: [Role.UserSuperAdmin],
      roles: [Role.Viewer],
    };
    expect(hasRole(user, [Role.UserSuperAdmin])).toBe(true);
    expect(hasRole(user, [Role.Viewer])).toBe(false);
  });
});

// ─── anyone ──────────────────────────────────────────────────────────────────

describe('anyone', () => {
  it('returns true for unauthenticated requests', () => {
    expect(anyone({ req: makeReq() } as never)).toBe(true);
  });

  it('returns true for authenticated requests', () => {
    expect(anyone({ req: makeReq(admin) } as never)).toBe(true);
  });
});

// ─── authenticated ───────────────────────────────────────────────────────────

describe('authenticated', () => {
  it('returns true when user is present', () => {
    expect(authenticated({ req: makeReq(viewer) } as never)).toBe(true);
  });

  it('returns false when user is absent', () => {
    expect(authenticated({ req: makeReq() } as never)).toBe(false);
  });

  it('returns false when user is null', () => {
    expect(authenticated({ req: makeReq(null) } as never)).toBe(false);
  });
});

// ─── isAdmin ─────────────────────────────────────────────────────────────────

describe('isAdmin', () => {
  it('allows UserAdmin', () => {
    expect(isAdmin({ req: makeReq(admin) })).toBe(true);
  });

  it('allows UserSuperAdmin', () => {
    expect(isAdmin({ req: makeReq(superAdmin) })).toBe(true);
  });

  it('denies Viewer', () => {
    expect(isAdmin({ req: makeReq(viewer) })).toBe(false);
  });

  it('denies Customer', () => {
    expect(isAdmin({ req: makeReq(customer) })).toBe(false);
  });

  it('denies unauthenticated', () => {
    expect(isAdmin({ req: makeReq() })).toBe(false);
  });

  it('denies TenantAdmin (not a user-level admin)', () => {
    expect(isAdmin({ req: makeReq(tenantAdmin) })).toBe(false);
  });
});

// ─── isSuperAdmin ────────────────────────────────────────────────────────────

describe('isSuperAdmin', () => {
  it('allows UserSuperAdmin', async () => {
    expect(await isSuperAdmin({ req: makeReq(superAdmin) })).toBe(true);
  });

  it('denies UserAdmin', async () => {
    expect(await isSuperAdmin({ req: makeReq(admin) })).toBe(false);
  });

  it('denies unauthenticated', async () => {
    expect(await isSuperAdmin({ req: makeReq() })).toBe(false);
  });
});

// ─── isAdminAndUser ──────────────────────────────────────────────────────────

describe('isAdminAndUser', () => {
  it('allows admin to access any record', () => {
    expect(isAdminAndUser({ req: makeReq(admin), id: 'other-user' })).toBe(true);
  });

  it('allows user to access their own record', () => {
    expect(isAdminAndUser({ req: makeReq(viewer), id: 'u4' })).toBe(true);
  });

  it('denies user from accessing other records', () => {
    expect(isAdminAndUser({ req: makeReq(viewer), id: 'other-user' })).toBe(false);
  });

  it('denies unauthenticated', () => {
    expect(isAdminAndUser({ req: makeReq() })).toBe(false);
  });

  it('handles numeric id comparison', () => {
    const numericUser: UserWithRoles = { id: 42, roles: [Role.Viewer] };
    expect(isAdminAndUser({ req: makeReq(numericUser), id: 42 })).toBe(true);
  });

  it('handles string-number id mismatch correctly', () => {
    const numericUser: UserWithRoles = { id: 42, roles: [Role.Viewer] };
    expect(isAdminAndUser({ req: makeReq(numericUser), id: '42' })).toBe(true);
  });
});

// ─── isAdminOrLoggedIn ───────────────────────────────────────────────────────

describe('isAdminOrLoggedIn', () => {
  it('allows admin', () => {
    expect(isAdminOrLoggedIn({ req: makeReq(admin) })).toBe(true);
  });

  it('allows any logged-in user', () => {
    expect(isAdminOrLoggedIn({ req: makeReq(viewer) })).toBe(true);
  });

  it('denies unauthenticated', () => {
    expect(isAdminOrLoggedIn({ req: makeReq() })).toBe(false);
  });
});

// ─── isAdminOrPublished ──────────────────────────────────────────────────────

describe('isAdminOrPublished', () => {
  it('allows access to published content for anyone', () => {
    expect(isAdminOrPublished({ req: makeReq(), data: { _status: 'published' } })).toBe(true);
  });

  it('allows access when published flag is true', () => {
    expect(isAdminOrPublished({ req: makeReq(), data: { published: true } })).toBe(true);
  });

  it('allows admin access to unpublished content', () => {
    expect(isAdminOrPublished({ req: makeReq(admin), data: { _status: 'draft' } })).toBe(true);
  });

  it('allows tenant admin access to unpublished content', () => {
    expect(isAdminOrPublished({ req: makeReq(tenantAdmin), data: { _status: 'draft' } })).toBe(
      true,
    );
  });

  it('denies non-admin access to unpublished content', () => {
    expect(isAdminOrPublished({ req: makeReq(viewer), data: { _status: 'draft' } })).toBe(false);
  });

  it('denies unauthenticated access to unpublished content', () => {
    expect(isAdminOrPublished({ req: makeReq(), data: { _status: 'draft' } })).toBe(false);
  });
});

// ─── authenticatedOrPublished ────────────────────────────────────────────────

describe('authenticatedOrPublished', () => {
  it('returns true for authenticated user', () => {
    expect(authenticatedOrPublished({ req: makeReq(viewer) } as never)).toBe(true);
  });

  it('returns where clause for unauthenticated user', () => {
    const result = authenticatedOrPublished({ req: makeReq() } as never);
    expect(result).toEqual({ _status: { equals: 'published' } });
  });
});

// ─── Collection Access Matrix ────────────────────────────────────────────────

describe('collection access matrix', () => {
  describe('Users collection', () => {
    // Users: create=isAdmin, read=admin||self, update=isAdminAndUser, delete=isAdmin
    it('only admins can create users', () => {
      expect(isAdmin({ req: makeReq(admin) })).toBe(true);
      expect(isAdmin({ req: makeReq(viewer) })).toBe(false);
    });

    it('admins can update any user', () => {
      expect(isAdminAndUser({ req: makeReq(admin), id: 'any-user' })).toBe(true);
    });

    it('users can update themselves', () => {
      expect(isAdminAndUser({ req: makeReq(viewer), id: viewer.id })).toBe(true);
    });

    it('users cannot update others', () => {
      expect(isAdminAndUser({ req: makeReq(viewer), id: 'other' })).toBe(false);
    });

    it('only admins can delete users', () => {
      expect(isAdmin({ req: makeReq(admin) })).toBe(true);
      expect(isAdmin({ req: makeReq(viewer) })).toBe(false);
    });
  });

  describe('Posts collection', () => {
    // Posts: create=authenticated, read=authenticatedOrPublished, update=authenticated, delete=authenticated
    it('any authenticated user can create posts', () => {
      expect(authenticated({ req: makeReq(viewer) } as never)).toBe(true);
      expect(authenticated({ req: makeReq() } as never)).toBe(false);
    });

    it('unauthenticated users see only published posts', () => {
      const result = authenticatedOrPublished({ req: makeReq() } as never);
      expect(result).toEqual({ _status: { equals: 'published' } });
    });
  });

  describe('Products collection', () => {
    // Products: read=anyone, create/update/delete=isAdmin
    it('anyone can read products', () => {
      expect(anyone({ req: makeReq() } as never)).toBe(true);
    });

    it('only admins can modify products', () => {
      expect(isAdmin({ req: makeReq(admin) })).toBe(true);
      expect(isAdmin({ req: makeReq(customer) })).toBe(false);
    });
  });
});
