import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dependency chain before importing
vi.mock('@/lib/access/roles/hasRole', () => ({
  hasRole: vi.fn(),
}));

import { hasRole } from '@/lib/access/roles/hasRole';
import { adminsOrOrderedBy } from '@/lib/collections/Orders/access/adminsOrOrderedBy';

const mockHasRole = vi.mocked(hasRole);

describe('adminsOrOrderedBy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when no user is present', () => {
    const result = adminsOrOrderedBy({ req: {} });
    expect(result).toBe(false);
  });

  it('returns false when user is null', () => {
    const result = adminsOrOrderedBy({ req: { user: null } });
    expect(result).toBe(false);
  });

  it('returns true for tenant super admins', () => {
    mockHasRole.mockReturnValue(true);

    const user = { id: 'admin-1', globalRoles: ['tenant-super-admin'] };
    const result = adminsOrOrderedBy({ req: { user } });

    expect(result).toBe(true);
    expect(mockHasRole).toHaveBeenCalled();
  });

  it('returns a query filter for non-admin users', () => {
    mockHasRole.mockReturnValue(false);

    const user = { id: 'user-1', roles: ['user'] };
    const result = adminsOrOrderedBy({ req: { user } });

    expect(result).toEqual({
      orderedBy: {
        equals: 'user-1',
      },
    });
  });

  it('returns query filter with numeric user id', () => {
    mockHasRole.mockReturnValue(false);

    const user = { id: 42, roles: ['user'] };
    const result = adminsOrOrderedBy({ req: { user } });

    expect(result).toEqual({
      orderedBy: {
        equals: 42,
      },
    });
  });
});
