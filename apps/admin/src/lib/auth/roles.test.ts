import { describe, expect, it, vi } from 'vitest';
import { grantSuperAdminRoleById, SUPER_ADMIN_ROLES } from './roles';

/**
 * Builds a minimal Drizzle-shaped stub exercising the
 * select().from().where().limit() read and the update().set().where() write
 * that grantSuperAdminRoleById performs. `existingJson` seeds the row the read
 * returns (undefined → no row / null _json).
 */
function makeDb(existingJson: unknown) {
  const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
  const update = vi.fn(() => ({ set }));
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(existingJson === undefined ? [] : [{ json: existingJson }]),
      }),
    }),
  }));
  const db = { select, update } as unknown as Parameters<typeof grantSuperAdminRoleById>[0];
  return { db, set, update };
}

describe('grantSuperAdminRoleById', () => {
  it('writes _json.roles=[super-admin] for a freshly-created user (empty _json)', async () => {
    // Mirrors the /sign-up first-user path: signUp() inserts with _json='{}',
    // so the grant must populate roles from scratch. This is the founder's bug —
    // the engine gates read _json.roles, which was never set.
    const { db, set } = makeDb({});

    await grantSuperAdminRoleById(db, 'user-1');

    expect(set).toHaveBeenCalledWith({ _json: { roles: ['super-admin'] } });
    expect([...SUPER_ADMIN_ROLES]).toEqual(['super-admin']);
  });

  it('treats a null/absent _json row as empty and still grants the role', async () => {
    const { db, set } = makeDb(undefined);

    await grantSuperAdminRoleById(db, 'user-1');

    expect(set).toHaveBeenCalledWith({ _json: { roles: ['super-admin'] } });
  });

  it('preserves other _json keys when merging the role grant', async () => {
    const { db, set } = makeDb({ preference: 'dark', roles: ['editor'] });

    await grantSuperAdminRoleById(db, 'user-1');

    expect(set).toHaveBeenCalledWith({
      _json: { preference: 'dark', roles: ['editor', 'super-admin'] },
    });
  });

  it('is idempotent — does not duplicate an existing super-admin role', async () => {
    const { db, set } = makeDb({ roles: ['super-admin'] });

    await grantSuperAdminRoleById(db, 'user-1');

    expect(set).toHaveBeenCalledWith({ _json: { roles: ['super-admin'] } });
  });
});
