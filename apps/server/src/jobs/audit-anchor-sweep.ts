/**
 * GAP-355 Stage 4 S4-3 — Fly worker sweep: per-tenant Merkle anchors.
 *
 * For each non-null tenant with new signed audit_log rows after the last
 * anchor, build a contiguous batch, Merkle-root the signature leaves, sign
 * the root (Stage 3 Ed25519), insert audit_anchors. Failures never delete
 * audit rows (append-only). Null-tenant rows are never anchored (§9).
 *
 * Gated by AUDIT_ANCHOR_SWEEP_ENABLED=true on the worker process.
 */

import { createPrivateKey, createPublicKey } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import {
  assertContiguousSeq,
  buildMerkleRootFromSignatures,
  deriveAuditKid,
  Ed25519AuditRowSigner,
  signAuditAnchorRoot,
} from '@revealui/core/security';
import { getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { auditAnchors, auditLog } from '@revealui/db/schema';
import { and, asc, eq, gt, isNotNull, max } from 'drizzle-orm';
import { planContiguousBatch, type SignedAuditRow } from './audit-anchor-batch.js';

export { planContiguousBatch, type SignedAuditRow } from './audit-anchor-batch.js';

/** Default batch size (design: 512). Override with AUDIT_ANCHOR_BATCH_SIZE. */
export const DEFAULT_ANCHOR_BATCH_SIZE = 512;

/** Default poll interval 1h. Override with AUDIT_ANCHOR_INTERVAL_MS. */
export const DEFAULT_ANCHOR_INTERVAL_MS = 60 * 60 * 1000;

export interface AnchorSweepResult {
  tenantsConsidered: number;
  anchorsInserted: number;
  tenantsSkipped: number;
  errors: string[];
}

function resolveRootSigner(
  env: Record<string, string | undefined> = process.env,
): Ed25519AuditRowSigner | null {
  const privateKeyPem = env.REVEALUI_AUDIT_SIGNING_KEY?.trim();
  if (!privateKeyPem) return null;
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey = createPublicKey(privateKey);
  const override = env.REVEALUI_AUDIT_SIGNING_KID?.trim();
  const kid = override && override.length > 0 ? override : deriveAuditKid(publicKey);
  return new Ed25519AuditRowSigner(privateKeyPem, kid);
}

function batchSizeFromEnv(env: Record<string, string | undefined>): number {
  const raw = env.AUDIT_ANCHOR_BATCH_SIZE?.trim();
  if (!raw) return DEFAULT_ANCHOR_BATCH_SIZE;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_ANCHOR_BATCH_SIZE;
}

/**
 * One sweep pass across all tenants that have non-null tenant + signed rows.
 */
export async function runAuditAnchorSweep(options?: {
  db?: Database;
  env?: Record<string, string | undefined>;
  batchSize?: number;
  signer?: Ed25519AuditRowSigner | null;
}): Promise<AnchorSweepResult> {
  const env = options?.env ?? process.env;
  const db = options?.db ?? getClient();
  const batchSize = options?.batchSize ?? batchSizeFromEnv(env);
  const signer = options?.signer !== undefined ? options.signer : resolveRootSigner(env);

  const result: AnchorSweepResult = {
    tenantsConsidered: 0,
    anchorsInserted: 0,
    tenantsSkipped: 0,
    errors: [],
  };

  if (!signer) {
    logger.info('audit-anchor-sweep: skipped (no REVEALUI_AUDIT_SIGNING_KEY — unsigned mode)');
    return result;
  }

  // Distinct non-null tenants with at least one signed row
  const tenantRows = await db
    .selectDistinct({ tenant: auditLog.tenant })
    .from(auditLog)
    .where(and(isNotNull(auditLog.tenant), isNotNull(auditLog.signature)));

  for (const { tenant } of tenantRows) {
    if (!tenant) continue;
    result.tenantsConsidered++;
    try {
      const inserted = await anchorTenantBatch(db, signer, tenant, batchSize);
      if (inserted) result.anchorsInserted++;
      else result.tenantsSkipped++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${tenant}: ${msg}`);
      logger.error(
        `audit-anchor-sweep: tenant ${tenant} failed`,
        err instanceof Error ? err : new Error(msg),
      );
    }
  }

  return result;
}

async function lastAnchoredSeq(db: Database, tenant: string): Promise<number> {
  const rows = await db
    .select({ m: max(auditAnchors.seqTo) })
    .from(auditAnchors)
    .where(eq(auditAnchors.tenant, tenant));
  const m = rows[0]?.m;
  return typeof m === 'number' && Number.isFinite(m) ? m : 0;
}

async function anchorTenantBatch(
  db: Database,
  signer: Ed25519AuditRowSigner,
  tenant: string,
  batchSize: number,
): Promise<boolean> {
  const last = await lastAnchoredSeq(db, tenant);

  const candidates = await db
    .select({
      seq: auditLog.seq,
      signature: auditLog.signature,
    })
    .from(auditLog)
    .where(and(eq(auditLog.tenant, tenant), isNotNull(auditLog.signature), gt(auditLog.seq, last)))
    .orderBy(asc(auditLog.seq))
    .limit(batchSize);

  const signed: SignedAuditRow[] = [];
  for (const row of candidates) {
    if (row.signature === null || row.signature === undefined) continue;
    signed.push({ seq: row.seq, signature: row.signature });
  }

  const batch = planContiguousBatch(last, signed);
  if (!batch || batch.length === 0) {
    if (signed.length > 0 && last > 0 && signed[0] && signed[0].seq !== last + 1) {
      logger.warn(
        `audit-anchor-sweep: gap for tenant=${tenant} lastAnchored=${last} nextSeq=${signed[0].seq} — skip`,
      );
    }
    return false;
  }

  const seqs = batch.map((r) => r.seq);
  assertContiguousSeq(seqs);
  const signatures = batch.map((r) => r.signature);
  const { root, leafCount } = buildMerkleRootFromSignatures(signatures);
  const seqFrom = batch[0]?.seq;
  const seqTo = batch[batch.length - 1]?.seq;
  if (seqFrom === undefined || seqTo === undefined) return false;

  const { value: rootSignature } = signAuditAnchorRoot(signer, {
    tenant,
    seqFrom,
    seqTo,
    leafCount,
    root,
  });

  await db.insert(auditAnchors).values({
    tenant,
    seqFrom,
    seqTo,
    root,
    rootSignature,
    leafCount,
  });

  logger.info(
    `audit-anchor-sweep: anchored tenant=${tenant} seq=${seqFrom}..${seqTo} leaves=${leafCount}`,
  );
  return true;
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the interval loop on the Fly worker. No-op when disabled.
 * Env:
 *   AUDIT_ANCHOR_SWEEP_ENABLED=true
 *   AUDIT_ANCHOR_INTERVAL_MS (default 3600000)
 *   AUDIT_ANCHOR_BATCH_SIZE (default 512)
 */
export function startAuditAnchorSweep(env: Record<string, string | undefined> = process.env): void {
  if (env.AUDIT_ANCHOR_SWEEP_ENABLED !== 'true') {
    logger.info('audit-anchor-sweep: not started (set AUDIT_ANCHOR_SWEEP_ENABLED=true to enable)');
    return;
  }

  const intervalRaw = env.AUDIT_ANCHOR_INTERVAL_MS?.trim();
  const intervalMs =
    intervalRaw && Number.isInteger(Number(intervalRaw)) && Number(intervalRaw) > 0
      ? Number(intervalRaw)
      : DEFAULT_ANCHOR_INTERVAL_MS;

  const tick = () => {
    void runAuditAnchorSweep({ env }).then((r) => {
      logger.info(
        `audit-anchor-sweep: tick tenants=${r.tenantsConsidered} inserted=${r.anchorsInserted} skipped=${r.tenantsSkipped} errors=${r.errors.length}`,
      );
    });
  };

  // Fire once soon after boot, then on interval
  setTimeout(tick, 15_000);
  sweepTimer = setInterval(tick, intervalMs);
  // Allow process to exit in tests if this is the only handle
  if (typeof sweepTimer === 'object' && sweepTimer !== null && 'unref' in sweepTimer) {
    (sweepTimer as NodeJS.Timeout).unref?.();
  }
  logger.info(
    `audit-anchor-sweep: started intervalMs=${intervalMs} batchSize=${batchSizeFromEnv(env)}`,
  );
}

/** Test / shutdown helper. */
export function stopAuditAnchorSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
