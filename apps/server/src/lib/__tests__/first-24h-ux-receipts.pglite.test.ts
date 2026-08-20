/**
 * First-24h Pro/Max UX verification receipts go through the ONE DOOR
 * (`DrizzleAuditStore.append` / `appendBatch`) into a real migrated
 * `audit_log` (PGlite). A markdown checklist is not a receipt.
 */
import { generateKeyPairSync } from 'node:crypto';
import {
  type AuditSignable,
  auditSignableBytes,
  Ed25519AuditRowSigner,
  verifyAuditRow,
} from '@revealui/core/security';
import { type AuditRowSignerFn, DrizzleAuditStore } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { auditLog } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FIRST_24H_UX_ACTOR_ID,
  FIRST_24H_UX_EVENT_TYPE,
  FIRST_24H_UX_REPORT_DATE,
  FIRST_24H_UX_SURFACES_2026_08_20,
  first24hPlanLabel,
  first24hUxGuaranteed,
  recordFirst24hUxReceipts,
} from '../first-24h-ux-receipts.js';

const KID = 'kid-first-24h-ux';

function makeKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

function canonicalSignerFn(privateKeyPem: string): AuditRowSignerFn {
  const signer = new Ed25519AuditRowSigner(privateKeyPem, KID);
  return (row) => signer.sign(auditSignableBytes(row)).value;
}

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

function payloadOf(row: typeof auditLog.$inferSelect): Record<string, unknown> {
  return (row.payload ?? {}) as Record<string, unknown>;
}

describe('first-24h UX receipts — real audit_log door (PGlite)', () => {
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

  it('appends one signed audit_log row per surface; Max rows say Max; no Merkle root claim', async () => {
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const timestamp = new Date('2026-08-20T16:00:00.000Z');
    const ids = await recordFirst24hUxReceipts(store, {
      reportDate: FIRST_24H_UX_REPORT_DATE,
      actorId: FIRST_24H_UX_ACTOR_ID,
      lines: FIRST_24H_UX_SURFACES_2026_08_20,
      timestamp,
    });

    expect(ids).toHaveLength(FIRST_24H_UX_SURFACES_2026_08_20.length);
    const rows = await db.select().from(auditLog);
    expect(rows).toHaveLength(FIRST_24H_UX_SURFACES_2026_08_20.length);

    for (const row of rows) {
      expect(row.eventType).toBe(FIRST_24H_UX_EVENT_TYPE);
      expect(row.agentId).toBe(FIRST_24H_UX_ACTOR_ID);
      expect(row.signature?.startsWith(`v1.ed25519.${KID}.`)).toBe(true);
      expect(Number(row.seq)).toBeGreaterThan(0);
      const verified = verifyAuditRow(signableFromRow(row), row.signature ?? '', resolve);
      expect(verified.valid).toBe(true);

      const payload = payloadOf(row);
      expect(payload.actor).toBe(FIRST_24H_UX_ACTOR_ID);
      expect(payload.merkleRootDelivered).toBe(false);
      expect(payload.reportDate).toBe(FIRST_24H_UX_REPORT_DATE);
      expect(typeof payload.action).toBe('string');
      expect(typeof payload.evidence).toBe('string');
      expect(payload.timestamp).toBe(timestamp.toISOString());
      expect(['PASS', 'FAIL', 'SKIP']).toContain(payload.result);

      if (payload.plan === 'max') {
        expect(payload.planLabel).toBe('Max');
        expect(payload.planLabel).not.toBe('Pro');
        expect(first24hPlanLabel('max')).toBe('Max');
      }
    }

    const maxRows = rows.filter((row) => payloadOf(row).plan === 'max');
    expect(maxRows.length).toBeGreaterThan(0);
    expect(first24hUxGuaranteed(FIRST_24H_UX_SURFACES_2026_08_20)).toBe(false);
  });

  it('lands unsigned rows when the test harness has no signer', async () => {
    const store = new DrizzleAuditStore(db);
    const [line] = FIRST_24H_UX_SURFACES_2026_08_20;
    if (!line) throw new Error('catalog empty');
    const [id] = await recordFirst24hUxReceipts(store, {
      reportDate: FIRST_24H_UX_REPORT_DATE,
      actorId: FIRST_24H_UX_ACTOR_ID,
      lines: [line],
    });
    const [row] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, id ?? ''));
    expect(row).toBeDefined();
    expect(row?.signature).toBeNull();
    expect(row?.eventType).toBe(FIRST_24H_UX_EVENT_TYPE);
  });
});
