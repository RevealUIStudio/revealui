import type { Database } from '@revealui/db/client';
import { sessions, users } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashToken } from '../../utils/token.js';

const state = vi.hoisted(() => ({ db: null as Database | null }));
vi.mock('@revealui/db/client', () => ({ getClient: () => state.db }));

import { getSession } from '../session.js';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
  state.db = testDb.drizzle as unknown as Database;
});
afterAll(async () => {
  await testDb.close();
});

async function seed(id: string) {
  const token = `fixture-session-${id}`;
  await testDb.drizzle.insert(users).values({
    id,
    name: 'Session owner',
    email: `${id}@example.com`,
    status: 'active',
    emailVerified: true,
    role: 'viewer',
    _json: { roles: ['super-admin'] },
    lastActiveAt: new Date(),
  });
  await testDb.drizzle.insert(sessions).values({
    id: `session-${id}`,
    userId: id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return new Headers({ cookie: `revealui-session=${token}` });
}

describe('browser sessions use current canonical account state', () => {
  it.each(['suspended', 'pending', 'deleted'])(
    'denies an unexpired operator session after status becomes %s',
    async (status) => {
      const id = `session-${status}`;
      const headers = await seed(id);
      expect((await getSession(headers))?.user.id).toBe(id);
      await testDb.drizzle.update(users).set({ status }).where(eq(users.id, id));
      expect(await getSession(headers)).toBeNull();
    },
  );
  it('denies soft deletion even when status is active', async () => {
    const headers = await seed('session-soft-delete');
    await testDb.drizzle
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, 'session-soft-delete'));
    expect(await getSession(headers)).toBeNull();
  });
});
