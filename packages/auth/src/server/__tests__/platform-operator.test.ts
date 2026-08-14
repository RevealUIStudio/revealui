import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: vi.fn(() => 'live'),
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn((tier: string) => ({
    ai: tier === 'pro' || tier === 'max' || tier === 'enterprise',
    sso: tier === 'enterprise',
  })),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  ensurePlatformOperatorEntitlement,
  isPlatformOperatorUser,
  PLATFORM_OPERATOR_LIMITS,
  rolesFromUserJson,
} from '../platform-operator.js';

describe('rolesFromUserJson', () => {
  it('reads roles from an object', () => {
    expect(rolesFromUserJson({ roles: ['super-admin'] })).toEqual(['super-admin']);
  });

  it('reads roles from a JSON string', () => {
    expect(rolesFromUserJson(JSON.stringify({ roles: ['admin', 'super-admin'] }))).toEqual([
      'admin',
      'super-admin',
    ]);
  });

  it('returns empty for junk', () => {
    expect(rolesFromUserJson(null)).toEqual([]);
    expect(rolesFromUserJson('not-json')).toEqual([]);
    expect(rolesFromUserJson({ roles: 'super-admin' })).toEqual([]);
  });
});

describe('isPlatformOperatorUser', () => {
  it('is true for engine roles super-admin', () => {
    expect(isPlatformOperatorUser({ roles: ['super-admin'] })).toBe(true);
  });

  it('is true for session _json.roles super-admin', () => {
    expect(isPlatformOperatorUser({ _json: { roles: ['super-admin'] } })).toBe(true);
  });

  it('is false for hosted account owners (shell admin only)', () => {
    expect(isPlatformOperatorUser({ roles: ['admin'] })).toBe(false);
    expect(isPlatformOperatorUser({ _json: { roles: ['admin'] } })).toBe(false);
    expect(isPlatformOperatorUser({ role: 'owner' } as { role: string })).toBe(false);
  });

  it('accepts a session user that only has id (middleware shape)', () => {
    expect(isPlatformOperatorUser({ id: 'user-1' })).toBe(false);
  });

  it('is false for null', () => {
    expect(isPlatformOperatorUser(null)).toBe(false);
    expect(isPlatformOperatorUser(undefined)).toBe(false);
  });
});

describe('PLATFORM_OPERATOR_LIMITS', () => {
  it('matches hosted enterprise task budget (unlimited)', () => {
    expect(PLATFORM_OPERATOR_LIMITS).toEqual({ maxAgentTasks: Number.MAX_SAFE_INTEGER });
  });
});

describe('ensurePlatformOperatorEntitlement', () => {
  let selectQueue: unknown[][] = [];

  function enqueue(...batches: unknown[][]): void {
    selectQueue.push(...batches);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue = [];
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockImplementation(() => {
      const rows = selectQueue.shift() ?? [];
      const pending = Promise.resolve(rows);
      return Object.assign(pending, { limit: () => pending });
    });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockInsert.mockReturnValue({ values: mockValues });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockValues.mockResolvedValue(undefined);
  });

  it('skips users who are not super-admin', async () => {
    enqueue([{ id: 'user-1', json: { roles: ['admin'] } }]);

    const result = await ensurePlatformOperatorEntitlement({ userId: 'user-1' });

    expect(result).toEqual({ skipped: true, reason: 'not_platform_operator' });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skips when there is no owner membership', async () => {
    enqueue([{ id: 'user-1', json: { roles: ['super-admin'] } }], []);

    const result = await ensurePlatformOperatorEntitlement({ userId: 'user-1' });

    expect(result).toEqual({ skipped: true, reason: 'no_owner_membership' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('refuses a requested account the operator does not own', async () => {
    enqueue([{ id: 'user-1', json: { roles: ['super-admin'] } }], [{ accountId: 'acct-1' }]);

    const result = await ensurePlatformOperatorEntitlement({
      userId: 'user-1',
      accountId: 'customer-acct',
    });

    expect(result).toEqual({ skipped: true, reason: 'not_owner_workspace' });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('inserts an enterprise grant for a first-time operator', async () => {
    enqueue([{ id: 'user-1', json: { roles: ['super-admin'] } }], [{ accountId: 'acct-1' }], []);

    const result = await ensurePlatformOperatorEntitlement({
      userId: 'user-1',
      now: new Date('2026-08-14T00:00:00.000Z'),
    });

    expect(result).toEqual({ accountId: 'acct-1', wrote: true });
    expect(mockInsert).toHaveBeenCalled();
    const inserted = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.accountId).toBe('acct-1');
    expect(inserted.tier).toBe('enterprise');
    expect(inserted.source).toBe('grant');
    expect(inserted.mode).toBe('live');
    expect((inserted.features as { ai?: boolean }).ai).toBe(true);
    expect((inserted.features as { sso?: boolean }).sso).toBe(true);
    expect(inserted.limits).toEqual(PLATFORM_OPERATOR_LIMITS);
  });

  it('upgrades a free signup row instead of leaving the operator on Free', async () => {
    enqueue(
      [{ id: 'user-1', json: { roles: ['super-admin'] } }],
      [{ accountId: 'acct-1' }],
      [
        {
          tier: 'free',
          status: 'active',
          features: { ai: false },
          lastEventAt: null,
        },
      ],
    );

    const result = await ensurePlatformOperatorEntitlement({ userId: 'user-1' });

    expect(result).toEqual({ accountId: 'acct-1', wrote: true });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    const updated = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updated.tier).toBe('enterprise');
    expect(updated.source).toBe('grant');
    expect((updated.features as { ai?: boolean }).ai).toBe(true);
  });

  it('grants when the requested accountId is an owner workspace', async () => {
    enqueue([{ id: 'user-1', json: { roles: ['super-admin'] } }], [{ accountId: 'acct-1' }], []);

    const result = await ensurePlatformOperatorEntitlement({
      userId: 'user-1',
      accountId: 'acct-1',
    });

    expect(result).toEqual({ accountId: 'acct-1', wrote: true });
    expect(mockInsert).toHaveBeenCalled();
  });

  it('is a no-op when enterprise with ai is already granted', async () => {
    enqueue(
      [{ id: 'user-1', json: { roles: ['super-admin'] } }],
      [{ accountId: 'acct-1' }],
      [
        {
          tier: 'enterprise',
          status: 'active',
          features: { ai: true },
          lastEventAt: new Date(),
        },
      ],
    );

    const result = await ensurePlatformOperatorEntitlement({ userId: 'user-1' });

    expect(result).toEqual({ accountId: 'acct-1', wrote: false });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
