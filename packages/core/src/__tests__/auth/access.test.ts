import { describe, expect, it } from 'vitest';
import {
  anyone,
  authenticated,
  hasAnyRole,
  hasRole,
  isAdmin,
  isSuperAdmin,
} from '../../auth/access.js';

const noUser = { req: {} };
const nullUser = { req: { user: null } };
const anonUser = { req: { user: { id: '1', email: 'a@b.com' } } };
const userWithRoles = (roles: string[]) => ({
  req: { user: { id: '1', email: 'u@b.com', roles } },
});

describe('access control functions', () => {
  describe('anyone', () => {
    it('returns true regardless of user', () => {
      expect(anyone(noUser)).toBe(true);
      expect(anyone(nullUser)).toBe(true);
      expect(anyone(userWithRoles(['admin']))).toBe(true);
    });
  });

  describe('authenticated', () => {
    it('returns false when no user', () => {
      expect(authenticated(noUser)).toBe(false);
      expect(authenticated(nullUser)).toBe(false);
    });

    it('returns true when user exists', () => {
      expect(authenticated(anonUser)).toBe(true);
    });
  });

  describe('isAdmin', () => {
    it('returns false without user', () => {
      expect(isAdmin(noUser)).toBe(false);
    });

    it('returns false without admin role', () => {
      expect(isAdmin(userWithRoles(['editor']))).toBe(false);
    });

    it('returns true with admin role', () => {
      expect(isAdmin(userWithRoles(['admin']))).toBe(true);
    });

    it('returns true when admin is one of many roles', () => {
      expect(isAdmin(userWithRoles(['editor', 'admin', 'viewer']))).toBe(true);
    });

    it('treats owner and super-admin as admin', () => {
      expect(isAdmin(userWithRoles(['owner']))).toBe(true);
      expect(isAdmin(userWithRoles(['super-admin']))).toBe(true);
    });

    it('denies an unauthenticated subject', () => {
      expect(isAdmin(nullUser)).toBe(false);
    });
  });

  describe('isSuperAdmin', () => {
    it('returns false without super-admin role', () => {
      expect(isSuperAdmin(userWithRoles(['admin']))).toBe(false);
    });

    it('returns true with super-admin role', () => {
      expect(isSuperAdmin(userWithRoles(['super-admin']))).toBe(true);
    });

    it('does not treat shell owner as super-admin', () => {
      expect(isSuperAdmin(userWithRoles(['owner']))).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('returns a function', () => {
      expect(typeof hasRole('editor')).toBe('function');
    });

    it('returns false without user', () => {
      expect(hasRole('editor')(noUser)).toBe(false);
    });

    it('returns false when role not present', () => {
      expect(hasRole('editor')(userWithRoles(['viewer']))).toBe(false);
    });

    it('returns true when role present', () => {
      expect(hasRole('editor')(userWithRoles(['editor']))).toBe(true);
    });

    it('lets owner satisfy an admin check and not an editor check', () => {
      expect(hasRole('admin')(userWithRoles(['owner']))).toBe(true);
      expect(hasRole('super-admin')(userWithRoles(['owner']))).toBe(true);
      expect(hasRole('editor')(userWithRoles(['owner']))).toBe(false);
      expect(hasRole('owner')(userWithRoles(['super-admin']))).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('returns false without user', () => {
      expect(hasAnyRole(['admin', 'editor'])(noUser)).toBe(false);
    });

    it('returns false when no matching roles', () => {
      expect(hasAnyRole(['admin', 'editor'])(userWithRoles(['viewer']))).toBe(false);
    });

    it('returns true when at least one role matches', () => {
      expect(hasAnyRole(['admin', 'editor'])(userWithRoles(['editor']))).toBe(true);
    });

    it('returns false with empty roles array', () => {
      expect(hasAnyRole([])(userWithRoles(['admin']))).toBe(false);
    });

    it('returns false when user has no roles', () => {
      expect(hasAnyRole(['admin'])(anonUser)).toBe(false);
    });
  });
});
