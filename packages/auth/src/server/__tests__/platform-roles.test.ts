import { describe, expect, it, vi } from 'vitest';
import {
  ensureAccountOwnerPlatformAdmin,
  ensureShellAdminIfAccountOwner,
  isPlatformShellAdminRole,
  PLATFORM_SHELL_ADMIN_ROLES,
  platformRoleForAccountOwner,
  readUsersRole,
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

describe('ensureShellAdminIfAccountOwner', () => {
  function mockDbWithMembership(opts: {
    ownerMembership: boolean;
    user: { id: string; role: string } | null;
  }) {
    const membershipLimit = vi.fn().mockResolvedValue(opts.ownerMembership ? [{ id: 'm1' }] : []);
    const membershipWhere = vi.fn().mockReturnValue({ limit: membershipLimit });
    const membershipFrom = vi.fn().mockReturnValue({ where: membershipWhere });

    const userLimit = vi.fn().mockResolvedValue(opts.user ? [opts.user] : []);
    const userWhere = vi.fn().mockReturnValue({ limit: userLimit });
    const userFrom = vi.fn().mockReturnValue({ where: userWhere });

    let selectCall = 0;
    const select = vi.fn().mockImplementation(() => {
      selectCall += 1;
      // first select: membership; second: user (if owner)
      return { from: selectCall === 1 ? membershipFrom : userFrom };
    });

    const whereUpdate = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: whereUpdate });
    const update = vi.fn().mockReturnValue({ set });

    return { db: { select, update } as never, update, set };
  }

  it('no-ops when user is not an active account owner', async () => {
    const { db, update } = mockDbWithMembership({
      ownerMembership: false,
      user: { id: 'u1', role: 'viewer' },
    });
    const result = await ensureShellAdminIfAccountOwner(db, 'u1');
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('promotes viewer membership owner to admin', async () => {
    const { db, update, set } = mockDbWithMembership({
      ownerMembership: true,
      user: { id: 'u1', role: 'viewer' },
    });
    const result = await ensureShellAdminIfAccountOwner(db, 'u1');
    expect(result).toEqual({ previousRole: 'viewer', nextRole: 'admin', updated: true });
    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ role: 'admin' });
  });

  it('no-ops promote when owner already admin', async () => {
    const { db, update } = mockDbWithMembership({
      ownerMembership: true,
      user: { id: 'u1', role: 'admin' },
    });
    const result = await ensureShellAdminIfAccountOwner(db, 'u1');
    expect(result).toEqual({ previousRole: 'admin', nextRole: 'admin', updated: false });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('readUsersRole', () => {
  it('returns role or null', async () => {
    const limit = vi.fn().mockResolvedValue([{ role: 'admin' }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;
    await expect(readUsersRole(db, 'u1')).resolves.toBe('admin');

    limit.mockResolvedValueOnce([]);
    await expect(readUsersRole(db, 'missing')).resolves.toBeNull();
  });
});
