/**
 * GAP-355 S4-3 — unit (batch planner) + PGlite integration (sweep).
 */

import { generateKeyPairSync } from 'node:crypto';
import {
  type AuditSignable,
  auditSignableBytes,
  Ed25519AuditRowSigner,
  verifyAuditAnchorRoot,
} from '@revealui/core/security';
import { type AuditEntry, type AuditRowSignerFn, DrizzleAuditStore } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { auditAnchors } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import { planContiguousBatch, type SignedAuditRow } from '../audit-anchor-batch.js';
import { runAuditAnchorSweep } from '../audit-anchor-sweep.js';

const KID = 'kid-s4-3';

function makeKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

function canonicalSignerFn(privateKeyPem: string): AuditRowSignerFn {
  const signer = new Ed25519AuditRowSigner(privateKeyPem, KID);
  return (row: AuditSignable) => signer.sign(auditSignableBytes(row)).value;
}

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: `row-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date('2026-07-23T10:00:00.000Z'),
    eventType: 'agent:tool:called',
    severity: 'info',
    agentId: 'agent-1',
    taskId: undefined,
    sessionId: 'sess-1',
    payload: { tool: 'read' },
    policyViolations: [],
    tenant: 'acct_max',
    ...overrides,
  };
}

describe('planContiguousBatch (GAP-355 S4-3)', () => {
  it('returns null for empty input', () => {
    expect(planContiguousBatch(0, [])).toBeNull();
  });

  it('accepts a contiguous batch when lastAnchored is 0', () => {
    const rows: SignedAuditRow[] = [
      { seq: 5, signature: 's5' },
      { seq: 6, signature: 's6' },
      { seq: 7, signature: 's7' },
    ];
    expect(planContiguousBatch(0, rows)).toEqual(rows);
  });

  it('requires next seq = last+1 when lastAnchored > 0', () => {
    const rows: SignedAuditRow[] = [
      { seq: 12, signature: 's12' },
      { seq: 13, signature: 's13' },
    ];
    expect(planContiguousBatch(10, rows)).toBeNull();
    expect(planContiguousBatch(11, rows)).toEqual(rows);
  });

  it('takes longest contiguous prefix when a mid-batch gap appears', () => {
    const rows: SignedAuditRow[] = [
      { seq: 1, signature: 'a' },
      { seq: 2, signature: 'b' },
      { seq: 4, signature: 'c' },
    ];
    expect(planContiguousBatch(0, rows)).toEqual([
      { seq: 1, signature: 'a' },
      { seq: 2, signature: 'b' },
    ]);
  });
});

describe('runAuditAnchorSweep (PGlite)', () => {
  let testDb: TestDb;
  let db: Database;
  let priv: string;
  let pub: string;
  let cryptoSigner: Ed25519AuditRowSigner;

  beforeEach(async () => {
    testDb = await createTestDb();
    db = testDb.drizzle as unknown as Database;
    const kp = makeKeypair();
    priv = kp.privateKeyPem;
    pub = kp.publicKeyPem;
    cryptoSigner = new Ed25519AuditRowSigner(priv, KID);
  });

  afterEach(async () => {
    await testDb.close();
  });

  async function appendSigned(n: number, tenant: string, ts: Date): Promise<void> {
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    for (let i = 0; i < n; i++) {
      await store.append(
        makeEntry({
          id: `row-${tenant}-${ts.getTime()}-${i}`,
          tenant,
          timestamp: new Date(ts.getTime() + i * 1000),
        }),
      );
    }
  }

  it('inserts a verifiable anchor when batch size is reached', async () => {
    await appendSigned(3, 'acct_max', new Date('2026-07-23T12:00:00.000Z'));

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 3,
      maxLagMs: 60 * 60 * 1000,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });

    expect(result.anchorsInserted).toBe(1);
    expect(result.errors).toEqual([]);

    const anchors = await db.select().from(auditAnchors).where(eq(auditAnchors.tenant, 'acct_max'));
    expect(anchors).toHaveLength(1);
    const a = anchors[0];
    if (!a) throw new Error('missing anchor');
    expect(a.leafCount).toBe(3);
    expect(a.seqFrom).toBe(1);
    expect(a.seqTo).toBe(3);

    const verify = verifyAuditAnchorRoot(
      {
        tenant: a.tenant,
        seqFrom: a.seqFrom,
        seqTo: a.seqTo,
        leafCount: a.leafCount,
        root: a.root,
      },
      a.rootSignature,
      (kid) => (kid === KID ? pub : null),
    );
    expect(verify.valid).toBe(true);
  });

  it('waits when under batch size and under max lag', async () => {
    await appendSigned(2, 'acct_max', new Date('2026-07-23T12:00:00.000Z'));

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 256,
      maxLagMs: 60 * 60 * 1000,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:30.000Z'), // 30s < 1h
    });

    expect(result.anchorsInserted).toBe(0);
    expect(result.tenantsWaiting).toBe(1);
    const anchors = await db.select().from(auditAnchors);
    expect(anchors).toHaveLength(0);
  });

  it('anchors a partial batch when max lag is exceeded', async () => {
    await appendSigned(2, 'acct_max', new Date('2026-07-23T10:00:00.000Z'));

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 256,
      maxLagMs: 60 * 60 * 1000,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T11:05:00.000Z'), // > 1h past first row
    });

    expect(result.anchorsInserted).toBe(1);
    const anchors = await db.select().from(auditAnchors);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.leafCount).toBe(2);
  });

  it('skips tenants without auditLog entitlement', async () => {
    await appendSigned(3, 'acct_free', new Date('2026-07-23T12:00:00.000Z'));

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 3,
      canAnchorTenant: async () => false,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });

    expect(result.anchorsInserted).toBe(0);
    expect(result.tenantsSkipped).toBe(1);
    expect(await db.select().from(auditAnchors)).toHaveLength(0);
  });

  it('counts null-tenant signed rows and never anchors them', async () => {
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    await store.append(makeEntry({ tenant: null, id: 'null-tenant-1' }));
    await store.append(makeEntry({ tenant: 'acct_max', id: 't1' }));
    await store.append(makeEntry({ tenant: 'acct_max', id: 't2' }));
    await store.append(makeEntry({ tenant: 'acct_max', id: 't3' }));

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 3,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });

    expect(result.nullTenantSignedRows).toBe(1);
    const anchors = await db.select().from(auditAnchors);
    expect(anchors.every((a) => a.tenant !== null && a.tenant.length > 0)).toBe(true);
    // null-tenant row is not in any anchor range as a tenant key
    expect(anchors.some((a) => a.tenant === '')).toBe(false);
  });

  it('skips when signed seqs jump after last anchor (unsigned hole)', async () => {
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const unsignedStore = new DrizzleAuditStore(db); // no signer → signature null
    await signedStore.append(makeEntry({ id: 's1', tenant: 'acct_max' }));
    await unsignedStore.append(makeEntry({ id: 'u2', tenant: 'acct_max' }));
    await signedStore.append(makeEntry({ id: 's3', tenant: 'acct_max' }));

    // First pass anchors contiguous prefix [seq 1] only (size/lag ready).
    const first = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 1,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });
    expect(first.anchorsInserted).toBe(1);

    // last=1; next signed is seq 3 (seq 2 unsigned). Gap → no further insert.
    const second = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 1,
      maxLagMs: 1,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T15:00:00.000Z'),
    });
    expect(second.anchorsInserted).toBe(0);
    const anchors = await db.select().from(auditAnchors).where(eq(auditAnchors.tenant, 'acct_max'));
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.seqTo).toBe(1);
  });

  it('no-ops without a signer (unsigned mode)', async () => {
    await appendSigned(3, 'acct_max', new Date('2026-07-23T12:00:00.000Z'));
    const result = await runAuditAnchorSweep({
      db,
      signer: null,
      batchSize: 3,
      canAnchorTenant: async () => true,
      recordMeter: false,
    });
    expect(result.anchorsInserted).toBe(0);
    expect(await db.select().from(auditAnchors)).toHaveLength(0);
  });
});
