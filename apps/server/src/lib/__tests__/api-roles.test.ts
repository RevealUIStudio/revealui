/**
 * GAP-444 — platform super-admin elevation + hasApiRole semantics.
 */
import { describe, expect, it } from 'vitest';
import { hasApiRole, isPlatformSuperAdmin, type ApiAuthUser } from '../api-roles.js';

function user(partial: Partial<ApiAuthUser> & Pick<ApiAuthUser, 'id' | 'role'>): ApiAuthUser {
  return {
    email: partial.email ?? 'founder@example.com',
    name: partial.name ?? 'Founder',
    emailVerified: partial.emailVerified ?? true,
    _json: partial._json,
    id: partial.id,
    role: partial.role,
  };
}

describe('isPlatformSuperAdmin', () => {
  it('returns true for verified user with super-admin in _json.roles', () => {
    expect(
      isPlatformSuperAdmin(
        user({
          id: 'u1',
          role: 'viewer',
          emailVerified: true,
          _json: { roles: ['super-admin'] },
        }),
      ),
    ).toBe(true);
  });

  it('returns false when email is not verified', () => {
    expect(
      isPlatformSuperAdmin(
        user({
          id: 'u1',
          role: 'viewer',
          emailVerified: false,
          _json: { roles: ['super-admin'] },
        }),
      ),
    ).toBe(false);
  });

  it('returns false without super-admin role marker', () => {
    expect(
      isPlatformSuperAdmin(
        user({
          id: 'u1',
          role: 'admin',
          emailVerified: true,
          _json: { roles: ['tenant-admin'] },
        }),
      ),
    ).toBe(false);
  });

  it('returns false for null/undefined user', () => {
    expect(isPlatformSuperAdmin(null)).toBe(false);
    expect(isPlatformSuperAdmin(undefined)).toBe(false);
  });
});

describe('hasApiRole', () => {
  it('matches the DB role column', () => {
    const admin = user({ id: 'a', role: 'admin' });
    expect(hasApiRole(admin, 'admin')).toBe(true);
    expect(hasApiRole(admin, 'owner')).toBe(false);
  });

  it('elevates super-admin to admin and owner gates only', () => {
    const founder = user({
      id: 'f',
      role: 'viewer',
      emailVerified: true,
      _json: { roles: ['super-admin'] },
    });
    expect(hasApiRole(founder, 'admin')).toBe(true);
    expect(hasApiRole(founder, 'owner')).toBe(true);
    expect(hasApiRole(founder, 'admin', 'owner')).toBe(true);
    expect(hasApiRole(founder, 'editor')).toBe(false);
    expect(hasApiRole(founder, 'agent')).toBe(false);
  });

  it('does not elevate unverified super-admin markers', () => {
    const founder = user({
      id: 'f',
      role: 'viewer',
      emailVerified: false,
      _json: { roles: ['super-admin'] },
    });
    expect(hasApiRole(founder, 'admin', 'owner')).toBe(false);
  });
});
