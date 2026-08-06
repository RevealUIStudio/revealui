import { describe, expect, it, vi } from 'vitest';
import {
  ensureAccountOwnerPlatformAdmin,
  isPlatformShellAdminRole,
  PLATFORM_SHELL_ADMIN_ROLES,
  platformRoleForAccountOwner,
} from '../platform-roles.js';

describe('platformRoleForAccountOwner', () => {
  it('leaves owner and admin unchanged', () => {
    expect(platformRoleForAccountOwner('owner')).toBe('owner');
    expect(platformRoleForAccountOwner('admin')).toBe('admin');
  });

  it('promotes viewer and other non-admin roles to admin', () => {
    expect(platformRoleForAccountOwner('viewer')).toBe('admin');
    expect(platformRoleForAccountOwner('editor')).toBe('admin');
    expect(platformRoleForAccountOwner('contributor')).toBe('admin');
    expect(platformRoleForAccountOwner('agent')).toBe('admin');
  });

  it('never returns super-admin (not a users.role value)', () => {
    expect(platformRoleForAccountOwner('viewer')).not.toBe('super-admin');
    expect(PLATFORM_SHELL_ADMIN_ROLES.has('super-admin')).toBe(false);
  });
});

describe('isPlatformShellAdminRole', () => {
  it('accepts owner, admin, super-admin cookie values', () => {
    expect(isPlatformShellAdminRole('owner')).toBe(true);
    expect(isPlatformShellAdminRole('admin')).toBe(true);
    expect(isPlatformShellAdminRole('super-admin')).toBe(true);
  });

  it('rejects viewer and empty', () => {
    expect(isPlatformShellAdminRole('viewer')).toBe(false);
    expect(isPlatformShellAdminRole(null)).toBe(false);
    expect(isPlatformShellAdminRole(undefined)).toBe(false);
  });
});

describe('ensureAccountOwnerPlatformAdmin', () => {
  function mockDb(existing: { id: string; role: string } | null) {
    const limit = vi.fn().mockResolvedValue(existing ? [existing] : []);
    const whereSelect = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where: whereSelect });
    const select = vi.fn().mockReturnValue({ from });

    const whereUpdate = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: whereUpdate });
    const update = vi.fn().mockReturnValue({ set });

    return {
      db: { select, update } as never,
      select,
      update,
      set,
      whereUpdate,
    };
  }

  it('no-ops when user missing', async () => {
    const { db, update } = mockDb(null);
    const result = await ensureAccountOwnerPlatformAdmin(db, 'missing');
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('no-ops when already admin', async () => {
    const { db, update } = mockDb({ id: 'u1', role: 'admin' });
    const result = await ensureAccountOwnerPlatformAdmin(db, 'u1');
    expect(result).toEqual({ previousRole: 'admin', nextRole: 'admin', updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('promotes viewer to admin', async () => {
    const { db, update, set, whereUpdate } = mockDb({ id: 'u1', role: 'viewer' });
    const result = await ensureAccountOwnerPlatformAdmin(db, 'u1');
    expect(result).toEqual({ previousRole: 'viewer', nextRole: 'admin', updated: true });
    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ role: 'admin' });
    expect(whereUpdate).toHaveBeenCalled();
  });
});
