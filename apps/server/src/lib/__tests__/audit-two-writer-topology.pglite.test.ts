/**
 * GAP-338 — the two-writer topology ruling, proven.
 *
 * The gap file ordered: "decide with a trace of how the chain integrity behaves
 * with two writer processes — do not default to two independent writers without
 * answering it." The answer: the HMAC hash chain was ABANDONED by the GAP-355
 * receipt architecture (ADR 2026-07-12 §5; `previous_signature` is never
 * written), so rows are independent — each signed at its own door with the same
 * env-derived Ed25519 key, sequenced by the DB. Two writer processes (the Hono
 * api and the Next.js admin) appending to ONE `audit_log` cannot corrupt each
 * other.
 *
 * This test simulates exactly that: two `DrizzleBackedAuditStorage` instances,
 * each with its own independently-composed signer from the SAME
 * `REVEALUI_AUDIT_SIGNING_KEY` (as two processes would), interleaving writes
 * into one migrated PGlite `audit_log`. Every row must land, carry a signature,
 * and verify OFFLINE from the public key — the customer's receipt check.
 */

import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { __resetAuditSignerForTest, DrizzleBackedAuditStorage } from '@revealui/auth/audit-storage';
import type { AuditEvent, AuditSignable } from '@revealui/core/security';
import { verifyAuditRow } from '@revealui/core/security';
import type { Database } from '@revealui/db/client';
import { auditLog } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

function makeEvent(actorId: string): AuditEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'auth.login',
    severity: 'medium',
    actor: { id: actorId, type: 'user' },
    action: 'login',
    result: 'success',
  };
}

/** Rebuild the signable shape from a DB readback row (the verifier's view). */
function signableFromRow(row: typeof auditLog.$inferSelect): AuditSignable {
  return {
    id: row.id,
    sequence: Number(row.seq),
    tenant: row.tenant,
    timestamp: row.timestamp,
    eventType: row.eventType,
    severity: row.severity,
    agentId: row.agentId,
    taskId: row.taskId,
    sessionId: row.sessionId,
    payload: row.payload,
    policyViolations: row.policyViolations ?? [],
  };
}

describe('GAP-338 — two writer processes, one audit_log, every receipt verifies', () => {
  let testDb: TestDb;
  let db: Database;
  let publicKeyPem: string;

  beforeEach(async () => {
    testDb = await createTestDb();
    db = testDb.drizzle as unknown as Database;
    const kp = makeKeypair();
    publicKeyPem = kp.publicKeyPem;
    vi.stubEnv('REVEALUI_AUDIT_SIGNING_KEY', kp.privateKeyPem);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    __resetAuditSignerForTest();
    await testDb.close();
  });

  it('interleaved writes from two independently-composed writers all land signed and verify offline', async () => {
    // Writer A: the "api process". Fresh signer composition from env.
    __resetAuditSignerForTest();
    const apiWriter = new DrizzleBackedAuditStorage(db);

    // Writer B: the "admin process". Reset forces a SECOND, independent signer
    // composition from the same env key — exactly what a separate process does.
    __resetAuditSignerForTest();
    const adminWriter = new DrizzleBackedAuditStorage(db);

    const events = [
      { writer: apiWriter, event: makeEvent('api-user-1') },
      { writer: adminWriter, event: makeEvent('admin-user-1') },
      { writer: apiWriter, event: makeEvent('api-user-2') },
      { writer: adminWriter, event: makeEvent('admin-user-2') },
    ];
    for (const { writer, event } of events) {
      await writer.write(event);
    }

    const rows = await db.select().from(auditLog);
    expect(rows).toHaveLength(4);

    const resolve = (): string => publicKeyPem;
    const seqs = new Set<number>();
    for (const row of rows) {
      expect(row.signature, `row ${row.id} must be signed`).toBeTruthy();
      expect(row.previousSignature, 'the hash chain stays abandoned').toBeNull();
      const result = verifyAuditRow(signableFromRow(row), row.signature ?? '', resolve);
      expect(result.valid, `row ${row.id} must verify offline: ${result.reason ?? ''}`).toBe(true);
      seqs.add(Number(row.seq));
    }
    // The DB sequence keeps rows totally ordered across writers — no collisions.
    expect(seqs.size).toBe(4);
  });

  it('one writer signing and one unsigned dev writer cannot exist off the same env — both compose the same mode', async () => {
    __resetAuditSignerForTest();
    const a = new DrizzleBackedAuditStorage(db);
    __resetAuditSignerForTest();
    const b = new DrizzleBackedAuditStorage(db);

    await a.write(makeEvent('actor-a'));
    await b.write(makeEvent('actor-b'));

    const rows = await db.select().from(auditLog);
    const signedCount = rows.filter((r) => Boolean(r.signature)).length;
    // Same env key → both writers sign. A mixed signed/unsigned split would mean
    // env divergence between the two deployments — the exact condition
    // assertAuditStorageEnv fails closed on in production.
    expect(signedCount).toBe(2);
  });
});
