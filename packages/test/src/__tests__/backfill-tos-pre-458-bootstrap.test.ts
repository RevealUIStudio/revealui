/**
 * Tests for scripts/setup/backfill-tos-pre-458-bootstrap.ts
 *
 * Uses an in-memory PGlite database so no real Postgres connection is needed.
 * The backfill logic is mirrored here via Drizzle directly, keeping tests
 * fast and deterministic without shelling out to the script.
 *
 * Covers: dry-run, apply, idempotency, and ineligible-row filtering.
 */

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanTables, createTestDb, type TestDb } from '../utils/drizzle-test-db.js';

// ---------------------------------------------------------------------------
// Constants — match the script exactly
// ---------------------------------------------------------------------------

const TOS_VERSION = '2026-03-01';
const AGENT_ID = 'setup:script:backfill-tos-pre-458-bootstrap';
const EVENT_TYPE = 'setup:tos-backfill';

interface BackfillPayload {
  userId: string;
  previousTosAcceptedAt: null;
  previousTosVersion: null;
  backfilledTosAcceptedAt: string;
  backfilledTosVersion: string;
  rationale: string;
  issue: number;
}

// ---------------------------------------------------------------------------
// Logic mirrors — exercise the same predicates as the script
// ---------------------------------------------------------------------------

async function findMatchedUsers(db: TestDb['drizzle']) {
  const { users } = await import('@revealui/db/schema');
  return db
    .select({ id: users.id, createdAt: users.createdAt })
    .from(users)
    .where(
      and(isNull(users.tosAcceptedAt), eq(users.role, 'owner'), eq(users.emailVerified, true)),
    );
}

async function applyBackfill(db: TestDb['drizzle']): Promise<number> {
  const { users, auditLog } = await import('@revealui/db/schema');
  const matched = await findMatchedUsers(db);

  if (matched.length === 0) return 0;

  await db.transaction(async (tx) => {
    for (const user of matched) {
      await tx
        .update(users)
        .set({ tosAcceptedAt: user.createdAt, tosVersion: TOS_VERSION })
        .where(and(eq(users.id, user.id), isNull(users.tosAcceptedAt)));

      await tx.insert(auditLog).values({
        id: randomUUID(),
        eventType: EVENT_TYPE,
        agentId: AGENT_ID,
        severity: 'info',
        payload: {
          userId: user.id,
          previousTosAcceptedAt: null,
          previousTosVersion: null,
          backfilledTosAcceptedAt: user.createdAt.toISOString(),
          backfilledTosVersion: TOS_VERSION,
          rationale: 'CR-8 backfill for pre-#458 bootstrap admin',
          issue: 460,
        },
      });
    }
  });

  return matched.length;
}

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

async function seedUser(
  db: TestDb['drizzle'],
  overrides: {
    id?: string;
    role?: string;
    emailVerified?: boolean;
    tosAcceptedAt?: Date | null;
    tosVersion?: string | null;
    createdAt?: Date;
  } = {},
): Promise<string> {
  const { users } = await import('@revealui/db/schema');
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.createdAt ?? new Date('2026-01-15T10:00:00Z');

  await db.insert(users).values({
    id,
    name: `User ${id.slice(0, 8)}`,
    email: `${id.slice(0, 8)}@example.com`,
    role: overrides.role ?? 'owner',
    emailVerified: overrides.emailVerified ?? true,
    tosAcceptedAt: overrides.tosAcceptedAt !== undefined ? overrides.tosAcceptedAt : null,
    tosVersion: overrides.tosVersion !== undefined ? overrides.tosVersion : null,
    createdAt,
    updatedAt: createdAt,
  });

  return id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('backfill-tos-pre-458-bootstrap', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await cleanTables(db.drizzle, ['audit_log', 'users']);
  });

  describe('dry-run behaviour (findMatchedUsers)', () => {
    it('finds matching rows without mutating', async () => {
      const { users } = await import('@revealui/db/schema');

      const userId = await seedUser(db.drizzle);
      const matched = await findMatchedUsers(db.drizzle);

      expect(matched).toHaveLength(1);
      expect(matched[0].id).toBe(userId);

      const [row] = await db.drizzle
        .select({ tosAcceptedAt: users.tosAcceptedAt })
        .from(users)
        .where(eq(users.id, userId));

      expect(row?.tosAcceptedAt).toBeNull();
    });

    it('returns empty array when no rows match', async () => {
      const matched = await findMatchedUsers(db.drizzle);
      expect(matched).toHaveLength(0);
    });
  });

  describe('apply mode', () => {
    it('sets tosAcceptedAt = createdAt and tosVersion for matching user', async () => {
      const { users } = await import('@revealui/db/schema');
      const createdAt = new Date('2026-02-01T08:00:00Z');

      const userId = await seedUser(db.drizzle, { createdAt });
      const count = await applyBackfill(db.drizzle);

      expect(count).toBe(1);

      const [row] = await db.drizzle
        .select({ tosAcceptedAt: users.tosAcceptedAt, tosVersion: users.tosVersion })
        .from(users)
        .where(eq(users.id, userId));

      expect(row?.tosAcceptedAt).toEqual(createdAt);
      expect(row?.tosVersion).toBe(TOS_VERSION);
    });

    it('writes one audit_log entry per backfilled user with correct shape', async () => {
      const { auditLog } = await import('@revealui/db/schema');
      const userId = await seedUser(db.drizzle);

      await applyBackfill(db.drizzle);

      const entries = await db.drizzle
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, EVENT_TYPE));

      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.agentId).toBe(AGENT_ID);
      expect(entry.severity).toBe('info');

      const payload = entry.payload as BackfillPayload;
      expect(payload.userId).toBe(userId);
      expect(payload.previousTosAcceptedAt).toBeNull();
      expect(payload.previousTosVersion).toBeNull();
      expect(payload.backfilledTosVersion).toBe(TOS_VERSION);
      expect(payload.rationale).toBe('CR-8 backfill for pre-#458 bootstrap admin');
      expect(payload.issue).toBe(460);
    });

    it('backfills multiple matching users with one audit entry each', async () => {
      const { auditLog } = await import('@revealui/db/schema');

      await seedUser(db.drizzle, { id: 'u1' });
      await seedUser(db.drizzle, { id: 'u2' });

      const count = await applyBackfill(db.drizzle);
      expect(count).toBe(2);

      const entries = await db.drizzle
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, EVENT_TYPE));

      expect(entries).toHaveLength(2);
    });
  });

  describe('idempotency', () => {
    it('second apply finds 0 rows after first apply', async () => {
      await seedUser(db.drizzle);

      const firstCount = await applyBackfill(db.drizzle);
      expect(firstCount).toBe(1);

      const secondCount = await applyBackfill(db.drizzle);
      expect(secondCount).toBe(0);
    });
  });

  describe('ineligible rows are not touched', () => {
    it('skips users with tosAcceptedAt already set', async () => {
      const { users } = await import('@revealui/db/schema');
      const existingDate = new Date('2026-03-01T00:00:00Z');

      const userId = await seedUser(db.drizzle, {
        tosAcceptedAt: existingDate,
        tosVersion: '2026-03-01',
      });

      const count = await applyBackfill(db.drizzle);
      expect(count).toBe(0);

      const [row] = await db.drizzle
        .select({ tosAcceptedAt: users.tosAcceptedAt })
        .from(users)
        .where(eq(users.id, userId));

      expect(row?.tosAcceptedAt).toEqual(existingDate);
    });

    it('skips users with role != owner', async () => {
      const { users } = await import('@revealui/db/schema');

      const userId = await seedUser(db.drizzle, { role: 'viewer' });
      const count = await applyBackfill(db.drizzle);

      expect(count).toBe(0);

      const [row] = await db.drizzle
        .select({ tosAcceptedAt: users.tosAcceptedAt })
        .from(users)
        .where(eq(users.id, userId));

      expect(row?.tosAcceptedAt).toBeNull();
    });

    it('skips users with emailVerified = false', async () => {
      const { users } = await import('@revealui/db/schema');

      const userId = await seedUser(db.drizzle, { emailVerified: false });
      const count = await applyBackfill(db.drizzle);

      expect(count).toBe(0);

      const [row] = await db.drizzle
        .select({ tosAcceptedAt: users.tosAcceptedAt })
        .from(users)
        .where(eq(users.id, userId));

      expect(row?.tosAcceptedAt).toBeNull();
    });
  });
});
