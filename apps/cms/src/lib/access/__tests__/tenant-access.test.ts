/**
 * Tenant Access Control Tests
 *
 * Tests for tenant-scoped access functions:
 * - isTenantAdminOrSuperAdmin
 * - isUserOrTenant
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../permissions/roles';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const mockFind = vi.fn();

function makeReq(user?: unknown, host = 'acme.example.com') {
  return {
    user,
    revealui: { find: mockFind },
    headers: { get: (key: string) => (key === 'host' ? host : null) },
  } as never;
}

// ─── isTenantAdminOrSuperAdmin ───────────────────────────────────────────────

describe('isTenantAdminOrSuperAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadFn() {
    const mod = await import('../tenants/isTenantAdminOrSuperAdmin.js');
    return mod.isTenantAdminOrSuperAdmin;
  }

  it('denies when no user', async () => {
    const fn = await loadFn();
    const result = await fn({ req: makeReq(undefined) });
    expect(result).toBe(false);
  });

  it('denies when no revealui instance', async () => {
    const fn = await loadFn();
    const result = await fn({ req: { user: { id: '1' }, headers: { get: () => '' } } } as never);
    expect(result).toBe(false);
  });

  it('allows super admin', async () => {
    const fn = await loadFn();
    const user = { id: '1', roles: [Role.UserSuperAdmin] };
    const result = await fn({ req: makeReq(user) });
    expect(result).toBe(true);
  });

  it('allows user with TenantAdmin role', async () => {
    const fn = await loadFn();
    const user = { id: '1', roles: [Role.TenantAdmin] };
    const result = await fn({ req: makeReq(user) });
    expect(result).toBe(true);
  });

  it('allows user with TenantSuperAdmin role', async () => {
    const fn = await loadFn();
    const user = { id: '1', roles: [Role.TenantSuperAdmin] };
    const result = await fn({ req: makeReq(user) });
    expect(result).toBe(true);
  });

  it('allows user who is associated with the tenant by host', async () => {
    const fn = await loadFn();
    const user = {
      id: '1',
      roles: [],
      tenants: [{ tenant: 'tenant-abc', roles: ['viewer'] }],
    };
    mockFind.mockResolvedValue({ docs: [{ id: 'tenant-abc' }] });

    const result = await fn({ req: makeReq(user, 'acme.example.com') });
    expect(result).toBe(true);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        where: { 'domains.domain': { equals: 'acme.example.com' } },
      }),
    );
  });

  it('denies user not associated with the host tenant', async () => {
    const fn = await loadFn();
    const user = {
      id: '1',
      roles: [],
      tenants: [{ tenant: 'tenant-other', roles: ['viewer'] }],
    };
    mockFind.mockResolvedValue({ docs: [{ id: 'tenant-abc' }] });

    const result = await fn({ req: makeReq(user) });
    expect(result).toBe(false);
  });

  it('denies when no tenant found for host', async () => {
    const fn = await loadFn();
    const user = { id: '1', roles: [], tenants: [] };
    mockFind.mockResolvedValue({ docs: [] });

    const result = await fn({ req: makeReq(user) });
    expect(result).toBe(false);
  });

  it('denies user with no tenants array', async () => {
    const fn = await loadFn();
    const user = { id: '1', roles: [] };
    mockFind.mockResolvedValue({ docs: [{ id: 'tenant-abc' }] });

    const result = await fn({ req: makeReq(user) });
    expect(result).toBe(false);
  });
});

// ─── isUserOrTenant ──────────────────────────────────────────────────────────

describe('isUserOrTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadFn() {
    const mod = await import('../roles/isUserOrTenant.js');
    return mod.isUserOrTenant;
  }

  it('denies when no revealui instance', async () => {
    const fn = await loadFn();
    const result = await fn({ req: { user: { id: '1' }, headers: { get: () => '' } } } as never);
    expect(result).toBe(false);
  });

  it('allows super admin', async () => {
    const fn = await loadFn();
    const user = { id: '1', roles: [Role.UserSuperAdmin] };
    const result = await fn({ req: makeReq(user) });
    expect(result).toBe(true);
  });

  it('allows any authenticated user (even without tenant match)', async () => {
    const fn = await loadFn();
    const user = { id: '1', roles: [] };
    mockFind.mockResolvedValue({ docs: [{ id: 'tenant-1' }] });

    const result = await fn({ req: makeReq(user) });
    expect(result).toBe(true);
  });

  it('denies when no tenant found for host and no user', async () => {
    const fn = await loadFn();
    mockFind.mockResolvedValue({ docs: [] });

    const result = await fn({ req: makeReq(undefined) });
    expect(result).toBe(false);
  });
});
