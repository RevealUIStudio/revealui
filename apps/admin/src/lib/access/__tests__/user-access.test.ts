/**
 * User Access Control Tests
 *
 * Tests for:
 * - isUserLoggedIn: simple authentication check
 * - lastLoggedInTenant: extract tenant ID from user (string, number, or object)
 * - hasRole: role matching utility
 */

import { describe, expect, it } from 'vitest';
import { Role } from '../permissions/roles';
import { hasRole } from '../roles/hasRole';
import { lastLoggedInTenant } from '../tenants/lastLoggedInTenant';
import { isUserLoggedIn } from '../users/isUserLoggedIn';

// ─── isUserLoggedIn ─────────────────────────────────────────────────────────────

describe('isUserLoggedIn', () => {
  it('returns true when user exists on req', () => {
    const result = isUserLoggedIn({ req: { user: { id: '1' } } } as never);
    expect(result).toBe(true);
  });

  it('returns false when no user on req', () => {
    const result = isUserLoggedIn({ req: {} } as never);
    expect(result).toBe(false);
  });

  it('returns false when user is null', () => {
    const result = isUserLoggedIn({ req: { user: null } } as never);
    expect(result).toBe(false);
  });

  it('returns false when user is undefined', () => {
    const result = isUserLoggedIn({ req: { user: undefined } } as never);
    expect(result).toBe(false);
  });

  it('returns false when req is undefined', () => {
    const result = isUserLoggedIn({ req: undefined } as never);
    expect(result).toBe(false);
  });
});

// ─── lastLoggedInTenant ─────────────────────────────────────────────────────────

describe('lastLoggedInTenant', () => {
  it('returns null when no user', () => {
    const result = lastLoggedInTenant({} as never);
    expect(result).toBeNull();
  });

  it('returns string tenant ID directly', () => {
    const req = { user: { lastLoggedInTenant: 'tenant-abc' } };
    const result = lastLoggedInTenant(req as never);
    expect(result).toBe('tenant-abc');
  });

  it('converts number tenant ID to string', () => {
    const req = { user: { lastLoggedInTenant: 42 } };
    const result = lastLoggedInTenant(req as never);
    expect(result).toBe('42');
  });

  it('extracts id from tenant object', () => {
    const req = { user: { lastLoggedInTenant: { id: 'tenant-xyz' } } };
    const result = lastLoggedInTenant(req as never);
    expect(result).toBe('tenant-xyz');
  });

  it('converts numeric id from tenant object to string', () => {
    const req = { user: { lastLoggedInTenant: { id: 7 } } };
    const result = lastLoggedInTenant(req as never);
    expect(result).toBe('7');
  });

  it('returns null when tenant object has no id', () => {
    const req = { user: { lastLoggedInTenant: { name: 'Acme' } } };
    const result = lastLoggedInTenant(req as never);
    expect(result).toBeNull();
  });

  it('returns null when tenant object has null id', () => {
    const req = { user: { lastLoggedInTenant: { id: null } } };
    const result = lastLoggedInTenant(req as never);
    expect(result).toBeNull();
  });

  it('returns null when lastLoggedInTenant is undefined', () => {
    const req = { user: { id: '1' } };
    const result = lastLoggedInTenant(req as never);
    expect(result).toBeNull();
  });

  it('returns null when lastLoggedInTenant is null', () => {
    const req = { user: { lastLoggedInTenant: null } };
    const result = lastLoggedInTenant(req as never);
    expect(result).toBeNull();
  });
});

// ─── hasRole ────────────────────────────────────────────────────────────────────

describe('hasRole', () => {
  it('returns false for null user', () => {
    expect(hasRole(null, [Role.UserAdmin])).toBe(false);
  });

  it('returns false for undefined user', () => {
    expect(hasRole(undefined, [Role.UserAdmin])).toBe(false);
  });

  it('returns false when user has no roles', () => {
    expect(hasRole({ id: '1' }, [Role.UserAdmin])).toBe(false);
  });

  it('matches role in roles array', () => {
    const user = { id: '1', roles: [Role.UserAdmin] };
    expect(hasRole(user, [Role.UserAdmin])).toBe(true);
  });

  it('matches role in globalRoles array', () => {
    const user = { id: '1', globalRoles: [Role.UserSuperAdmin] };
    expect(hasRole(user, [Role.UserSuperAdmin])).toBe(true);
  });

  it('prefers globalRoles over roles', () => {
    const user = {
      id: '1',
      globalRoles: [Role.UserSuperAdmin],
      roles: [Role.Viewer],
    };
    expect(hasRole(user, [Role.UserSuperAdmin])).toBe(true);
    expect(hasRole(user, [Role.Viewer])).toBe(false);
  });

  it('matches any role from the check list', () => {
    const user = { id: '1', roles: [Role.ContentManager] };
    expect(hasRole(user, [Role.UserAdmin, Role.ContentManager])).toBe(true);
  });

  it('returns false when no roles match', () => {
    const user = { id: '1', roles: [Role.Viewer] };
    expect(hasRole(user, [Role.UserAdmin, Role.UserSuperAdmin])).toBe(false);
  });

  it('returns false when roles is not an array', () => {
    const user = { id: '1', roles: 'admin' as never };
    expect(hasRole(user, [Role.UserAdmin])).toBe(false);
  });
});
