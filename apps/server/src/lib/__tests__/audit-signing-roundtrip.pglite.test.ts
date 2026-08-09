/**
 * GAP-355 Stage 3 — the load-bearing integration test.
 *
 * Writes a SIGNED audit row through the ONE DOOR (`DrizzleAuditStore.append`
 * with an injected Ed25519 signer) into a REAL migrated `audit_log` (PGlite),
 * reads it back through jsonb + timestamptz, reconstructs the signable row from
 * the readback, and verifies the signature with `verifyAuditRow` — the exact
 * offline path a customer runs with only the public key.
 *
 * This recreates ADR `2026-07-12-audit-receipt-architecture` finding 2 on
 * purpose: a jsonb column does not preserve key order, so a signature computed
 * over anything but the canonical (RFC 8785) bytes cannot be reproduced from
 * storage. The `non-canonical signer` test proves that property is load-bearing:
 * a signer that signs `JSON.stringify(row)` instead of `auditSignableBytes(row)`
 * produces a signature that FAILS verification after the jsonb round trip. That
 * is the red-first proof — point the round-trip signer at the non-canonical
 * builder and the round-trip test goes red.
 */

import { generateKeyPairSync } from 'node:crypto';
import {
  type AuditSignable,
  auditSignableBytes,
  Ed25519AuditRowSigner,
  verifyAuditRow,
} from '@revealui/core/security';
import { type AuditEntry, type AuditRowSignerFn, DrizzleAuditStore } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { auditLog } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const KID = 'kid-test-1';

function makeKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

/** The REAL signer the door uses: canonical bytes → Ed25519 → wire string. */
function canonicalSignerFn(privateKeyPem: string): AuditRowSignerFn {
  const signer = new Ed25519AuditRowSigner(privateKeyPem, KID);
  return (row) => signer.sign(auditSignableBytes(row)).value;
}

/**
 * The DELIBERATELY BROKEN signer for the red-first proof: signs over
 * `JSON.stringify` (insertion order) instead of `auditSignableBytes` (RFC 8785
 * sorted). After the jsonb round trip the verifier re-derives canonical bytes,
 * which differ, so verification fails — the exact finding-2 defect.
 */
function nonCanonicalSignerFn(privateKeyPem: string): AuditRowSignerFn {
  const signer = new Ed25519AuditRowSigner(privateKeyPem, KID);
  return (row) => signer.sign(new TextEncoder().encode(JSON.stringify(row))).value;
}

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: `row-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date('2026-07-18T12:34:56.789Z'),
    eventType: 'agent:tool:called',
    severity: 'info',
    agentId: 'agent-1',
    taskId: undefined,
    sessionId: 'sess-1',
    // Keys deliberately NOT in sorted order — jsonb will reorder them, and only
    // canonicalization makes the readback reproduce the signed bytes.
    payload: { z: 1, tool: 'read', a: { d: 4, b: 2 } },
    policyViolations: [],
    tenant: 'acct_123',
    ...overrides,
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

describe('GAP-355 Stage 3 — signed row round trip through the one door', () => {
  let testDb: TestDb;
  let db: Database;
  let priv: string;
  let pub: string;
  const resolve = (kid: string): string | null => (kid === KID ? pub : null);

  beforeEach(async () => {
    testDb = await createTestDb();
    db = testDb.drizzle as unknown as Database;
    const kp = makeKeypair();
    priv = kp.privateKeyPem;
    pub = kp.publicKeyPem;
  });

  afterEach(async () => {
    await testDb.close();
  });

  it('a canonically-signed row verifies OFFLINE after the jsonb + timestamptz round trip', async () => {
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const entry = makeEntry();
    await store.append(entry);

    const [row] = await db.select().from(auditLog).where(eq(auditLog.id, entry.id));
    expect(row).toBeDefined();
    if (!row) throw new Error('row not found');
    expect(row.signature?.startsWith(`v1.ed25519.${KID}.`)).toBe(true);
    expect(Number(row.seq)).toBeGreaterThan(0);

    const result = verifyAuditRow(signableFromRow(row), row.signature ?? '', resolve);
    expect(result.reason).toBeUndefined();
    expect(result.valid).toBe(true);
  });

  it('a NON-CANONICAL signer (JSON.stringify) FAILS verification after readback (finding-2 guard / red-first)', async () => {
    const store = new DrizzleAuditStore(db, nonCanonicalSignerFn(priv));
    const entry = makeEntry();
    await store.append(entry);

    const [row] = await db.select().from(auditLog).where(eq(auditLog.id, entry.id));
    if (!row) throw new Error('row not found');
    const result = verifyAuditRow(signableFromRow(row), row.signature ?? '', resolve);
    expect(result.valid).toBe(false);
  });

  it('tampering ANY signed column (including seq) breaks verification', async () => {
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const entry = makeEntry();
    await store.append(entry);
    const [row] = await db.select().from(auditLog).where(eq(auditLog.id, entry.id));
    if (!row) throw new Error('row not found');
    const signable = signableFromRow(row);
    const sig = row.signature ?? '';

    for (const tampered of [
      { ...signable, severity: 'critical' },
      { ...signable, agentId: 'attacker' },
      { ...signable, payload: { z: 1, tool: 'delete', a: { d: 4, b: 2 } } },
      { ...signable, sequence: signable.sequence + 1 },
      { ...signable, tenant: 'acct_other' },
    ]) {
      expect(verifyAuditRow(tampered, sig, resolve).valid).toBe(false);
    }
  });

  it('a signer that THROWS makes append throw and lands NO row (fail-closed)', async () => {
    const throwing: AuditRowSignerFn = () => {
      throw new Error('signer boom');
    };
    const store = new DrizzleAuditStore(db, throwing);
    await expect(store.append(makeEntry())).rejects.toThrow('signer boom');

    const rows = await db.select().from(auditLog);
    expect(rows).toHaveLength(0);
  });

  it('unsigned mode (no signer) writes a NULL signature and a DB-assigned seq', async () => {
    const store = new DrizzleAuditStore(db);
    const entry = makeEntry();
    await store.append(entry);
    const [row] = await db.select().from(auditLog).where(eq(auditLog.id, entry.id));
    if (!row) throw new Error('row not found');
    expect(row.signature).toBeNull();
    expect(row.previousSignature).toBeNull();
    expect(Number(row.seq)).toBeGreaterThan(0);
  });

  it('appendBatch signs every row with its own fetched seq', async () => {
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const entries = [makeEntry(), makeEntry(), makeEntry()];
    await store.appendBatch(entries);

    const rows = await db.select().from(auditLog);
    expect(rows).toHaveLength(3);
    const seqs = new Set(rows.map((r) => Number(r.seq)));
    expect(seqs.size).toBe(3);
    for (const row of rows) {
      const result = verifyAuditRow(signableFromRow(row), row.signature ?? '', resolve);
      expect(result.valid).toBe(true);
    }
  });
});
