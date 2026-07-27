/**
 * GAP-355 Stage 4 S4-4 — audit anchor list + inclusion proof API.
 *
 * Covers: 401 unauthenticated, 404 no membership, list shape + lag,
 * proof happy path, wrong tenant 404, out-of-range seq, delivery mark.
 * Public-key contract remains in audit-public-key.test.ts.
 */

import { generateKeyPairSync } from 'node:crypto';
import {
  type AuditSignable,
  auditSignableBytes,
  buildMerkleRootFromSignatures,
  Ed25519AuditRowSigner,
  signAuditAnchorRoot,
  verifyInclusionProof,
} from '@revealui/core/security';
import { type AuditEntry, type AuditRowSignerFn, DrizzleAuditStore } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { accountMemberships, accounts, auditAnchors, auditLog, users } from '@revealui/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import { SYSTEM_ANCHOR_SCOPE } from '../../jobs/audit-anchor-sweep.js';
import auditRoute from '../audit.js';

const KID = 'kid-s4-4';

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
    timestamp: new Date('2026-07-23T14:00:00.000Z'),
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

interface MockUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

function createAuthedApp(user?: MockUser, db?: Database) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper Variables
  const app = new Hono<{ Variables: { user: any; db: any } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    if (db) c.set('db', db);
    await next();
  });
  app.route('/', auditRoute);
  return app;
}

describe('GET /anchors + /anchors/:id/proof (GAP-355 S4-4, PGlite)', () => {
  let testDb: TestDb;
  let db: Database;
  let priv: string;
  let cryptoSigner: Ed25519AuditRowSigner;
  const user: MockUser = {
    id: 'user-1',
    email: 'max@test.com',
    name: 'Max',
    role: 'admin',
  };

  beforeEach(async () => {
    testDb = await createTestDb();
    db = testDb.drizzle as unknown as Database;
    const kp = makeKeypair();
    priv = kp.privateKeyPem;
    cryptoSigner = new Ed25519AuditRowSigner(priv, KID);

    await db.insert(users).values({
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'admin',
      status: 'active',
    });
    await db.insert(accounts).values({
      id: 'acct_max',
      name: 'Max Account',
      slug: 'max-account',
      status: 'active',
    });
    await db.insert(accountMemberships).values({
      id: 'mem-1',
      accountId: 'acct_max',
      userId: user.id,
      role: 'owner',
      status: 'active',
    });
  });

  afterEach(async () => {
    await testDb.close();
  });

  async function seedSignedRows(
    n: number,
  ): Promise<{ signatures: string[]; seqFrom: number; seqTo: number }> {
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    for (let i = 0; i < n; i++) {
      await store.append(
        makeEntry({
          id: `row-${i}`,
          tenant: 'acct_max',
          timestamp: new Date(`2026-07-23T14:00:0${i}.000Z`),
        }),
      );
    }
    const signed = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.tenant, 'acct_max'))
      .orderBy(asc(auditLog.seq));
    const signatures = signed.map((r) => {
      if (!r.signature) throw new Error('missing sig');
      return r.signature;
    });
    const seqFrom = signed[0]?.seq ?? 0;
    const seqTo = signed[signed.length - 1]?.seq ?? 0;
    return { signatures, seqFrom, seqTo };
  }

  async function insertAnchor(
    signatures: string[],
    seqFrom: number,
    seqTo: number,
  ): Promise<string> {
    const { root, leafCount } = buildMerkleRootFromSignatures(signatures);
    const { value: rootSignature } = signAuditAnchorRoot(cryptoSigner, {
      tenant: 'acct_max',
      seqFrom,
      seqTo,
      leafCount,
      root,
    });
    const [row] = await db
      .insert(auditAnchors)
      .values({
        tenant: 'acct_max',
        seqFrom,
        seqTo,
        root,
        rootSignature,
        leafCount,
      })
      .returning({ id: auditAnchors.id });
    if (!row) throw new Error('insert failed');
    return row.id;
  }

  it('GAP-447: surfaces holes in the list response and proves a leaf by position, not seq offset', async () => {
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    await signedStore.append(makeEntry({ id: 'h1', tenant: 'acct_max' })); // seq 1
    await db.execute(sql`SELECT nextval(pg_get_serial_sequence('audit_log', 'seq'))`); // burn seq 2
    await signedStore.append(makeEntry({ id: 'h3', tenant: 'acct_max' })); // seq 3

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.tenant, 'acct_max'))
      .orderBy(asc(auditLog.seq));
    const signatures = rows.map((r) => {
      if (!r.signature) throw new Error('missing sig');
      return r.signature;
    });
    const { root, leafCount } = buildMerkleRootFromSignatures(signatures);
    const holes = { burned: [2], foreign: 0 };
    const { value: rootSignature } = signAuditAnchorRoot(cryptoSigner, {
      tenant: 'acct_max',
      seqFrom: 1,
      seqTo: 3,
      leafCount,
      root,
      holes,
    });
    const [inserted] = await db
      .insert(auditAnchors)
      .values({ tenant: 'acct_max', seqFrom: 1, seqTo: 3, root, rootSignature, leafCount, holes })
      .returning({ id: auditAnchors.id });
    if (!inserted) throw new Error('insert failed');

    const app = createAuthedApp(user, db);

    const listRes = await app.request('/anchors');
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      anchors: Array<{ id: string; holes: { burned: number[]; foreign: number } | null }>;
    };
    expect(listBody.anchors[0]?.holes).toEqual(holes);

    // seq 3 is the SECOND real leaf (position 1), not index (3 - seqFrom = 2).
    const proofRes = await app.request(`/anchors/${inserted.id}/proof?seq=3`);
    expect(proofRes.status).toBe(200);
    const proofBody = (await proofRes.json()) as {
      anchor: { holes: { burned: number[]; foreign: number } | null };
      proof: { leafIndex: number };
      row: { seq: number; leafHash: string };
    };
    expect(proofBody.anchor.holes).toEqual(holes);
    expect(proofBody.proof.leafIndex).toBe(1);
    expect(proofBody.row.seq).toBe(3);
  });

  it('returns 401 when unauthenticated', async () => {
    const app = createAuthedApp(undefined, db);
    const res = await app.request('/anchors');
    expect(res.status).toBe(401);
  });

  it('returns 404 when user has no membership', async () => {
    const app = createAuthedApp({ id: 'orphan', email: null, name: 'O', role: 'user' }, db);
    const res = await app.request('/anchors');
    expect(res.status).toBe(404);
  });

  it('lists anchors for the tenant and reports lag', async () => {
    const { signatures, seqFrom, seqTo } = await seedSignedRows(3);
    await insertAnchor(signatures, seqFrom, seqTo);
    const store = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    await store.append(makeEntry({ id: 'extra', tenant: 'acct_max' }));

    const app = createAuthedApp(user, db);
    const res = await app.request('/anchors');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tenant: string;
      anchors: Array<{ leafCount: number; seqFrom: number; seqTo: number }>;
      lag: {
        lastAnchoredSeqTo: number;
        unanchoredSignedCount: number;
        oldestUnanchoredAt: string | null;
        legacyFloor: number;
        preFloorSignedCount: number;
      };
    };
    expect(body.tenant).toBe('acct_max');
    expect(body.anchors).toHaveLength(1);
    expect(body.anchors[0]?.leafCount).toBe(3);
    expect(body.lag.lastAnchoredSeqTo).toBe(seqTo);
    expect(body.lag.unanchoredSignedCount).toBe(1);
    expect(body.lag.oldestUnanchoredAt).toBeTruthy();
    // GAP-429: all-signed history has no legacy era.
    expect(body.lag.legacyFloor).toBe(0);
    expect(body.lag.preFloorSignedCount).toBe(0);
  });

  it('GAP-429: lag names the legacy floor and the sub-floor signed rows', async () => {
    const signedStore = new DrizzleAuditStore(db, canonicalSignerFn(priv));
    const unsignedStore = new DrizzleAuditStore(db); // pre-enforcement legacy rows
    // Legacy era: unsigned seq 1, signed seq 2 interleaved, unsigned seq 3.
    // Signed era: seq 4..5, anchored (the GAP-427 floor behavior).
    await unsignedStore.append(makeEntry({ id: 'u1', tenant: 'acct_max' }));
    await signedStore.append(makeEntry({ id: 's2', tenant: 'acct_max' }));
    await unsignedStore.append(makeEntry({ id: 'u3', tenant: 'acct_max' }));
    await signedStore.append(makeEntry({ id: 's4', tenant: 'acct_max' }));
    await signedStore.append(makeEntry({ id: 's5', tenant: 'acct_max' }));

    const era = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.tenant, 'acct_max'))
      .orderBy(asc(auditLog.seq));
    const eraSignatures = era
      .filter((r) => r.seq >= 4 && r.signature)
      .map((r) => r.signature as string);
    await insertAnchor(eraSignatures, 4, 5);

    const app = createAuthedApp(user, db);
    const res = await app.request('/anchors');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      lag: {
        lastAnchoredSeqTo: number;
        unanchoredSignedCount: number;
        legacyFloor: number;
        preFloorSignedCount: number;
      };
    };
    expect(body.lag.lastAnchoredSeqTo).toBe(5);
    expect(body.lag.unanchoredSignedCount).toBe(0);
    // Floor = 3 (highest unsigned seq); the signed row at seq 2 is visible as
    // pre-floor legacy (row-verifiable, never in a root), not silently absent.
    expect(body.lag.legacyFloor).toBe(3);
    expect(body.lag.preFloorSignedCount).toBe(1);
  });

  it('returns a verifiable inclusion proof and marks delivered', async () => {
    const { signatures, seqFrom, seqTo } = await seedSignedRows(3);
    const anchorId = await insertAnchor(signatures, seqFrom, seqTo);
    const targetSeq = seqFrom + 1;

    const app = createAuthedApp(user, db);
    const res = await app.request(`/anchors/${anchorId}/proof?seq=${targetSeq}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      anchor: {
        id: string;
        root: string;
        deliveredAt: string | null;
        deliveryChannel: string | null;
      };
      row: { seq: number; leafHash: string; signature: string };
      proof: {
        leafIndex: number;
        leafCount: number;
        path: Array<{ siblingHex: string; isRightSibling: boolean }>;
      };
    };

    expect(body.row.seq).toBe(targetSeq);
    expect(body.proof.leafIndex).toBe(1);
    expect(body.proof.leafCount).toBe(3);
    expect(body.anchor.deliveredAt).toBeTruthy();
    expect(body.anchor.deliveryChannel).toBe('api_download');
    expect(verifyInclusionProof(body.row.leafHash, body.proof, body.anchor.root)).toBe(true);

    const res2 = await app.request(`/anchors/${anchorId}/proof?seq=${targetSeq}`);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { anchor: { deliveredAt: string } };
    expect(body2.anchor.deliveredAt).toBe(body.anchor.deliveredAt);
  });

  it('returns 404 for another tenant anchor id (no leak)', async () => {
    const { signatures, seqFrom, seqTo } = await seedSignedRows(2);
    const { root, leafCount } = buildMerkleRootFromSignatures(signatures);
    const { value: rootSignature } = signAuditAnchorRoot(cryptoSigner, {
      tenant: 'acct_other',
      seqFrom,
      seqTo,
      leafCount,
      root,
    });
    const [foreign] = await db
      .insert(auditAnchors)
      .values({
        tenant: 'acct_other',
        seqFrom,
        seqTo,
        root,
        rootSignature,
        leafCount,
      })
      .returning({ id: auditAnchors.id });

    const app = createAuthedApp(user, db);
    const res = await app.request(`/anchors/${foreign?.id}/proof?seq=${seqFrom}`);
    expect(res.status).toBe(404);
  });

  it('GAP-427: returns 404 for a system-scope anchor (tenant is never client-supplied)', async () => {
    // GET /anchors derives `tenant` from the caller's own account membership
    // (getUserAccountId) — there is no request param a client can set to
    // '__system__'. This locks the existing tenant-isolation check (anchor
    // .tenant !== caller tenant → 404) also covers the reserved sentinel, the
    // same way it already covers any other tenant's anchors.
    const { signatures, seqFrom, seqTo } = await seedSignedRows(2);
    const { root, leafCount } = buildMerkleRootFromSignatures(signatures);
    const { value: rootSignature } = signAuditAnchorRoot(cryptoSigner, {
      tenant: SYSTEM_ANCHOR_SCOPE,
      seqFrom,
      seqTo,
      leafCount,
      root,
    });
    const [systemAnchor] = await db
      .insert(auditAnchors)
      .values({
        tenant: SYSTEM_ANCHOR_SCOPE,
        seqFrom,
        seqTo,
        root,
        rootSignature,
        leafCount,
      })
      .returning({ id: auditAnchors.id });

    const app = createAuthedApp(user, db);
    const res = await app.request(`/anchors/${systemAnchor?.id}/proof?seq=${seqFrom}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when seq is outside the anchor range', async () => {
    const { signatures, seqFrom, seqTo } = await seedSignedRows(2);
    const anchorId = await insertAnchor(signatures, seqFrom, seqTo);
    const app = createAuthedApp(user, db);
    const res = await app.request(`/anchors/${anchorId}/proof?seq=${seqTo + 5}`);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toMatch(/outside this anchor range/);
  });

  it('returns 400 when seq query is missing', async () => {
    const { signatures, seqFrom, seqTo } = await seedSignedRows(2);
    const anchorId = await insertAnchor(signatures, seqFrom, seqTo);
    const app = createAuthedApp(user, db);
    const res = await app.request(`/anchors/${anchorId}/proof`);
    expect(res.status).toBe(400);
  });
});
