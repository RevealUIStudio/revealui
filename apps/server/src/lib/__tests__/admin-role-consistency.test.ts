/**
 * Server gates use the same ladder as the admin routes.
 * Owner, super-admin, and admin pass an admin check. Editor and
 * unauthenticated callers do not. Owner-only stays owner-only.
 */

import type { DatabaseClient } from '@revealui/db/client';
import { hasAnyRole, isAdmin, isAdminRole } from '@revealui/utils/validation';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import coordinationApp from '../../routes/admin/coordination.js';
import { hasApiRole } from '../api-roles.js';

interface GateUser {
  id: string;
  role: string;
  emailVerified?: boolean;
  _json?: unknown;
}

const owner: GateUser = { id: 'u', role: 'owner' };
const superAdmin: GateUser = { id: 'u', role: 'super-admin' };
const operator: GateUser = {
  id: 'u',
  role: 'viewer',
  emailVerified: true,
  _json: { roles: ['super-admin'] },
};
const admin: GateUser = { id: 'u', role: 'admin' };
const editor: GateUser = { id: 'u', role: 'editor' };
const endUser: GateUser = { id: 'u', role: 'user' };

const ADMINS = [owner, superAdmin, operator, admin];
const DENIED = [editor, endUser];

function createSelectChain(resolved: unknown): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (value: unknown) => void) => resolve(resolved);
  return chain;
}

function coordination(user: GateUser | null) {
  let callIdx = 0;
  const rows = [[], [{ total: 0 }]];
  const db = {
    select: vi.fn(() => {
      const result = rows[callIdx] ?? [];
      callIdx += 1;
      return createSelectChain(result);
    }),
  } as unknown as DatabaseClient;

  const app = new Hono<{
    Variables: { db: DatabaseClient; user?: GateUser };
  }>();
  app.use('*', async (c, next) => {
    c.set('db', db);
    if (user) c.set('user', user);
    await next();
  });
  app.route('/', coordinationApp);
  return app;
}

describe('server admin decision', () => {
  it('agrees across isAdmin, isAdminRole, and hasApiRole(admin)', () => {
    for (const user of ADMINS) {
      expect(isAdmin(user)).toBe(true);
      expect(isAdminRole(user)).toBe(true);
      expect(hasApiRole(user, 'admin')).toBe(true);
    }
    for (const user of DENIED) {
      expect(isAdmin(user)).toBe(false);
      expect(hasApiRole(user, 'admin')).toBe(false);
    }
    expect(isAdmin(null)).toBe(false);
    expect(hasApiRole(null, 'admin')).toBe(false);
  });

  it('keeps an owner-only check narrower than admin', () => {
    expect(hasAnyRole(owner, ['owner'])).toBe(true);
    expect(hasAnyRole(superAdmin, ['owner'])).toBe(false);
    expect(hasAnyRole(operator, ['owner'])).toBe(false);
    expect(hasAnyRole(admin, ['owner'])).toBe(false);
    expect(hasApiRole(operator, 'admin', 'owner')).toBe(true);
  });

  it.each([
    ['owner', owner, 200],
    ['super-admin', superAdmin, 200],
    ['verified operator', operator, 200],
    ['admin', admin, 200],
    ['editor', editor, 403],
    ['user', endUser, 403],
  ] as const)('GET /admin/coordination/sessions (%s)', async (_name, user, status) => {
    const app = coordination(user);
    const res = await app.fetch(new Request('http://localhost/sessions'));
    expect(res.status).toBe(status);
  });

  it('returns 401 when coordination has no user', async () => {
    const app = coordination(null);
    const res = await app.fetch(new Request('http://localhost/sessions'));
    expect(res.status).toBe(401);
  });
});
