/**
 * Fresh Unlicensed Self-Host Bootstrap → Sign-In (PGlite)
 *
 * Reproduces GAP-430's Railway marketplace-template failure: a first admin
 * seeded exactly the way `apps/admin/revealui.config.ts` onInit() seeds it
 * (via the collections engine's dynamic-SQL create path — the users
 * collection has no typed `create` handler in
 * `apps/admin/src/lib/db/typedCollectionStorage.ts`, so onInit's
 * `revealui.create({ collection: 'users', ... })` falls through to the raw
 * INSERT built by `insertDocumentQuery` in
 * `packages/core/src/collections/operations/sqlAdapter.ts`) then fails to
 * sign in with "Unexpected error".
 *
 * The raw INSERT only supplies the columns onInit actually passes
 * (name, email, password, role, plus `roles` folded into `_json` because
 * it's a hasMany `select` field) and leaves every other column — including
 * `created_at` — to its SQL-level DEFAULT, exactly like the real bootstrap.
 */

import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let testDb: TestDb;

vi.mock('@revealui/db/client', () => ({
  getClient: () => testDb.drizzle,
  // DatabaseStorage's constructor calls createClient() to open its own real
  // `pg` Pool. The pool is never queried in these tests — its `.db` is
  // swapped for the PGlite-backed client immediately after construction —
  // but the constructor call itself must not throw.
  createClient: () => testDb.drizzle,
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import type { Database } from '@revealui/db/client';
import { users } from '@revealui/db/schema';
import bcrypt from 'bcryptjs';
import { signIn } from '../auth.js';
import { DatabaseStorage, resetStorage, setStorage } from '../storage/index.js';

beforeAll(async () => {
  process.env.REVEALUI_SECRET = 'test-secret-for-oninit-bootstrap-tests';
  testDb = await createTestDb();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

afterEach(async () => {
  const { sql } = await import('drizzle-orm');
  await testDb.drizzle.execute(sql.raw('DELETE FROM "sessions"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "users"'));
});

/**
 * Seed a first-admin row exactly the way the dynamic-SQL collections engine
 * would for `onInit`'s `revealui.create({ collection: 'users', data: {
 * name, email, password, role: 'owner', roles: ['super-admin'] } })` call —
 * bcrypt-hash the password (create.ts does this before the INSERT), fold
 * `roles` into `_json` (it's a hasMany `select` field, so it never becomes a
 * real column per `isJsonFieldType`), and generate the `rvl_`-prefixed id
 * exactly like `create.ts`'s `id = String(... : \`rvl_${crypto.randomUUID()}\`)`.
 * Every other column (notably `created_at`) is left unset so Postgres
 * applies its column DEFAULT — there is no Drizzle `.insert()` in this path.
 */
async function seedOnInitAdmin(email: string, password: string): Promise<string> {
  const id = `rvl_${crypto.randomUUID()}`;
  const hashedPassword = await bcrypt.hash(password, 12);
  const jsonBlob = JSON.stringify({ roles: ['super-admin'] });

  await testDb.pglite.query(
    `INSERT INTO "users" (id, "name", "email", "password", "role", "_json") VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, 'Admin User', email, hashedPassword, 'owner', jsonBlob],
  );

  return id;
}

describe('onInit bootstrap admin → signIn (PGlite, fresh unlicensed self-host)', () => {
  it('signs in successfully for a first admin created via the dynamic-SQL bootstrap path', async () => {
    const email = 'founder@example.com';
    const password = 'CorrectHorseBatteryStaple123!';
    await seedOnInitAdmin(email, password);

    // Sanity: confirm the row the collections engine would have produced —
    // in particular that created_at came from the SQL DEFAULT, not an app value.
    const [row] = await testDb.drizzle.select().from(users).where(eq(users.email, email));
    expect(row).toBeDefined();
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.emailVerified).toBe(false);

    const result = await signIn(email, password, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    if (result.success) {
      expect(result.sessionToken).toBeDefined();
      expect(result.user.email).toBe(email);
    }
  });

  it('signs in successfully when getStorage() resolves DatabaseStorage (production-shaped rate-limit/brute-force backend, not the test-only in-memory fallback)', async () => {
    // A Free-tier Railway deploy runs with NODE_ENV=production and a real
    // POSTGRES_URL, so getStorage() (packages/auth/src/server/storage/index.ts)
    // resolves DatabaseStorage, never InMemoryStorage. The previous test never
    // exercised that path (POSTGRES_URL/DATABASE_URL are forced empty by this
    // package's vitest.config.ts, so getStorage() fell back to in-memory).
    // DatabaseStorage's constructor opens its own real `pg` Pool via a
    // connection string, which PGlite (no TCP listener) can't satisfy — so
    // build one against a throwaway address (never queried) and swap its
    // internal Drizzle client for the PGlite-backed one, exercising the exact
    // same rate_limits SQL (get/set/atomicUpdate) DatabaseStorage runs in prod.
    const dbBackedStorage = new DatabaseStorage('postgresql://unused:unused@localhost:5432/unused');
    (dbBackedStorage as unknown as { db: Database }).db = testDb.drizzle as unknown as Database;
    setStorage(dbBackedStorage);

    try {
      const email = 'founder-dbstorage@example.com';
      const password = 'CorrectHorseBatteryStaple123!';
      await seedOnInitAdmin(email, password);

      const result = await signIn(email, password, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      if (result.success) {
        expect(result.sessionToken).toBeDefined();
        expect(result.user.email).toBe(email);
      }
    } finally {
      resetStorage();
    }
  });
});
