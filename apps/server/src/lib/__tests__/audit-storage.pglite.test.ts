/**
 * Integration coverage for `DrizzleBackedAuditStorage` (the boundary that wires
 * the @revealui/core/security AuditSystem to the persistent audit_log table)
 * and the boot-time round-trip self-test, against a REAL, migrated schema
 * (PGlite) rather than a vi.fn() mock.
 *
 * GAP-355 Stage 1. This file replaces `postgres-audit-storage.pglite.test.ts`,
 * whose subject class (PostgresAuditStorage + its HMAC hash chain) was deleted.
 * Those deleted tests pinned defects that no longer exist: the jsonb
 * signature-recompute mismatch and the "chain head advances on a rejected
 * insert" bug both vanish because Stage 1 removes signing entirely (rows land
 * unsigned; signature stays NULL — signing is Stage 3).
 *
 * THE ACCEPTANCE FLIP lives here: pre-Stage-1, the three severities the request
 * middleware emits (low/medium/high) were 100% rejected by the audit_log CHECK
 * constraint — 0 of 3 rows landed. Post-Stage-1 the boundary maps them
 * (low->info, medium->warn, high->critical) and every one lands.
 */
import { randomUUID } from 'node:crypto';
import type { AuditEvent, AuditStorage } from '@revealui/core/security';
import { AuditSystem } from '@revealui/core/security';
import type { Database } from '@revealui/db/client';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import {
  assertAuditStorageEnv,
  auditStorageSelfTest,
  DrizzleBackedAuditStorage,
  mapSeverityToDb,
} from '../audit-storage.js';

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'data.read',
    severity: 'low',
    actor: { id: 'agent-1', type: 'system' },
    action: 'test',
    result: 'success',
    ...overrides,
  };
}

describe('DrizzleBackedAuditStorage — real PGlite schema, not a vi.fn() mock', () => {
  let testDb: TestDb;
  let storage: DrizzleBackedAuditStorage;

  beforeEach(async () => {
    testDb = await createTestDb();
    storage = new DrizzleBackedAuditStorage(testDb.drizzle as unknown as Database);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it('harness sanity: a valid event persists and reads back', async () => {
    const { auditLog } = await import('@revealui/db/schema');
    const event = makeEvent({ severity: 'critical' });
    await storage.write(event);
    const rows = await testDb.drizzle.select().from(auditLog).where(eq(auditLog.id, event.id));
    expect(rows).toHaveLength(1);
  });

  it('every severity the middleware emits (low/medium/high) now LANDS, mapped to the DB vocabulary', async () => {
    const { auditLog } = await import('@revealui/db/schema');
    const cases = [
      { emitted: 'low', db: 'info' },
      { emitted: 'medium', db: 'warn' },
      { emitted: 'high', db: 'critical' },
    ] as const;

    for (const { emitted, db } of cases) {
      const event = makeEvent({ severity: emitted });
      await storage.write(event);
      const [row] = await testDb.drizzle.select().from(auditLog).where(eq(auditLog.id, event.id));
      expect(row, `severity '${emitted}' should have landed`).toBeDefined();
      expect(row?.severity).toBe(db);
    }

    // Pre-Stage-1 this was 0. All three land now.
    const all = await testDb.drizzle.select().from(auditLog);
    expect(all).toHaveLength(3);
  });

  it('maps critical->critical and round-trips the full event through query()', async () => {
    const event = makeEvent({ severity: 'critical', metadata: { z: 1, a: 2 } });
    await storage.write(event);

    const results = await storage.query({ actorId: 'agent-1' });
    const found = results.find((e) => e.id === event.id);
    expect(found).toBeDefined();
    // The ORIGINAL security-vocabulary severity round-trips via the payload.
    expect(found?.severity).toBe('critical');
    expect(found?.metadata).toEqual({ z: 1, a: 2 });
  });

  it('writes rows UNSIGNED — signature and previous_signature are NULL (signing is Stage 3)', async () => {
    const { auditLog } = await import('@revealui/db/schema');
    await storage.write(makeEvent({ severity: 'high' }));
    const [row] = await testDb.drizzle.select().from(auditLog);
    expect(row?.signature).toBeNull();
    expect(row?.previousSignature).toBeNull();
  });

  it('mapSeverityToDb is total over the security vocabulary', () => {
    expect(mapSeverityToDb('low')).toBe('info');
    expect(mapSeverityToDb('medium')).toBe('warn');
    expect(mapSeverityToDb('high')).toBe('critical');
    expect(mapSeverityToDb('critical')).toBe('critical');
  });
});

describe('auditStorageSelfTest — boot-time round-trip gate', () => {
  let testDb: TestDb | undefined;

  afterEach(async () => {
    if (testDb) {
      await testDb.close();
      testDb = undefined;
    }
  });

  it('healthy storage: startup proceeds (resolves)', async () => {
    testDb = await createTestDb();
    const system = new AuditSystem(
      new DrizzleBackedAuditStorage(testDb.drizzle as unknown as Database),
    );
    await expect(auditStorageSelfTest(system)).resolves.toBeUndefined();
  });

  it('broken storage (write fails): startup REFUSES (rejects loudly)', async () => {
    const failingWrite: AuditStorage = {
      write: () => Promise.reject(new Error('db down')),
      query: () => Promise.resolve([]),
      count: () => Promise.resolve(0),
    };
    const system = new AuditSystem(failingWrite);
    await expect(auditStorageSelfTest(system)).rejects.toThrow();
  });

  it('broken storage (readback fails): startup REFUSES (rejects loudly)', async () => {
    // write() "succeeds" but the round trip can never read the event back.
    const writeOnly: AuditStorage = {
      write: () => Promise.resolve(),
      query: () => Promise.resolve([]),
      count: () => Promise.resolve(0),
    };
    const system = new AuditSystem(writeOnly);
    await expect(auditStorageSelfTest(system)).rejects.toThrow('AUDIT STORAGE SELF-TEST FAILED');
  });
});

describe('assertAuditStorageEnv — synchronous env-parity guard (GAP-355 Stage 1 closure)', () => {
  it('throws when no database connection env is set (refuse-to-deploy)', () => {
    expect(() => assertAuditStorageEnv({})).toThrow('AUDIT STORAGE ENV PARITY FAILED');
  });

  it('treats an empty connection var as absent', () => {
    expect(() => assertAuditStorageEnv({ DATABASE_URL: '' })).toThrow(
      'AUDIT STORAGE ENV PARITY FAILED',
    );
  });

  it('passes when DATABASE_URL or POSTGRES_URL is present', () => {
    expect(() => assertAuditStorageEnv({ DATABASE_URL: 'postgres://x' })).not.toThrow();
    expect(() => assertAuditStorageEnv({ POSTGRES_URL: 'postgres://x' })).not.toThrow();
  });

  it('DATABASE_HOST alone THROWS — getClient() cannot build a connection from it (GAP-417 item 5)', () => {
    // The #2161 re-review proved this empirically on the old predicate: the
    // assert passed on DATABASE_HOST alone, getClient() then threw inside
    // installAuditStorage, the caller swallowed it, and production silently
    // kept the in-memory sink. The assert must accept exactly what
    // getClient() accepts.
    expect(() => assertAuditStorageEnv({ DATABASE_HOST: 'db.internal' })).toThrow(
      'AUDIT STORAGE ENV PARITY FAILED',
    );
  });

  it('on a production deployment, throws when the signing key is absent (GAP-355 Stage 3)', () => {
    expect(() =>
      assertAuditStorageEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x' }),
    ).toThrow('REVEALUI_AUDIT_SIGNING_KEY');
  });

  it('on a production deployment, passes when the signing key is present', () => {
    expect(() =>
      assertAuditStorageEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://x',
        REVEALUI_AUDIT_SIGNING_KEY: 'pem-here',
      }),
    ).not.toThrow();
  });

  it('does not require the signing key outside production (dev/test run unsigned)', () => {
    expect(() => assertAuditStorageEnv({ DATABASE_URL: 'postgres://x' })).not.toThrow();
  });

  it('SKIP_ENV_VALIDATION no longer exempts the signing key in production (GAP-417 items 1-2, owner-countersigned)', () => {
    // The audit path has no escape hatch: a production boot without the key
    // refuses even under SKIP — unsigned rows stall anchor contiguity forever.
    expect(() =>
      assertAuditStorageEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://x',
        SKIP_ENV_VALIDATION: 'true',
      }),
    ).toThrow('REVEALUI_AUDIT_SIGNING_KEY');
  });
});

describe('GAP-417 store-level rail — a production process never lands an unsigned row', () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await testDb.close();
  });

  it('production + no injected signer: append AND appendBatch refuse, nothing lands', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { DrizzleAuditStore } = await import('@revealui/db');
    const { auditLog } = await import('@revealui/db/schema');
    const store = new DrizzleAuditStore(testDb.drizzle as unknown as Database);

    const entry = {
      id: randomUUID(),
      timestamp: new Date(),
      eventType: 'data.read',
      severity: 'info',
      agentId: 'agent-1',
      payload: {},
      policyViolations: [],
    };

    await expect(store.append(entry)).rejects.toThrow('UNSIGNED');
    await expect(store.appendBatch([entry])).rejects.toThrow('UNSIGNED');
    const rows = await testDb.drizzle.select().from(auditLog);
    expect(rows).toHaveLength(0);
  });

  it('non-production unsigned append still lands (dev/test run unsigned by design)', async () => {
    const { DrizzleAuditStore } = await import('@revealui/db');
    const { auditLog } = await import('@revealui/db/schema');
    const store = new DrizzleAuditStore(testDb.drizzle as unknown as Database);

    await store.append({
      id: randomUUID(),
      timestamp: new Date(),
      eventType: 'data.read',
      severity: 'info',
      agentId: 'agent-1',
      payload: {},
      policyViolations: [],
    });
    const rows = await testDb.drizzle.select().from(auditLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.signature).toBeNull();
  });
});
