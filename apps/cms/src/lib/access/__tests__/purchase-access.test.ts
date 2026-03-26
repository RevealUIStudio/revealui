/**
 * Purchase Access Control Tests
 *
 * Tests for field-level access checks that gate content behind purchases:
 * - Prices/checkUserPurchases: price-level purchase verification
 * - Products/checkUserPurchases: product-level purchase verification
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../permissions/roles';

// ─── Prices ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/access/roles/hasRole', () => ({
  hasRole: vi.fn(),
}));

vi.mock('@/lib/utils/type-guards', () => ({
  asDocument: <T>(val: T) => val,
}));

describe('Prices/checkUserPurchases', () => {
  let hasRole: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../roles/hasRole');
    hasRole = mod.hasRole as unknown as ReturnType<typeof vi.fn>;
  });

  async function loadFn() {
    const mod = await import('../../collections/Prices/access/checkUserPurchases.js');
    return mod.checkUserPurchases;
  }

  it('denies when no user', async () => {
    const fn = await loadFn();
    const result = await fn({ req: {}, data: { id: 1 } } as never);
    expect(result).toBe(false);
  });

  it('allows super admin', async () => {
    hasRole.mockReturnValue(true);
    const fn = await loadFn();
    const user = { id: '1', roles: [Role.UserSuperAdmin], purchases: [] };
    const result = await fn({ req: { user }, data: { id: 1 } } as never);
    expect(result).toBe(true);
    expect(hasRole).toHaveBeenCalledWith(user, [Role.UserSuperAdmin, Role.UserAdmin]);
  });

  it('allows user admin', async () => {
    hasRole.mockReturnValue(true);
    const fn = await loadFn();
    const user = { id: '1', roles: [Role.UserAdmin], purchases: [] };
    const result = await fn({ req: { user }, data: { id: 1 } } as never);
    expect(result).toBe(true);
  });

  it('allows when user has matching purchase', async () => {
    hasRole.mockReturnValue(false);
    const fn = await loadFn();
    const user = { id: '1', roles: [], purchases: [{ id: 42 }] };
    const result = await fn({ req: { user }, data: { id: 42 } } as never);
    expect(result).toBe(true);
  });

  it('denies when user has no matching purchase', async () => {
    hasRole.mockReturnValue(false);
    const fn = await loadFn();
    const user = { id: '1', roles: [], purchases: [{ id: 99 }] };
    const result = await fn({ req: { user }, data: { id: 42 } } as never);
    expect(result).toBe(false);
  });

  it('denies when user has empty purchases array', async () => {
    hasRole.mockReturnValue(false);
    const fn = await loadFn();
    const user = { id: '1', roles: [], purchases: [] };
    const result = await fn({ req: { user }, data: { id: 1 } } as never);
    expect(result).toBe(false);
  });

  it('denies when doc is undefined', async () => {
    hasRole.mockReturnValue(false);
    const fn = await loadFn();
    const user = { id: '1', roles: [], purchases: [{ id: 1 }] };
    const result = await fn({ req: { user }, data: undefined } as never);
    expect(result).toBe(false);
  });
});

// ─── Products ───────────────────────────────────────────────────────────────────

describe('Products/checkUserPurchases', () => {
  let hasRole: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../roles/hasRole');
    hasRole = mod.hasRole as unknown as ReturnType<typeof vi.fn>;
  });

  async function loadFn() {
    const mod = await import('../../collections/Products/access/checkUserPurchases.js');
    return mod.checkUserPurchases;
  }

  it('denies when no user', async () => {
    const fn = await loadFn();
    const result = await fn({ req: {}, data: { id: '1' } } as never);
    expect(result).toBe(false);
  });

  it('denies when user has no purchases property', async () => {
    hasRole.mockReturnValue(false);
    const fn = await loadFn();
    const user = { id: '1', roles: [] };
    const result = await fn({ req: { user }, data: { id: '1' } } as never);
    expect(result).toBe(false);
  });

  it('allows super admin with purchases', async () => {
    hasRole.mockReturnValue(true);
    const fn = await loadFn();
    const user = { id: '1', roles: [Role.UserSuperAdmin], purchases: [] };
    const result = await fn({ req: { user }, data: { id: '1' } } as never);
    expect(result).toBe(true);
  });

  it('allows when user has matching purchase', async () => {
    hasRole.mockReturnValue(false);
    const fn = await loadFn();
    const user = { id: '1', roles: [], purchases: [{ id: 'prod-42' }] };
    const result = await fn({ req: { user }, data: { id: 'prod-42' } } as never);
    expect(result).toBe(true);
  });

  it('denies when user has non-matching purchases', async () => {
    hasRole.mockReturnValue(false);
    const fn = await loadFn();
    const user = { id: '1', roles: [], purchases: [{ id: 'prod-99' }] };
    const result = await fn({ req: { user }, data: { id: 'prod-42' } } as never);
    expect(result).toBe(false);
  });

  it('denies when purchases is not an array', async () => {
    hasRole.mockReturnValue(false);
    const fn = await loadFn();
    const user = { id: '1', roles: [], purchases: 'invalid' };
    const result = await fn({ req: { user }, data: { id: '1' } } as never);
    expect(result).toBe(false);
  });
});
