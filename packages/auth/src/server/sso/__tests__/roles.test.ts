import { describe, expect, it } from 'vitest';
import { extractGroupsFromClaim, mapSsoGroupsToRole } from '../roles.js';

describe('extractGroupsFromClaim', () => {
  it('reads string array groups', () => {
    expect(extractGroupsFromClaim({ groups: ['Eng', 'Admins'] }, 'groups')).toEqual([
      'Eng',
      'Admins',
    ]);
  });

  it('reads a single string group', () => {
    expect(extractGroupsFromClaim({ groups: 'Engineering' }, 'groups')).toEqual(['Engineering']);
  });

  it('splits comma/space separated strings', () => {
    expect(extractGroupsFromClaim({ groups: 'a, b, c' }, 'groups')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty for missing claim', () => {
    expect(extractGroupsFromClaim({}, 'groups')).toEqual([]);
  });

  it('uses custom group claim key', () => {
    expect(extractGroupsFromClaim({ memberOf: ['X'] }, 'memberOf')).toEqual(['X']);
  });
});

describe('mapSsoGroupsToRole', () => {
  const base = {
    groupClaim: 'groups',
    groupRoleMap: {
      Engineering: 'member',
      'IdP-Admins': 'admin',
      Viewers: 'viewer',
    } as Record<string, string>,
    defaultRole: 'member',
    requireGroupMatch: false,
  };

  it('uses default_role when no groups present', () => {
    const result = mapSsoGroupsToRole({ ...base, claims: {} });
    expect(result).toEqual({
      ok: true,
      role: 'member',
      matchedGroups: [],
      groups: [],
    });
  });

  it('maps a single matching group', () => {
    const result = mapSsoGroupsToRole({
      ...base,
      claims: { groups: ['Engineering'] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('member');
      expect(result.matchedGroups).toEqual(['Engineering']);
    }
  });

  it('picks highest privilege when multiple groups map', () => {
    const result = mapSsoGroupsToRole({
      ...base,
      claims: { groups: ['Viewers', 'IdP-Admins', 'Engineering'] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('admin');
      expect(result.matchedGroups).toEqual(['Viewers', 'IdP-Admins', 'Engineering']);
    }
  });

  it('ignores unmapped groups and uses default_role (never admin from unmapped)', () => {
    const result = mapSsoGroupsToRole({
      ...base,
      claims: { groups: ['SuperUsers', 'Domain Admins', 'random-unmapped'] },
      defaultRole: 'viewer',
    });
    expect(result).toMatchObject({
      ok: true,
      role: 'viewer',
      matchedGroups: [],
    });
    // Explicit: role is default, not admin, despite privileged-looking IdP group names
    if (result.ok) {
      expect(result.role).not.toBe('admin');
    }
  });

  it('never grants admin solely because an unmapped group looks privileged', () => {
    const result = mapSsoGroupsToRole({
      groupClaim: 'groups',
      groupRoleMap: {},
      defaultRole: 'member',
      requireGroupMatch: false,
      claims: { groups: ['admin', 'Administrators', 'Global-Admins'] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('member');
      expect(result.role).not.toBe('admin');
      expect(result.matchedGroups).toEqual([]);
    }
  });

  it('rejects when require_group_match and no map hits', () => {
    const result = mapSsoGroupsToRole({
      ...base,
      requireGroupMatch: true,
      claims: { groups: ['Unmapped-Group'] },
    });
    expect(result).toMatchObject({
      ok: false,
      reason: 'require_group_match',
      groups: ['Unmapped-Group'],
    });
  });

  it('rejects when require_group_match and groups claim missing', () => {
    const result = mapSsoGroupsToRole({
      ...base,
      requireGroupMatch: true,
      claims: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('require_group_match');
    }
  });

  it('allows map hit when require_group_match is true', () => {
    const result = mapSsoGroupsToRole({
      ...base,
      requireGroupMatch: true,
      claims: { groups: ['Engineering', 'noise'] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('member');
      expect(result.matchedGroups).toEqual(['Engineering']);
    }
  });

  it('allows explicit map to admin (intentional config)', () => {
    const result = mapSsoGroupsToRole({
      ...base,
      claims: { groups: ['IdP-Admins'] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('admin');
    }
  });

  it('fails closed on empty default_role', () => {
    const result = mapSsoGroupsToRole({
      ...base,
      defaultRole: '',
      claims: {},
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_default_role' });
  });
});
