/**
 * Audit receipt API (GAP-355).
 *
 * Stage 3 (D4):
 *   GET /public-key — unauthenticated offline-verify public key
 *
 * Stage 4 S4-4:
 *   GET /anchors — list Merkle anchors for the caller's account (tenant)
 *   GET /anchors/:id/proof?seq= — inclusion proof for one signed row
 *
 * Anchors routes require auth (optionalAuth + 401) and Max+ `auditLog`
 * (requireFeature in index.ts). Record emission stays free; receipt download
 * is the gated surface. Verification is never for sale (ADR §2a).
 */

import { resolveAuditPublicKey } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { accountMemberships, auditAnchors, auditLog } from '@revealui/db/schema';
import { OpenAPIHono } from '@revealui/openapi';
import { and, asc, count, desc, eq, gt, gte, isNotNull, lte, max } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { legacyUnsignedFloor } from '../jobs/audit-anchor-sweep.js';
import { buildAnchorInclusionProof } from '../lib/audit-anchor-proof.js';

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

type AuditVariables = {
  db: Database;
  user: UserContext | undefined;
};

const app = new OpenAPIHono<{ Variables: AuditVariables }>();

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

// =============================================================================
// Stage 3 — public key (unchanged contract)
// =============================================================================

app.get('/public-key', (c) => {
  const resolved = resolveAuditPublicKey(process.env);
  if (!resolved) {
    return c.json(
      {
        error:
          'Audit signing is not configured on this deployment. No public key to publish. ' +
          'Rows written here are unsigned; see docs/SECRETS.md to enable per-row signing.',
      },
      404,
    );
  }
  c.header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return c.json({ alg: resolved.alg, kid: resolved.kid, publicKeyPem: resolved.publicKeyPem }, 200);
});

// =============================================================================
// Stage 4 S4-4 — anchors (Max+ receipt surface)
// =============================================================================

function requireUser(c: Context): UserContext {
  const user = c.get('user') as UserContext | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  return user;
}

/**
 * Resolve the authenticated user's primary active account. Tenant on
 * audit_log / audit_anchors matches accountId (S4-3 worker).
 */
async function getUserAccountId(db: Database, userId: string): Promise<string> {
  const [row] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
    .limit(1);

  if (!row?.accountId) {
    throw new HTTPException(404, { message: 'No active account membership' });
  }
  return row.accountId;
}

function serializeAnchor(row: typeof auditAnchors.$inferSelect) {
  return {
    id: row.id,
    tenant: row.tenant,
    seqFrom: row.seqFrom,
    seqTo: row.seqTo,
    root: row.root,
    rootSignature: row.rootSignature,
    leafCount: row.leafCount,
    createdAt: row.createdAt.toISOString(),
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    deliveryChannel: row.deliveryChannel ?? null,
  };
}

/**
 * GET /anchors — list roots for the caller's tenant + unanchored lag.
 * Query: limit (default 50, max 200).
 */
app.get('/anchors', async (c) => {
  const user = requireUser(c);
  const db = (c.get('db') as Database | undefined) ?? getClient();
  const tenant = await getUserAccountId(db, user.id);

  const limitRaw = c.req.query('limit');
  let limit = DEFAULT_LIST_LIMIT;
  if (limitRaw !== undefined && limitRaw !== '') {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1) {
      throw new HTTPException(400, { message: 'limit must be a positive integer' });
    }
    limit = Math.min(n, MAX_LIST_LIMIT);
  }

  const anchors = await db
    .select()
    .from(auditAnchors)
    .where(eq(auditAnchors.tenant, tenant))
    .orderBy(desc(auditAnchors.createdAt))
    .limit(limit);

  const [lastRow] = await db
    .select({ m: max(auditAnchors.seqTo) })
    .from(auditAnchors)
    .where(eq(auditAnchors.tenant, tenant));
  const lastAnchoredSeqTo =
    typeof lastRow?.m === 'number' && Number.isFinite(lastRow.m) ? lastRow.m : 0;

  const unanchoredWhere = and(
    eq(auditLog.tenant, tenant),
    isNotNull(auditLog.signature),
    gt(auditLog.seq, lastAnchoredSeqTo),
  );

  const [unanchoredCountRow] = await db
    .select({ c: count() })
    .from(auditLog)
    .where(unanchoredWhere);

  const [oldestUnanchored] = await db
    .select({ timestamp: auditLog.timestamp })
    .from(auditLog)
    .where(unanchoredWhere)
    .orderBy(asc(auditLog.timestamp))
    .limit(1);

  // GAP-429: name the pre-enforcement legacy era instead of going silent about
  // it. Signed rows at or below the floor are row-verifiable but never enter a
  // root (GAP-427 — no retro-signing); the existing fields keep their
  // semantics (unanchored tail = signed rows above the last anchor).
  const legacyFloor = await legacyUnsignedFloor(db, tenant);
  let preFloorSignedCount = 0;
  if (legacyFloor > 0) {
    const [preFloorRow] = await db
      .select({ c: count() })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenant, tenant),
          isNotNull(auditLog.signature),
          lte(auditLog.seq, legacyFloor),
        ),
      );
    preFloorSignedCount = Number(preFloorRow?.c ?? 0);
  }

  c.header('Cache-Control', 'no-store');
  return c.json(
    {
      tenant,
      anchors: anchors.map(serializeAnchor),
      lag: {
        lastAnchoredSeqTo,
        unanchoredSignedCount: Number(unanchoredCountRow?.c ?? 0),
        oldestUnanchoredAt: oldestUnanchored?.timestamp
          ? oldestUnanchored.timestamp.toISOString()
          : null,
        legacyFloor,
        preFloorSignedCount,
      },
    },
    200,
  );
});

/**
 * GET /anchors/:id/proof?seq=N — inclusion proof for a signed row in the batch.
 * Marks delivered_at + delivery_channel=api_download on first successful download.
 */
app.get('/anchors/:id/proof', async (c) => {
  const user = requireUser(c);
  const db = (c.get('db') as Database | undefined) ?? getClient();
  const tenant = await getUserAccountId(db, user.id);
  const id = c.req.param('id');
  const seqRaw = c.req.query('seq');

  if (seqRaw === undefined || seqRaw === '') {
    throw new HTTPException(400, { message: 'query param seq is required' });
  }
  const seq = Number(seqRaw);
  if (!Number.isInteger(seq) || seq < 1) {
    throw new HTTPException(400, { message: 'seq must be a positive integer' });
  }

  const [anchor] = await db.select().from(auditAnchors).where(eq(auditAnchors.id, id)).limit(1);

  if (!anchor) {
    throw new HTTPException(404, { message: 'Anchor not found' });
  }
  // Tenant isolation: never leak another account's root or proof.
  if (anchor.tenant !== tenant) {
    throw new HTTPException(404, { message: 'Anchor not found' });
  }
  const rows = await db
    .select({
      id: auditLog.id,
      seq: auditLog.seq,
      signature: auditLog.signature,
      timestamp: auditLog.timestamp,
      eventType: auditLog.eventType,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenant, tenant),
        isNotNull(auditLog.signature),
        gte(auditLog.seq, anchor.seqFrom),
        lte(auditLog.seq, anchor.seqTo),
      ),
    )
    .orderBy(asc(auditLog.seq));

  const signedRows: Array<{ seq: number; signature: string }> = [];
  for (const row of rows) {
    if (!row.signature) {
      throw new HTTPException(409, { message: 'Missing signature in anchor range' });
    }
    signedRows.push({ seq: row.seq, signature: row.signature });
  }

  const built = buildAnchorInclusionProof(
    {
      seqFrom: anchor.seqFrom,
      seqTo: anchor.seqTo,
      root: anchor.root,
      leafCount: anchor.leafCount,
    },
    signedRows,
    seq,
  );
  if (!built.ok) {
    if (built.code === 'SEQ_OUT_OF_RANGE') {
      throw new HTTPException(400, {
        message: `seq ${seq} is outside this anchor range [${anchor.seqFrom}, ${anchor.seqTo}]`,
      });
    }
    throw new HTTPException(409, { message: built.error });
  }

  const target = rows[built.leafIndex];
  if (!target) {
    throw new HTTPException(409, { message: 'leaf missing after proof build' });
  }

  // First successful API download = delivered (design §3 delivery_channel).
  let deliveredAt = anchor.deliveredAt;
  let deliveryChannel = anchor.deliveryChannel;
  if (!deliveredAt) {
    const now = new Date();
    await db
      .update(auditAnchors)
      .set({ deliveredAt: now, deliveryChannel: 'api_download' })
      .where(eq(auditAnchors.id, anchor.id));
    deliveredAt = now;
    deliveryChannel = 'api_download';
  }

  c.header('Cache-Control', 'no-store');
  return c.json(
    {
      anchor: serializeAnchor({
        ...anchor,
        deliveredAt,
        deliveryChannel,
      }),
      row: {
        id: target.id,
        seq: target.seq,
        signature: built.signature,
        leafHash: built.leafHash,
        timestamp: target.timestamp.toISOString(),
        eventType: target.eventType,
      },
      proof: built.proof,
    },
    200,
  );
});

export default app;
