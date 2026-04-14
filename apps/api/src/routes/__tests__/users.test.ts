/**
 * User Route Tests (T-05)
 *
 * Covers role escalation prevention, self-deletion guard,
 * sensitive field stripping, and auth enforcement for all
 * user management endpoints.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockUserQueries } = vi.hoisted(() => ({
  mockUserQueries: {
    getAllUsers: vi.fn(),
    countUsers: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

vi.mock('@revealui/db/queries/users', () => mockUserQueries);

// ─── Import under test ───────────────────────────────────────────────────────

import usersApp from '../content/users.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserCtx {
  id: string;
  role: string;
  email?: string;
}

const ADMIN: UserCtx = { id: 'admin-1', role: 'admin', email: 'admin@test.com' };
const USER_A: UserCtx = { id: 'user-a', role: 'user' };

function createApp(user: UserCtx | null = ADMIN) {
  const app = new Hono<{ Variables: { user: UserCtx | undefined; db: unknown } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('db', {});
    await next();
  });
  app.route('/', usersApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-a',
    name: 'Alice',
    email: 'alice@example.com',
    avatarUrl: null,
    type: 'user',
    role: 'user',
    status: 'active',
    emailVerified: true,
    mfaEnabled: false,
    stripeCustomerId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    lastActiveAt: null,
    // Sensitive fields that should NEVER appear in responses
    password: '$2b$12$hashed_password_value',
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    mfaBackupCodes: '["code1","code2"]',
    emailVerificationToken: 'verify-token-abc',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /users  -  list (admin-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated request', async () => {
    const app = createApp(null);
    const res = await app.request('/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/users');
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated users for admin', async () => {
    mockUserQueries.getAllUsers.mockResolvedValue([makeUser()]);
    mockUserQueries.countUsers.mockResolvedValue(1);

    const app = createApp(ADMIN);
    const res = await app.request('/users');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalDocs).toBe(1);
    expect(body.docs).toHaveLength(1);
  });

  it('never includes sensitive fields in list response', async () => {
    mockUserQueries.getAllUsers.mockResolvedValue([makeUser()]);
    mockUserQueries.countUsers.mockResolvedValue(1);

    const app = createApp(ADMIN);
    const res = await app.request('/users');
    const body = await res.json();
    const user = body.docs[0];

    expect(user.password).toBeUndefined();
    expect(user.mfaSecret).toBeUndefined();
    expect(user.mfaBackupCodes).toBeUndefined();
    expect(user.emailVerificationToken).toBeUndefined();
  });
});

describe('GET /users/:id  -  get single user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated request', async () => {
    const app = createApp(null);
    const res = await app.request('/users/user-a');
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin accesses another user', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/users/user-b');
    expect(res.status).toBe(403);
  });

  it('allows non-admin to view own profile', async () => {
    mockUserQueries.getUserById.mockResolvedValue(makeUser({ id: 'user-a' }));

    const app = createApp(USER_A);
    const res = await app.request('/users/user-a');
    expect(res.status).toBe(200);
  });

  it('allows admin to view any user', async () => {
    mockUserQueries.getUserById.mockResolvedValue(makeUser({ id: 'user-b' }));

    const app = createApp(ADMIN);
    const res = await app.request('/users/user-b');
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent user', async () => {
    mockUserQueries.getUserById.mockResolvedValue(null);

    const app = createApp(ADMIN);
    const res = await app.request('/users/nonexistent');
    expect(res.status).toBe(404);
  });

  it('never includes sensitive fields in response', async () => {
    mockUserQueries.getUserById.mockResolvedValue(makeUser());

    const app = createApp(ADMIN);
    const res = await app.request('/users/user-a');
    const body = await res.json();

    expect(body.data.password).toBeUndefined();
    expect(body.data.mfaSecret).toBeUndefined();
    expect(body.data.mfaBackupCodes).toBeUndefined();
    expect(body.data.emailVerificationToken).toBeUndefined();
  });
});

describe('PATCH /users/:id  -  role escalation prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserQueries.getUserById.mockResolvedValue(makeUser({ id: 'user-a' }));
    mockUserQueries.updateUser.mockResolvedValue(makeUser({ id: 'user-a' }));
  });

  it('returns 401 for unauthenticated request', async () => {
    const app = createApp(null);
    const res = await app.request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin tries to change own role', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('admin');
  });

  it('returns 403 when non-admin tries to change own status', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 when non-admin tries to change another user', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/users/user-b', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    expect(res.status).toBe(403);
  });

  it('allows admin to change user role', async () => {
    mockUserQueries.updateUser.mockResolvedValue(makeUser({ role: 'admin' }));

    const app = createApp(ADMIN);
    const res = await app.request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(200);
  });

  it('allows non-admin to update own name', async () => {
    mockUserQueries.updateUser.mockResolvedValue(makeUser({ name: 'New Name' }));

    const app = createApp(USER_A);
    const res = await app.request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });
    expect(res.status).toBe(200);
  });

  it('strips sensitive fields from PATCH body (password)', async () => {
    mockUserQueries.updateUser.mockResolvedValue(makeUser());

    const app = createApp(ADMIN);
    await app.request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'OK', password: 'hacked123' }),
    });

    // updateUser should NOT receive the password field
    const passedData = mockUserQueries.updateUser.mock.calls[0]?.[2];
    expect(passedData).not.toHaveProperty('password');
  });

  it('strips sensitive fields from PATCH body (mfaSecret)', async () => {
    mockUserQueries.updateUser.mockResolvedValue(makeUser());

    const app = createApp(ADMIN);
    await app.request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'OK', mfaSecret: 'evil-secret' }),
    });

    const passedData = mockUserQueries.updateUser.mock.calls[0]?.[2];
    expect(passedData).not.toHaveProperty('mfaSecret');
  });

  it('never includes sensitive fields in PATCH response', async () => {
    mockUserQueries.updateUser.mockResolvedValue(makeUser());

    const app = createApp(ADMIN);
    const res = await app.request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const body = await res.json();

    expect(body.data.password).toBeUndefined();
    expect(body.data.mfaSecret).toBeUndefined();
    expect(body.data.mfaBackupCodes).toBeUndefined();
    expect(body.data.emailVerificationToken).toBeUndefined();
  });
});

describe('DELETE /users/:id  -  self-deletion prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserQueries.getUserById.mockResolvedValue(makeUser({ id: 'user-a' }));
    mockUserQueries.deleteUser.mockResolvedValue(undefined);
  });

  it('returns 401 for unauthenticated request', async () => {
    const app = createApp(null);
    const res = await app.request('/users/user-a', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/users/user-b', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when admin tries to delete themselves', async () => {
    const app = createApp(ADMIN);
    const res = await app.request('/users/admin-1', { method: 'DELETE' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Cannot delete your own account');
  });

  it('allows admin to delete another user', async () => {
    const app = createApp(ADMIN);
    const res = await app.request('/users/user-a', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockUserQueries.deleteUser).toHaveBeenCalledWith({}, 'user-a');
  });

  it('returns 404 when deleting non-existent user', async () => {
    mockUserQueries.getUserById.mockResolvedValue(null);

    const app = createApp(ADMIN);
    const res = await app.request('/users/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('admin role variations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserQueries.getAllUsers.mockResolvedValue([]);
    mockUserQueries.countUsers.mockResolvedValue(0);
  });

  const adminRoles = ['admin', 'super-admin', 'admin', 'super-admin'];

  for (const role of adminRoles) {
    it(`grants admin access for role: ${role}`, async () => {
      const app = createApp({ id: 'admin-x', role });
      const res = await app.request('/users');
      expect(res.status).toBe(200);
    });
  }

  it('denies access for non-admin roles', async () => {
    const nonAdminRoles = ['user', 'editor', 'viewer', 'moderator', 'contributor'];
    for (const role of nonAdminRoles) {
      const app = createApp({ id: 'user-x', role });
      const res = await app.request('/users');
      expect(res.status).toBe(403);
    }
  });
});
