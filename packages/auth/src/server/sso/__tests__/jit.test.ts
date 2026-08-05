import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelectResults: unknown[][] = [];
const insertValuesSpy = vi.fn();
const updateSetSpy = vi.fn();

function createMockDb() {
  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => mockSelectResults.shift() ?? []),
        }),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: insertValuesSpy.mockResolvedValue(undefined),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: updateSetSpy.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  };
}

const mockDb = createMockDb();

vi.mock('@revealui/db/client', () => ({
  getClient: () => mockDb,
}));

vi.mock('@revealui/db/schema', () => ({
  users: {
    id: 'id',
    email: 'email',
    deletedAt: 'deletedAt',
    name: 'name',
    password: 'password',
    role: 'role',
  },
  ssoIdentities: {
    id: 'id',
    providerId: 'providerId',
    subject: 'subject',
    userId: 'userId',
    email: 'email',
    updatedAt: 'updatedAt',
  },
  accountMemberships: {
    id: 'id',
    accountId: 'accountId',
    userId: 'userId',
    role: 'role',
    status: 'status',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: string, val: string) => ({ col, val })),
  and: vi.fn((...conditions: unknown[]) => ({ and: conditions })),
  isNull: vi.fn((col: string) => ({ isNull: col })),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { normalizeSsoUserRole, upsertSsoUser } from '../jit.js';

describe('normalizeSsoUserRole', () => {
  it('maps member to viewer for users.role allowlist', () => {
    expect(normalizeSsoUserRole('member')).toBe('viewer');
  });

  it('keeps explicitly mapped admin', () => {
    expect(normalizeSsoUserRole('admin')).toBe('admin');
  });

  it('fails closed to viewer for unknown roles (never admin)', () => {
    expect(normalizeSsoUserRole('superuser')).toBe('viewer');
    expect(normalizeSsoUserRole('')).toBe('viewer');
  });
});

describe('upsertSsoUser', () => {
  beforeEach(() => {
    mockSelectResults.length = 0;
    insertValuesSpy.mockClear();
    updateSetSpy.mockClear();
    vi.clearAllMocks();
  });

  it('returns existing user when sso_identity already linked', async () => {
    const existingUser = {
      id: 'user-1',
      email: 'a@example.com',
      name: 'A',
      role: 'viewer',
    };
    // identity lookup
    mockSelectResults.push([{ id: 'ident-1', userId: 'user-1', email: 'a@example.com' }]);
    // user lookup
    mockSelectResults.push([existingUser]);
    // membership exists
    mockSelectResults.push([{ id: 'mem-1' }]);

    const user = await upsertSsoUser({
      providerId: 'prov-1',
      accountId: 'acct-1',
      subject: 'sub-1',
      email: 'a@example.com',
      emailVerified: true,
      role: 'member',
    });

    expect(user.id).toBe('user-1');
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });

  it('links by verified email and inserts identity + membership', async () => {
    // no identity
    mockSelectResults.push([]);
    // user by email
    mockSelectResults.push([{ id: 'user-2', email: 'b@example.com', name: 'B', role: 'editor' }]);
    // membership missing
    mockSelectResults.push([]);
    // final user fetch
    mockSelectResults.push([{ id: 'user-2', email: 'b@example.com', name: 'B', role: 'editor' }]);

    const user = await upsertSsoUser({
      providerId: 'prov-1',
      accountId: 'acct-1',
      subject: 'sub-2',
      email: 'b@example.com',
      emailVerified: true,
      role: 'editor',
    });

    expect(user.id).toBe('user-2');
    // identity insert + membership insert
    expect(insertValuesSpy).toHaveBeenCalled();
    const inserts = insertValuesSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    expect(inserts.some((v) => v.subject === 'sub-2' && v.userId === 'user-2')).toBe(true);
    expect(inserts.some((v) => v.accountId === 'acct-1' && v.role === 'member')).toBe(true);
  });

  it('does not link by email when emailVerified is not true', async () => {
    // identity empty; no email lookup; membership empty; final user fetch
    mockSelectResults.push([]);
    mockSelectResults.push([]);
    mockSelectResults.push([{ id: 'new-user', email: 'c@example.com', name: 'C', role: 'viewer' }]);

    const user = await upsertSsoUser({
      providerId: 'prov-1',
      accountId: 'acct-1',
      subject: 'sub-3',
      email: 'c@example.com',
      emailVerified: false,
      name: 'C',
      role: 'member',
    });

    expect(user.id).toBe('new-user');
    const userInserts = insertValuesSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((v) => v.password === null && v.name === 'C');
    expect(userInserts.length).toBe(1);
    expect(userInserts[0]?.role).toBe('viewer');
    expect(userInserts[0]?.emailVerified).toBe(false);
  });

  it('creates user with null password and never defaults role to admin', async () => {
    mockSelectResults.push([]); // identity
    mockSelectResults.push([]); // membership
    mockSelectResults.push([{ id: 'new', role: 'viewer', password: null }]); // final

    await upsertSsoUser({
      providerId: 'prov-1',
      accountId: 'acct-1',
      subject: 'sub-4',
      name: 'NoEmail',
      role: 'bogus-admin-like',
    });

    const userInsert = insertValuesSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((v) => v.password === null && v.name === 'NoEmail');
    expect(userInsert).toBeDefined();
    expect(userInsert?.role).toBe('viewer');
    expect(userInsert?.password).toBeNull();
  });
});
