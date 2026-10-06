import { describe, expect, it } from 'vitest';
import {
  canAdministerAllContent,
  canManageSiteContent,
  hasAnyRole,
  hasRole,
  isAdmin,
  isAdminRole,
  isPlatformSuperAdmin,
  isSuperAdmin,
} from './platform-roles.js';

describe('canonical site content authority', () => {
  it.each(['admin', 'owner', 'super-admin'])(
    'denies hosted global authority for raw role %s',
    (role) => {
      expect(canAdministerAllContent({ id: 'tenant', role, emailVerified: true }, 'hosted')).toBe(
        false,
      );
      expect(canManageSiteContent({ id: 'tenant', role }, 'foreign', 'hosted')).toBe(false);
    },
  );
  it('denies unverified and flattened operator claims', () => {
    expect(isPlatformSuperAdmin({ emailVerified: false, _json: { roles: ['super-admin'] } })).toBe(
      false,
    );
    expect(isPlatformSuperAdmin({ emailVerified: true, role: 'super-admin' })).toBe(false);
    expect(isPlatformSuperAdmin({ emailVerified: true, _json: '{"roles":["super-admin"]}' })).toBe(
      false,
    );
  });
  it('allows verified canonical operators and site owners', () => {
    expect(
      canManageSiteContent(
        { id: 'operator', emailVerified: true, _json: { roles: ['super-admin'] } },
        'foreign',
        'hosted',
      ),
    ).toBe(true);
    expect(canManageSiteContent({ id: 'owner', role: 'viewer' }, 'owner', 'hosted')).toBe(true);
    expect(canManageSiteContent(null, 'owner', 'hosted')).toBe(false);
  });
  it('does not infer Forge global authority from unknown posture', () => {
    expect(canAdministerAllContent({ id: 'tenant', role: 'admin' }, null)).toBe(false);
    expect(canManageSiteContent({ id: 'owner', role: 'viewer' }, 'owner', null)).toBe(true);
    expect(
      canAdministerAllContent(
        { id: 'operator', emailVerified: true, _json: { roles: ['super-admin'] } },
        null,
      ),
    ).toBe(true);
  });
  it('preserves the explicit Forge administrator contract', () => {
    expect(canAdministerAllContent({ id: 'forge', role: 'admin' }, 'forge')).toBe(true);
    expect(canAdministerAllContent({ id: 'viewer', role: 'viewer' }, 'forge')).toBe(false);
  });
});

const platformSuperAdmin = {
  id: 'op',
  role: 'viewer',
  emailVerified: true,
  _json: { roles: ['super-admin'] },
};

describe('platform role ladder', () => {
  it('gives owner, super-admin, and admin the same admin answer', () => {
    for (const role of ['owner', 'super-admin', 'admin'] as const) {
      expect(isAdmin(role)).toBe(true);
      expect(isAdminRole(role)).toBe(true);
      expect(hasRole(role, 'admin')).toBe(true);
    }
  });

  it('denies editor, user, and unauthenticated callers', () => {
    expect(isAdmin('editor')).toBe(false);
    expect(isAdmin('user')).toBe(false);
    expect(isAdmin('viewer')).toBe(false);
    expect(isAdmin('tenant-admin')).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin('')).toBe(false);
    expect(hasRole(null, 'admin')).toBe(false);
  });

  it('lets higher ladder roles satisfy lower checks and not the reverse', () => {
    expect(hasRole('owner', 'owner')).toBe(true);
    expect(hasRole('owner', 'super-admin')).toBe(true);
    expect(hasRole('owner', 'admin')).toBe(true);
    expect(hasRole('owner', 'editor')).toBe(false);

    expect(hasRole('super-admin', 'super-admin')).toBe(true);
    expect(hasRole('super-admin', 'admin')).toBe(true);
    expect(hasRole('super-admin', 'owner')).toBe(false);

    expect(hasRole('admin', 'admin')).toBe(true);
    expect(hasRole('admin', 'super-admin')).toBe(false);
    expect(hasRole('admin', 'owner')).toBe(false);
  });

  it('treats a verified _json super-admin as super-admin rank', () => {
    expect(isAdmin(platformSuperAdmin)).toBe(true);
    expect(hasRole(platformSuperAdmin, 'admin')).toBe(true);
    expect(hasRole(platformSuperAdmin, 'super-admin')).toBe(true);
    expect(hasRole(platformSuperAdmin, 'owner')).toBe(false);
    expect(isSuperAdmin(platformSuperAdmin)).toBe(true);
    expect(isAdmin({ ...platformSuperAdmin, emailVerified: false })).toBe(false);
  });

  it('keeps isSuperAdmin exact so shell owner is not an operator', () => {
    expect(isSuperAdmin('super-admin')).toBe(true);
    expect(isSuperAdmin({ role: 'owner' })).toBe(false);
    expect(isSuperAdmin({ role: 'admin' })).toBe(false);
    expect(isSuperAdmin({ roles: ['super-admin'] })).toBe(true);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it('prefers globalRoles over roles and still honors the role column', () => {
    expect(isAdmin({ globalRoles: ['viewer'], roles: ['admin'] })).toBe(false);
    expect(isAdmin({ globalRoles: [], roles: ['admin'], role: 'editor' })).toBe(false);
    expect(isAdmin({ globalRoles: ['viewer'], role: 'admin' })).toBe(true);
    expect(isAdmin({ roles: ['admin'] })).toBe(true);
  });

  it('matches off-ladder roles only by exact equality', () => {
    expect(hasRole({ role: 'editor' }, 'editor')).toBe(true);
    expect(hasRole({ role: 'owner' }, 'editor')).toBe(false);
    expect(hasAnyRole({ role: 'editor' }, ['admin', 'editor'])).toBe(true);
    expect(hasAnyRole({ role: 'viewer' }, ['admin', 'owner'])).toBe(false);
    expect(hasAnyRole(null, ['admin'])).toBe(false);
  });
});
