import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dependency chain before importing
vi.mock('@/lib/access/roles/hasRole', () => ({
  hasRole: vi.fn(),
}));

import { hasRole } from '@/lib/access/roles/hasRole';
import {
  adminsOrCustomer,
  adminsOrOwnOrderCreate,
} from '@/lib/collections/Orders/access/adminsOrCustomer';

const mockHasRole = vi.mocked(hasRole);

describe('adminsOrCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when no user is present', () => {
    const result = adminsOrCustomer({ req: {} });
    expect(result).toBe(false);
  });

  it('returns false when user is null', () => {
    const result = adminsOrCustomer({ req: { user: null } });
    expect(result).toBe(false);
  });

  it('returns true for tenant super admins', () => {
    mockHasRole.mockReturnValue(true);

    const user = { id: 'admin-1', globalRoles: ['tenant-super-admin'] };
    const result = adminsOrCustomer({ req: { user } });

    expect(result).toBe(true);
    expect(mockHasRole).toHaveBeenCalled();
  });

  it('returns a customer ID filter for non-admin users', () => {
    mockHasRole.mockReturnValue(false);

    const user = { id: 'user-1', roles: ['user'] };
    const result = adminsOrCustomer({ req: { user } });

    expect(result).toEqual({
      customerId: {
        equals: 'user-1',
      },
    });
  });

  it('rejects the legacy numeric identity for text-keyed orders', () => {
    mockHasRole.mockReturnValue(false);

    const user = { id: 42, roles: ['user'] };
    const result = adminsOrCustomer({ req: { user } });

    expect(result).toBe(false);
  });

  it('allows customers to create orders only for their own customer ID', () => {
    mockHasRole.mockReturnValue(false);

    expect(
      adminsOrOwnOrderCreate({ req: { user: { id: 'user-1' } }, data: { customerId: 'user-1' } }),
    ).toBe(true);
    expect(
      adminsOrOwnOrderCreate({ req: { user: { id: 'user-1' } }, data: { customerId: 'user-2' } }),
    ).toBe(false);
    expect(adminsOrOwnOrderCreate({ req: { user: { id: 'user-1' } }, data: {} })).toBe(false);
  });

  it('allows tenant super admins to create orders for any customer', () => {
    mockHasRole.mockReturnValue(true);

    expect(
      adminsOrOwnOrderCreate({ req: { user: { id: 'admin-1' } }, data: { customerId: 'user-1' } }),
    ).toBe(true);
  });
});
