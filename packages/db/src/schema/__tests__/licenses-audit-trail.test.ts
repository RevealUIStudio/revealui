/**
 * I-1 — licenses.userId cascade → set null (audit-trail invariant)
 *
 * Verifies that deleting a user sets licenses.user_id to NULL rather than
 * hard-deleting the license row. The license must remain queryable by
 * license_id, customerId, and subscriptionId for audit / dispute purposes.
 *
 * Uses PGlite (in-memory PostgreSQL) — no external connection required.
 */

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();

  await db.query(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE licenses (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      license_key TEXT NOT NULL,
      tier TEXT NOT NULL,
      subscription_id TEXT,
      customer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      perpetual BOOLEAN NOT NULL DEFAULT false,
      support_expires_at TIMESTAMPTZ,
      github_username TEXT,
      npm_username TEXT,
      deleted_at TIMESTAMPTZ
    )
  `);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.query('DELETE FROM licenses');
  await db.query('DELETE FROM users');
});

async function insertUser(id: string): Promise<void> {
  await db.query(`INSERT INTO users (id, name) VALUES ($1, 'Test User')`, [id]);
}

async function insertLicense(opts: {
  id: string;
  userId: string;
  customerId: string;
  subscriptionId?: string;
  perpetual?: boolean;
}): Promise<void> {
  await db.query(
    `INSERT INTO licenses (id, user_id, license_key, tier, customer_id, subscription_id, perpetual)
     VALUES ($1, $2, 'rv-test-key', 'pro', $3, $4, $5)`,
    [opts.id, opts.userId, opts.customerId, opts.subscriptionId ?? null, opts.perpetual ?? false],
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('I-1 — licenses.userId ON DELETE SET NULL (audit-trail invariant)', () => {
  describe('user deletion preserves license row', () => {
    it('license row remains after user is deleted', async () => {
      await insertUser('u1');
      await insertLicense({ id: 'lic1', userId: 'u1', customerId: 'cus_abc' });

      await db.query("DELETE FROM users WHERE id = 'u1'");

      const result = await db.query("SELECT COUNT(*) AS c FROM licenses WHERE id = 'lic1'");
      expect(Number(result.rows[0]?.c)).toBe(1);
    });

    it('user_id is set to NULL on the license row after user deletion', async () => {
      await insertUser('u2');
      await insertLicense({ id: 'lic2', userId: 'u2', customerId: 'cus_def' });

      await db.query("DELETE FROM users WHERE id = 'u2'");

      const result = await db.query("SELECT user_id FROM licenses WHERE id = 'lic2'");
      expect(result.rows[0]?.user_id).toBeNull();
    });

    it('license retains customerId, subscriptionId, and licenseKey after user deletion', async () => {
      await insertUser('u3');
      await insertLicense({
        id: 'lic3',
        userId: 'u3',
        customerId: 'cus_ghi',
        subscriptionId: 'sub_xyz',
      });

      await db.query("DELETE FROM users WHERE id = 'u3'");

      const result = await db.query(
        "SELECT customer_id, subscription_id, license_key FROM licenses WHERE id = 'lic3'",
      );
      expect(result.rows[0]?.customer_id).toBe('cus_ghi');
      expect(result.rows[0]?.subscription_id).toBe('sub_xyz');
      expect(result.rows[0]?.license_key).toBe('rv-test-key');
    });

    it('license is still queryable by license_id after user deletion', async () => {
      await insertUser('u4');
      await insertLicense({ id: 'lic4', userId: 'u4', customerId: 'cus_jkl' });

      await db.query("DELETE FROM users WHERE id = 'u4'");

      const result = await db.query("SELECT id FROM licenses WHERE id = 'lic4'");
      expect(result.rows).toHaveLength(1);
    });

    it('license is still queryable by customerId after user deletion', async () => {
      await insertUser('u5');
      await insertLicense({ id: 'lic5', userId: 'u5', customerId: 'cus_mno' });

      await db.query("DELETE FROM users WHERE id = 'u5'");

      const result = await db.query(
        "SELECT id FROM licenses WHERE customer_id = 'cus_mno' AND deleted_at IS NULL",
      );
      expect(result.rows).toHaveLength(1);
    });

    it('deleting multiple licenses for the same user sets all userIds to NULL', async () => {
      await insertUser('u6');
      await insertLicense({
        id: 'lic6a',
        userId: 'u6',
        customerId: 'cus_pqr',
        subscriptionId: 'sub_a',
      });
      await insertLicense({
        id: 'lic6b',
        userId: 'u6',
        customerId: 'cus_pqr',
        subscriptionId: 'sub_b',
      });

      await db.query("DELETE FROM users WHERE id = 'u6'");

      const result = await db.query(
        "SELECT id, user_id FROM licenses WHERE customer_id = 'cus_pqr' ORDER BY id",
      );
      expect(result.rows).toHaveLength(2);
      for (const row of result.rows) {
        expect(row.user_id).toBeNull();
      }
    });
  });

  describe('normal operation — user_id nullable column is compatible with existing writes', () => {
    it('can insert a license with a valid user_id', async () => {
      await insertUser('u7');
      await insertLicense({ id: 'lic7', userId: 'u7', customerId: 'cus_stu' });

      const result = await db.query("SELECT user_id FROM licenses WHERE id = 'lic7'");
      expect(result.rows[0]?.user_id).toBe('u7');
    });

    it('can filter active licenses for a user with user_id IS NOT NULL', async () => {
      await insertUser('u8');
      await insertLicense({ id: 'lic8', userId: 'u8', customerId: 'cus_vwx' });

      const result = await db.query(
        "SELECT id FROM licenses WHERE user_id = 'u8' AND deleted_at IS NULL AND status = 'active'",
      );
      expect(result.rows).toHaveLength(1);
    });
  });
});
