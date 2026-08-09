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
import { auditAnchors, usageMeters } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertTraversalIntegrity,
  isConsecutiveFromStart,
  planContiguousBatch,
  planTraversableBatch,
  type ScopeRangeRow,
  type SignedAuditRow,
} from '../audit-anchor-batch.js';
import { runAuditAnchorSweep, SYSTEM_ANCHOR_SCOPE } from '../audit-anchor-sweep.js';

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

describe('planTraversableBatch (GAP-447 existence-classified hole traversal)', () => {
  it('returns null for empty candidates', () => {
    expect(planTraversableBatch(0, [], new Map())).toBeNull();
  });

  it('lastAnchoredSeq=0: permissive start — walk begins at the first candidate, not seq 1', () => {
    const rows: SignedAuditRow[] = [{ seq: 5, signature: 's5' }];
    const result = planTraversableBatch(0, rows, new Map());
    expect(result).toEqual({
      rows,
      seqFrom: 5,
      seqTo: 5,
      holes: { burned: [], foreign: 0 },
    });
  });

  it('lastAnchoredSeq=0 with internally non-contiguous candidates: gaps between them are still traversed', () => {
    const rows: SignedAuditRow[] = [
      { seq: 1, signature: 'a' },
      { seq: 3, signature: 'c' },
    ];
    const rangeMap = new Map<number, ScopeRangeRow>([[2, { sameScope: false, signed: true }]]);
    const result = planTraversableBatch(0, rows, rangeMap);
    expect(result).toEqual({
      rows,
      seqFrom: 1,
      seqTo: 3,
      holes: { burned: [], foreign: 1 },
    });
  });

  it('burned seq (absent from rangeMap) is traversable', () => {
    const rows: SignedAuditRow[] = [
      { seq: 1, signature: 'a' },
      { seq: 3, signature: 'c' },
    ];
    const result = planTraversableBatch(0, rows, new Map()); // seq 2 absent entirely
    expect(result).toEqual({
      rows,
      seqFrom: 1,
      seqTo: 3,
      holes: { burned: [2], foreign: 0 },
    });
  });

  it('foreign-scope present row is traversable (count only, not enumerated)', () => {
    const rows: SignedAuditRow[] = [
      { seq: 1, signature: 'a' },
      { seq: 3, signature: 'c' },
    ];
    const rangeMap = new Map<number, ScopeRangeRow>([[2, { sameScope: false, signed: true }]]);
    const result = planTraversableBatch(0, rows, rangeMap);
    expect(result?.holes).toEqual({ burned: [], foreign: 1 });
  });

  it('present + same-scope + unsigned row FAILS CLOSED and stalls before it', () => {
    const rows: SignedAuditRow[] = [
      { seq: 1, signature: 'a' },
      { seq: 3, signature: 'c' },
    ];
    const rangeMap = new Map<number, ScopeRangeRow>([[2, { sameScope: true, signed: false }]]);
    const result = planTraversableBatch(0, rows, rangeMap);
    expect(result).toEqual({
      rows: [{ seq: 1, signature: 'a' }],
      seqFrom: 1,
      seqTo: 1,
      holes: { burned: [], foreign: 0 },
      stalledAtSeq: 2,
    });
  });

  it('stall right at the very start (no progress) still returns a result, not null', () => {
    // lastAnchoredSeq=10 (an established anchor/floor): the walk must start
    // exactly at seq 11, so the same-scope-unsigned row there stalls with
    // zero rows collected, distinct from "no candidates at all" (null).
    const rows: SignedAuditRow[] = [{ seq: 13, signature: 'c' }];
    const rangeMap = new Map<number, ScopeRangeRow>([
      [11, { sameScope: true, signed: false }],
      [12, { sameScope: false, signed: true }],
    ]);
    const result = planTraversableBatch(10, rows, rangeMap);
    expect(result).toEqual({
      rows: [],
      seqFrom: 11,
      seqTo: 10,
      holes: { burned: [], foreign: 0 },
      stalledAtSeq: 11,
    });
  });

  it('lastAnchoredSeq>0: an established anchor requires the full range attested, not just the first candidate', () => {
    const rows: SignedAuditRow[] = [{ seq: 13, signature: 's13' }];
    const rangeMap = new Map<number, ScopeRangeRow>([[12, { sameScope: false, signed: true }]]);
    // seq 11 absent (burned), seq 12 foreign, seq 13 the candidate.
    const result = planTraversableBatch(10, rows, rangeMap);
    expect(result).toEqual({
      rows,
      seqFrom: 11,
      seqTo: 13,
      holes: { burned: [11], foreign: 1 },
    });
  });

  it('no holes at all when candidates are already contiguous', () => {
    const rows: SignedAuditRow[] = [
      { seq: 11, signature: 'a' },
      { seq: 12, signature: 'b' },
      { seq: 13, signature: 'c' },
    ];
    const result = planTraversableBatch(10, rows, new Map());
    expect(result).toEqual({ rows, seqFrom: 11, seqTo: 13, holes: { burned: [], foreign: 0 } });
  });
});

describe('isConsecutiveFromStart', () => {
  it('true for empty candidates', () => {
    expect(isConsecutiveFromStart(0, [])).toBe(true);
  });

  it('true when contiguous with lastAnchoredSeq', () => {
    expect(
      isConsecutiveFromStart(10, [
        { seq: 11, signature: 'a' },
        { seq: 12, signature: 'b' },
      ]),
    ).toBe(true);
  });

  it('false when the first candidate does not follow lastAnchoredSeq', () => {
    expect(isConsecutiveFromStart(10, [{ seq: 13, signature: 'a' }])).toBe(false);
  });

  it('false when candidates have an internal gap, even with lastAnchoredSeq=0', () => {
    expect(
      isConsecutiveFromStart(0, [
        { seq: 1, signature: 'a' },
        { seq: 3, signature: 'b' },
      ]),
    ).toBe(false);
  });
});

describe('assertTraversalIntegrity', () => {
  it('passes for a consistent result (span == leaves + holes)', () => {
    expect(() =>
      assertTraversalIntegrity({
        rows: [{ seq: 11, signature: 'a' }],
        seqFrom: 10,
        seqTo: 12,
        holes: { burned: [10], foreign: 1 },
      }),
    ).not.toThrow();
  });

  it('throws when the recorded holes do not account for the full span', () => {
    expect(() =>
      assertTraversalIntegrity({
        rows: [{ seq: 11, signature: 'a' }],
        seqFrom: 10,
        seqTo: 12,
        holes: { burned: [], foreign: 0 }, // missing 2 holes
      }),
    ).toThrow(/span/);
  });

  it('throws on an empty batch', () => {
    expect(() =>
      assertTraversalIntegrity({
        rows: [],
        seqFrom: 1,
        seqTo: 1,
        holes: { burned: [], foreign: 0 },
      }),
    ).toThrow(/empty batch/);
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

  /**
   * GAP-447: burn a seq value the same way production does — `nextval()` the
   * bigserial sequence with no corresponding INSERT. The append-only trigger
   * makes the row undeletable, so this is the only way a real seq gap forms.
   */
  async function burnSeq(): Promise<void> {
    await db.execute(sql`SELECT nextval(pg_get_serial_sequence('audit_log', 'seq'))`);
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

  it('GAP-427: counts null-tenant signed rows and anchors them under the system scope, not per-tenant', async () => {
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
    // The per-tenant loop never treats the null-tenant row as a "tenant" key.
    const tenantAnchors = await db
      .select()
      .from(auditAnchors)
      .where(eq(auditAnchors.tenant, 'acct_max'));
    expect(tenantAnchors).toHaveLength(1);
    // It anchors separately, via the system-scope pass.
    expect(result.systemOutcome).toBe('inserted');
    const systemAnchors = await db
      .select()
      .from(auditAnchors)
      .where(eq(auditAnchors.tenant, SYSTEM_ANCHOR_SCOPE));
    expect(systemAnchors).toHaveLength(1);
    expect(systemAnchors[0]?.leafCount).toBe(1);
  });

  it('GAP-427: system scope anchors signed null-tenant rows above the null-tenant unsigned floor', async () => {
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const unsignedStore = new DrizzleAuditStore(db); // pre-enforcement legacy rows, no signer

    // Legacy era (closed): unsigned null-tenant seq 1. Signed era: seq 2..3.
    await unsignedStore.append(makeEntry({ id: 'sys-u1', tenant: null }));
    await signedStore.append(makeEntry({ id: 'sys-s2', tenant: null }));
    await signedStore.append(makeEntry({ id: 'sys-s3', tenant: null }));

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 2,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });

    expect(result.systemOutcome).toBe('inserted');
    expect(result.tenantsFloorEngaged).toBe(1);
    expect(result.anchorsInserted).toBe(1);

    const anchors = await db
      .select()
      .from(auditAnchors)
      .where(eq(auditAnchors.tenant, SYSTEM_ANCHOR_SCOPE));
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.seqFrom).toBe(2);
    expect(anchors[0]?.seqTo).toBe(3);

    // No account FK backs a null tenant — the system pass must never meter.
    const meters = await db.select().from(usageMeters);
    expect(meters).toHaveLength(0);
  });

  it('GAP-427: systemOutcome is skipped when there are no null-tenant rows', async () => {
    await appendSigned(3, 'acct_max', new Date('2026-07-23T12:00:00.000Z'));

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 3,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });

    expect(result.systemOutcome).toBe('skipped');
    expect(result.nullTenantSignedRows).toBe(0);
    const systemAnchors = await db
      .select()
      .from(auditAnchors)
      .where(eq(auditAnchors.tenant, SYSTEM_ANCHOR_SCOPE));
    expect(systemAnchors).toHaveLength(0);
  });

  it('GAP-427: a tenant anchor and the system anchor both land in one sweep', async () => {
    // Non-interleaved seq runs (tenant rows first, then null-tenant rows) —
    // the global-seq interleave limitation is pre-existing and out of scope.
    await appendSigned(2, 'acct_max', new Date('2026-07-23T12:00:00.000Z'));
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    await store.append(
      makeEntry({ id: 'sys-1', tenant: null, timestamp: new Date('2026-07-23T12:00:01.000Z') }),
    );
    await store.append(
      makeEntry({ id: 'sys-2', tenant: null, timestamp: new Date('2026-07-23T12:00:02.000Z') }),
    );

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 2,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });

    expect(result.anchorsInserted).toBe(2);
    expect(result.systemOutcome).toBe('inserted');

    const tenantAnchors = await db
      .select()
      .from(auditAnchors)
      .where(eq(auditAnchors.tenant, 'acct_max'));
    expect(tenantAnchors).toHaveLength(1);
    expect(tenantAnchors[0]?.seqFrom).toBe(1);
    expect(tenantAnchors[0]?.seqTo).toBe(2);

    const systemAnchors = await db
      .select()
      .from(auditAnchors)
      .where(eq(auditAnchors.tenant, SYSTEM_ANCHOR_SCOPE));
    expect(systemAnchors).toHaveLength(1);
    expect(systemAnchors[0]?.seqFrom).toBe(3);
    expect(systemAnchors[0]?.seqTo).toBe(4);
  });

  it('skips when an unsigned hole appears above an existing anchor (strict contiguity)', async () => {
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const unsignedStore = new DrizzleAuditStore(db); // no signer → signature null

    // Anchor seq 1 first, THEN an unsigned row lands above it. Post-GAP-417
    // rails this cannot happen in prod; if it does, it is a genuine integrity
    // signal — the sweep must stall on it, never jump it (GAP-427 floor only
    // applies while a tenant has no anchors at all).
    await signedStore.append(makeEntry({ id: 's1', tenant: 'acct_max' }));
    const first = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 1,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });
    expect(first.anchorsInserted).toBe(1);

    await unsignedStore.append(makeEntry({ id: 'u2', tenant: 'acct_max' }));
    await signedStore.append(makeEntry({ id: 's3', tenant: 'acct_max' }));

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

  it('GAP-427: first anchor starts above the closed unsigned legacy era (floor)', async () => {
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const unsignedStore = new DrizzleAuditStore(db); // pre-enforcement legacy rows

    // Legacy era (closed): unsigned seq 1, signed seq 2 interleaved, unsigned
    // seq 3. Signed era: seq 4..5. Mirrors the prod shape from the GAP-417
    // item-4 sweep (unsigned rows interleaved up to the floor).
    await unsignedStore.append(makeEntry({ id: 'u1', tenant: 'acct_max' }));
    await signedStore.append(makeEntry({ id: 's2', tenant: 'acct_max' }));
    await unsignedStore.append(makeEntry({ id: 'u3', tenant: 'acct_max' }));
    await signedStore.append(makeEntry({ id: 's4', tenant: 'acct_max' }));
    await signedStore.append(makeEntry({ id: 's5', tenant: 'acct_max' }));

    // Without the floor the sweep anchors the interleaved legacy prefix
    // [2..2] on pass one, then gap-stalls forever at the unsigned hole — the
    // signed era 4..5 never anchors (proven red against the base code).
    const sweepOptions = {
      db,
      signer: cryptoSigner,
      batchSize: 2,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    };
    const first = await runAuditAnchorSweep(sweepOptions);
    expect(first.anchorsInserted).toBe(1);
    expect(first.tenantsFloorEngaged).toBe(1); // GAP-429: engagement is observable
    const second = await runAuditAnchorSweep(sweepOptions);
    expect(second.anchorsInserted).toBe(0);
    expect(second.tenantsFloorEngaged).toBe(0); // anchors exist now — floor not consulted

    // Floor = 3 (highest unsigned seq): the one anchor covers exactly the
    // signed era. Legacy rows 1..3 (unsigned + interleaved signed) stay
    // unanchored and are never retro-signed.
    const anchors = await db.select().from(auditAnchors).where(eq(auditAnchors.tenant, 'acct_max'));
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.seqFrom).toBe(4);
    expect(anchors[0]?.seqTo).toBe(5);
  });

  it('GAP-429: floor above the entire signed era reports engagement and anchors nothing', async () => {
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const unsignedStore = new DrizzleAuditStore(db);
    // Signed seq 1 sits below the floor (unsigned seq 2 closed the era); there
    // is no signed era above the floor, so the sweep has nothing to anchor —
    // but the engagement must still be visible, not a silent skip.
    await signedStore.append(makeEntry({ id: 's1', tenant: 'acct_max' }));
    await unsignedStore.append(makeEntry({ id: 'u2', tenant: 'acct_max' }));

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 1,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-23T12:00:10.000Z'),
    });

    expect(result.tenantsFloorEngaged).toBe(1);
    expect(result.anchorsInserted).toBe(0);
    expect(result.tenantsSkipped).toBe(1);
    expect(result.errors).toEqual([]);
    expect(await db.select().from(auditAnchors)).toHaveLength(0);
  });

  it('GAP-429: floor-engaged log fires once per tenant per process (metric every pass)', async () => {
    // Unique tenant: the throttle Set is module-level, so tenants used by
    // earlier tests in this file may already be marked as logged.
    const tenant = 'acct_throttle_only';
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const unsignedStore = new DrizzleAuditStore(db);
    await signedStore.append(makeEntry({ id: 'th-s1', tenant }));
    await unsignedStore.append(makeEntry({ id: 'th-u2', tenant }));

    const { logger } = await import('@revealui/core/observability/logger');
    const infoSpy = vi.spyOn(logger, 'info');
    try {
      const sweepOptions = {
        db,
        signer: cryptoSigner,
        batchSize: 1,
        canAnchorTenant: async () => true,
        recordMeter: false,
        now: () => new Date('2026-07-23T12:00:10.000Z'),
      };
      const first = await runAuditAnchorSweep(sweepOptions);
      const second = await runAuditAnchorSweep(sweepOptions);
      // Engagement stays observable in the result on EVERY pass...
      expect(first.tenantsFloorEngaged).toBe(1);
      expect(second.tenantsFloorEngaged).toBe(1);
      // ...but the log line fires only once for the tenant.
      const floorLogs = infoSpy.mock.calls.filter((call) =>
        String(call[0]).includes(`legacy floor engaged tenant=${tenant}`),
      );
      expect(floorLogs).toHaveLength(1);
    } finally {
      infoSpy.mockRestore();
    }
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

  // ── GAP-447: existence-classified hole traversal ──────────────────────────

  it('GAP-447: anchors across a burned seq and records it in holes.burned', async () => {
    const ts = new Date('2026-07-27T09:00:00.000Z');
    await appendSigned(1, 'acct_max', ts); // seq 1
    await burnSeq(); // seq 2, no row
    await appendSigned(1, 'acct_max', new Date(ts.getTime() + 1000)); // seq 3

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 2,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-27T09:00:10.000Z'),
    });

    expect(result.anchorsInserted).toBe(1);
    expect(result.errors).toEqual([]);

    const anchors = await db.select().from(auditAnchors).where(eq(auditAnchors.tenant, 'acct_max'));
    expect(anchors).toHaveLength(1);
    const a = anchors[0];
    if (!a) throw new Error('missing anchor');
    expect(a.seqFrom).toBe(1);
    expect(a.seqTo).toBe(3);
    expect(a.leafCount).toBe(2);
    expect(a.holes).toEqual({ burned: [2], foreign: 0 });

    const verify = verifyAuditAnchorRoot(
      {
        tenant: a.tenant,
        seqFrom: a.seqFrom,
        seqTo: a.seqTo,
        leafCount: a.leafCount,
        root: a.root,
        holes: a.holes ?? undefined,
      },
      a.rootSignature,
      (kid) => (kid === KID ? pub : null),
    );
    expect(verify.valid).toBe(true);
  });

  it('GAP-447: cross-scope interleave — system anchors across a tenant row (holes.foreign), tenant anchors its own row', async () => {
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    await store.append(
      makeEntry({ id: 'sys-1', tenant: null, timestamp: new Date('2026-07-27T09:00:00.000Z') }),
    ); // seq 1
    await store.append(
      makeEntry({ id: 't-1', tenant: 'acct_max', timestamp: new Date('2026-07-27T09:00:01.000Z') }),
    ); // seq 2
    await store.append(
      makeEntry({ id: 'sys-2', tenant: null, timestamp: new Date('2026-07-27T09:00:02.000Z') }),
    ); // seq 3

    const result = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 2, // system scope must fetch BOTH seq1 and seq3 as candidates in one query
      maxLagMs: 1, // tenant's lone leaf (below batchSize) anchors via max-lag instead
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-27T09:00:10.000Z'),
    });

    expect(result.systemOutcome).toBe('inserted');
    expect(result.anchorsInserted).toBe(2);

    const systemAnchors = await db
      .select()
      .from(auditAnchors)
      .where(eq(auditAnchors.tenant, SYSTEM_ANCHOR_SCOPE));
    expect(systemAnchors).toHaveLength(1);
    expect(systemAnchors[0]?.seqFrom).toBe(1);
    expect(systemAnchors[0]?.seqTo).toBe(3);
    expect(systemAnchors[0]?.leafCount).toBe(2);
    expect(systemAnchors[0]?.holes).toEqual({ burned: [], foreign: 1 });

    const tenantAnchors = await db
      .select()
      .from(auditAnchors)
      .where(eq(auditAnchors.tenant, 'acct_max'));
    expect(tenantAnchors).toHaveLength(1);
    expect(tenantAnchors[0]?.seqFrom).toBe(2);
    expect(tenantAnchors[0]?.seqTo).toBe(2);
    expect(tenantAnchors[0]?.holes).toBeNull();
  });

  it('GAP-447: a same-scope UNSIGNED row inside the hole fails closed — stalls, warns, anchors nothing past it', async () => {
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const unsignedStore = new DrizzleAuditStore(db);

    // Establish a real prior anchor first, so `last=anchored` (not the
    // GAP-427 legacy floor, which would otherwise silently jump past an
    // unsigned row on a scope's very first pass — that path is pre-existing
    // and out of scope here; GAP-447 fail-closed is about a scope that
    // ALREADY anchors normally hitting a genuinely anomalous unsigned row).
    await signedStore.append(makeEntry({ id: 's1', tenant: 'acct_max' })); // seq 1
    const first = await runAuditAnchorSweep({
      db,
      signer: cryptoSigner,
      batchSize: 1,
      canAnchorTenant: async () => true,
      recordMeter: false,
      now: () => new Date('2026-07-27T09:00:10.000Z'),
    });
    expect(first.anchorsInserted).toBe(1);

    await unsignedStore.append(makeEntry({ id: 'u2', tenant: 'acct_max' })); // seq 2 — genuine anomaly
    await signedStore.append(makeEntry({ id: 's3', tenant: 'acct_max' })); // seq 3

    const { logger } = await import('@revealui/core/observability/logger');
    const warnSpy = vi.spyOn(logger, 'warn');
    try {
      const second = await runAuditAnchorSweep({
        db,
        signer: cryptoSigner,
        batchSize: 1,
        canAnchorTenant: async () => true,
        recordMeter: false,
        now: () => new Date('2026-07-27T09:00:20.000Z'),
      });

      // The stall happens right at the start of this pass's range (seq 2,
      // immediately after last=1) — zero forward progress, so this pass
      // inserts nothing further.
      expect(second.anchorsInserted).toBe(0);
      expect(second.errors).toEqual([]);

      const anchors = await db
        .select()
        .from(auditAnchors)
        .where(eq(auditAnchors.tenant, 'acct_max'));
      expect(anchors).toHaveLength(1); // still just the first pass's anchor
      expect(anchors[0]?.seqFrom).toBe(1);
      expect(anchors[0]?.seqTo).toBe(1); // nothing anchored past the unsigned row
      expect(anchors[0]?.holes).toBeNull();

      const stallWarns = warnSpy.mock.calls.filter(
        (call) => String(call[0]).includes('blocks traversal') && String(call[0]).includes('seq=2'),
      );
      expect(stallWarns.length).toBeGreaterThan(0);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
