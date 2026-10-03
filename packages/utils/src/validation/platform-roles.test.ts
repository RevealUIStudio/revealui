import { describe, expect, it } from 'vitest';
import {
  canAdministerAllContent,
  canManageSiteContent,
  isPlatformSuperAdmin,
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
