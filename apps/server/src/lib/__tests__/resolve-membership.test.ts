/**
 * resolveActiveMembership (GAP-477 Phase C)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/db/schema', () => ({
  accountMemberships: {
    accountId: 'accountId',
    role: 'role',
    userId: 'userId',
    status: 'status',
    createdAt: 'createdAt',
  },
  accounts: {
    id: 'id',
    slug: 'slug',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  asc: (x: unknown) => x,
  eq: (...args: unknown[]) => args,
  or: (...args: unknown[]) => args,
}));

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

function chain() {
  const c = {
    select: mockSelect,
    from: mockFrom,
    innerJoin: mockInnerJoin,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
  };
  mockSelect.mockReturnValue(c);
  mockFrom.mockReturnValue(c);
  mockInnerJoin.mockReturnValue(c);
  mockWhere.mockReturnValue(c);
  mockOrderBy.mockReturnValue(c);
  return c;
}

describe('resolveActiveMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain();
  });

  it('returns preferred membership when user is a member', async () => {
    mockLimit.mockResolvedValueOnce([{ accountId: 'acct-preferred', role: 'owner' }]);
    const { resolveActiveMembership } = await import('../resolve-membership.js');
    const db = { select: mockSelect } as never;

    const result = await resolveActiveMembership(db, 'user-1', 'acct-preferred');
    expect(result).toEqual({ accountId: 'acct-preferred', role: 'owner' });
    expect(mockInnerJoin).toHaveBeenCalled();
  });

  it('falls back to oldest active membership when preferred misses', async () => {
    mockLimit
      .mockResolvedValueOnce([]) // preferred miss
      .mockResolvedValueOnce([{ accountId: 'acct-old', role: 'member' }]);
    const { resolveActiveMembership } = await import('../resolve-membership.js');
    const db = { select: mockSelect } as never;

    const result = await resolveActiveMembership(db, 'user-1', 'missing-slug');
    expect(result).toEqual({ accountId: 'acct-old', role: 'member' });
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it('returns null when user has no active membership', async () => {
    mockLimit.mockResolvedValueOnce([]);
    const { resolveActiveMembership } = await import('../resolve-membership.js');
    const db = { select: mockSelect } as never;

    const result = await resolveActiveMembership(db, 'user-1', null);
    expect(result).toBeNull();
  });
});
