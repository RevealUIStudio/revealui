import { createHash } from 'node:crypto';
import type { Database } from '@revealui/db';
import { userDevices, users } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiAuthUser } from '../auth.js';

const state = vi.hoisted(() => ({ db: null as Database | null }));
vi.mock('@revealui/db', () => ({ getClient: () => state.db }));
vi.mock('@revealui/auth/server', () => ({ getSession: vi.fn(async () => null) }));

import { authMiddleware } from '../auth.js';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
  state.db = testDb.drizzle as unknown as Database;
});
afterAll(async () => {
  await testDb.close();
});

async function seed(id: string) {
  const token = `rvui_dev_${createHash('sha256').update(id).digest('hex')}`;
  await testDb.drizzle.insert(users).values({
    id,
    name: 'Device user',
    email: `${id}@example.com`,
    role: 'viewer',
    status: 'active',
    emailVerified: true,
    _json: { roles: ['super-admin'] },
  });
  await testDb.drizzle.insert(userDevices).values({
    id: `row-${id}`,
    deviceId: `device-${id}`,
    userId: id,
    isActive: true,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    tokenExpiresAt: new Date(Date.now() + 60_000),
  });
  return token;
}
function request(token: string) {
  const app = new Hono<{ Variables: { user: ApiAuthUser; session: unknown } }>();
  app.use('*', authMiddleware());
  app.get('/private', (c) => c.json({ userId: c.get('user').id }));
  return app.request('/private', { headers: { authorization: `Bearer ${token}` } });
}

describe('device bearer authority uses the current canonical account', () => {
  it('denies a previously valid operator token after account suspension', async () => {
    const token = await seed('device-suspended');
    expect((await request(token)).status).toBe(200);
    await testDb.drizzle
      .update(users)
      .set({ status: 'suspended' })
      .where(eq(users.id, 'device-suspended'));
    expect((await request(token)).status).toBe(401);
  });
  it('denies soft deletion even if status remains active', async () => {
    const token = await seed('device-deleted');
    await testDb.drizzle
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, 'device-deleted'));
    expect((await request(token)).status).toBe(401);
  });
  it('denies a device while authoritative password rotation is required', async () => {
    const token = await seed('device-rotation');
    await testDb.drizzle
      .update(users)
      .set({ mustRotatePassword: true })
      .where(eq(users.id, 'device-rotation'));
    expect((await request(token)).status).toBe(401);
  });
  it('denies a revoked device and an expired token', async () => {
    const revoked = await seed('device-revoked');
    await testDb.drizzle
      .update(userDevices)
      .set({ isActive: false })
      .where(eq(userDevices.userId, 'device-revoked'));
    expect((await request(revoked)).status).toBe(401);
    const expired = await seed('device-expired');
    await testDb.drizzle
      .update(userDevices)
      .set({ tokenExpiresAt: new Date(0) })
      .where(eq(userDevices.userId, 'device-expired'));
    expect((await request(expired)).status).toBe(401);
  });
});
