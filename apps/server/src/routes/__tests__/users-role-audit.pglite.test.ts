/**
 * Role PATCH audit rows share the user update's transaction on a driver that
 * has one. A failed update rolls the success row back and leaves the role.
 */
import { generateKeyPairSync } from 'node:crypto';
import { __resetAuditSignerForTest } from '@revealui/auth/audit-storage';
import { audit, InMemoryAuditStorage } from '@revealui/core/security';
import type { Database } from '@revealui/db/client';
import { auditLog, users } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, describe, expect, it } from 'vitest';
import { DrizzleBackedAuditStorage } from '../../lib/audit-storage.js';
import usersApp from '../content/users.js';

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@test.com' };

function createApp(db: Database) {
  const app = new Hono<{ Variables: { user: typeof ADMIN; db: Database } }>();
  app.use('*', async (c, next) => {
    c.set('user', ADMIN);
    c.set('db', db);
    await next();
  });
  app.route('/', usersApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

async function seedViewer(testDb: TestDb): Promise<void> {
  await testDb.drizzle.insert(users).values({ id: 'user-a', name: 'Alice', role: 'viewer' });
}

describe('PATCH /users/:id role audit transaction', () => {
  let testDb: TestDb | undefined;

  afterEach(async () => {
    delete process.env.REVEALUI_AUDIT_SIGNING_KEY;
    __resetAuditSignerForTest();
    audit.setStorage(new InMemoryAuditStorage());
    if (testDb) {
      await testDb.close();
      testDb = undefined;
    }
  });

  it('commits one success row and the new role together', async () => {
    testDb = await createTestDb();
    await seedViewer(testDb);
    audit.setStorage(new DrizzleBackedAuditStorage(testDb.drizzle as unknown as Database));

    const res = await createApp(testDb.drizzle as unknown as Database).request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'editor' }),
    });

    expect(res.status).toBe(200);
    const [user] = await testDb.drizzle.select().from(users).where(eq(users.id, 'user-a'));
    expect(user?.role).toBe('editor');
    const rows = await testDb.drizzle.select().from(auditLog);
    expect(rows).toHaveLength(1);
    const payload = rows[0]?.payload as {
      result?: string;
      changes?: { before: { role: string }; after: { role: string } };
    };
    expect(rows[0]?.eventType).toBe('role.assign');
    expect(payload.result).toBe('success');
    expect(payload.changes).toEqual({ before: { role: 'viewer' }, after: { role: 'editor' } });
  });

  it('rolls back a signed success row when the user update fails', async () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    process.env.REVEALUI_AUDIT_SIGNING_KEY = typeof pem === 'string' ? pem : pem.toString();
    __resetAuditSignerForTest();

    testDb = await createTestDb();
    await seedViewer(testDb);
    audit.setStorage(new DrizzleBackedAuditStorage(testDb.drizzle as unknown as Database));

    const res = await createApp(testDb.drizzle as unknown as Database).request('/users/user-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'editor', status: 'not-a-status' }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('generate_series');
    const [user] = await testDb.drizzle.select().from(users).where(eq(users.id, 'user-a'));
    expect(user?.role).toBe('viewer');
    const rows = await testDb.drizzle.select().from(auditLog);
    const success = rows.filter((row) => {
      const payload = row.payload as { result?: string };
      return payload.result === 'success';
    });
    expect(success).toHaveLength(0);
  });
});
