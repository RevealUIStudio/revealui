/**
 * GAP-355 Stage 4 S4-3 — Fly worker sweep: per-tenant Merkle anchors.
 *
 * For each non-null tenant with Max+ `auditLog` and new signed audit_log
 * rows after the last anchor, when the batch is **ready** (size ≥ N or
 * age ≥ max lag), build a contiguous batch, Merkle-root the signature
 * leaves, sign the root (Stage 3 Ed25519), insert audit_anchors, and
 * meter `audit_anchor`. Failures never delete audit rows (append-only).
 *
 * Null-tenant (system) rows anchor too, via one additional pass per sweep
 * (GAP-427 ruling 2026-07-27): they land in `audit_anchors` under the
 * reserved `SYSTEM_ANCHOR_SCOPE` ('__system__') sentinel tenant value.
 * `audit_log.tenant` itself stays null on those rows (no schema migration);
 * only the anchor row's `tenant` column carries the sentinel. The system
 * pass is not entitlement-gated (`canAnchorTenant` is per-account; system
 * events are the operator's own audit trail) and never writes a usage
 * meter (no account FK backs a null tenant).
 *
 * Gated by AUDIT_ANCHOR_SWEEP_ENABLED=true on the worker process.
 */

import { randomUUID } from 'node:crypto';
import { isFeatureEnabled } from '@revealui/core/features';
import { logger } from '@revealui/core/observability/logger';
import { metrics } from '@revealui/core/observability/metrics';
import {
  assertContiguousSeq,
  buildMerkleRootFromSignatures,
  createAuditRowSignerFromEnv,
  type Ed25519AuditRowSigner,
  signAuditAnchorRoot,
} from '@revealui/core/security';
import { getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { auditAnchors, auditLog } from '@revealui/db/schema';
import { and, asc, count, eq, gt, isNotNull, isNull, max } from 'drizzle-orm';
import { accountHasAuditLogFeature } from '../lib/account-entitlement.js';
import { recordUsageMeter } from '../lib/metering.js';
import { planContiguousBatch, type SignedAuditRow } from './audit-anchor-batch.js';

export { planContiguousBatch, type SignedAuditRow } from './audit-anchor-batch.js';

/**
 * GAP-427: the audit_anchors.tenant value for anchors over null-tenant
 * (system) audit_log rows. audit_anchors.tenant is NOT NULL, so a sentinel
 * avoids a schema migration; the underlying audit_log rows stay null.
 */
export const SYSTEM_ANCHOR_SCOPE = '__system__';

/** Countersigned default batch size (§9). Override: AUDIT_ANCHOR_BATCH_SIZE. */
export const DEFAULT_ANCHOR_BATCH_SIZE = 256;

/**
 * Max lag before a partial batch anchors (§9: 1h since first unanchored
 * signed row). Override: AUDIT_ANCHOR_MAX_LAG_MS.
 */
export const DEFAULT_ANCHOR_MAX_LAG_MS = 60 * 60 * 1000;

/**
 * How often the worker polls for ready batches (not the lag itself).
 * Override: AUDIT_ANCHOR_INTERVAL_MS.
 */
export const DEFAULT_ANCHOR_POLL_MS = 60 * 1000;

/** Usage meter name after successful root insert (design §4 step 7 / §9). */
export const AUDIT_ANCHOR_METER_NAME = 'audit_anchor';

// Process-wide metrics (registered once; Prometheus via /metrics on worker).
const mAnchorsCreated = metrics.counter(
  'revealui_audit_anchors_created_total',
  'Merkle audit anchors successfully inserted',
);
const mGaps = metrics.counter(
  'revealui_audit_anchor_seq_gaps_total',
  'Tenant batches skipped because of a non-contiguous seq gap',
);
const mEntitlementSkip = metrics.counter(
  'revealui_audit_anchor_entitlement_skip_total',
  'Tenants skipped because auditLog (Max+) was not enabled',
);
const mErrors = metrics.counter(
  'revealui_audit_anchor_errors_total',
  'Anchor sweep tenant failures',
);
const mNullTenant = metrics.gauge(
  'revealui_audit_null_tenant_signed_rows',
  'Signed audit_log rows with null tenant, anchored under the __system__ scope (GAP-427 ruling 2026-07-27)',
);
const mWaiting = metrics.counter(
  'revealui_audit_anchor_waiting_total',
  'Tenants with unanchored rows still under batch-size and max-lag thresholds',
);
const mFloorEngaged = metrics.counter(
  'revealui_audit_anchor_floor_engaged_total',
  'Tenant sweep passes that started from a derived legacy floor (GAP-427/429)',
);

export interface AnchorSweepResult {
  tenantsConsidered: number;
  anchorsInserted: number;
  tenantsSkipped: number;
  tenantsWaiting: number;
  /** Tenant (and system-scope) passes that started from a derived legacy floor. */
  tenantsFloorEngaged: number;
  nullTenantSignedRows: number;
  /** GAP-427: outcome of the one null-tenant system-scope pass this sweep. */
  systemOutcome: 'inserted' | 'waiting' | 'skipped';
  errors: string[];
}

export interface AnchorSweepOptions {
  db?: Database;
  env?: Record<string, string | undefined>;
  batchSize?: number;
  maxLagMs?: number;
  /** Injected for tests; default: account entitlement + process license fallback. */
  canAnchorTenant?: (tenant: string) => Promise<boolean>;
  signer?: Ed25519AuditRowSigner | null;
  /** Injected now() for lag tests. */
  now?: () => Date;
  /** When false, skip usage_meters write (tests without accounts table rows). */
  recordMeter?: boolean;
}

function batchSizeFromEnv(env: Record<string, string | undefined>): number {
  const raw = env.AUDIT_ANCHOR_BATCH_SIZE?.trim();
  if (!raw) return DEFAULT_ANCHOR_BATCH_SIZE;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_ANCHOR_BATCH_SIZE;
}

function maxLagFromEnv(env: Record<string, string | undefined>): number {
  const raw = env.AUDIT_ANCHOR_MAX_LAG_MS?.trim();
  if (!raw) return DEFAULT_ANCHOR_MAX_LAG_MS;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_ANCHOR_MAX_LAG_MS;
}

function pollMsFromEnv(env: Record<string, string | undefined>): number {
  const raw = env.AUDIT_ANCHOR_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_ANCHOR_POLL_MS;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_ANCHOR_POLL_MS;
}

function resolveRootSigner(env: Record<string, string | undefined>): Ed25519AuditRowSigner | null {
  const { cryptoSigner, mode } = createAuditRowSignerFromEnv(env);
  if (mode !== 'signed' || !cryptoSigner) return null;
  return cryptoSigner;
}

async function defaultCanAnchorTenant(db: Database, tenant: string): Promise<boolean> {
  if (await accountHasAuditLogFeature(db, tenant)) return true;
  // Forge / process license: Max+ singleton unlocks all tenants.
  return isFeatureEnabled('auditLog');
}

/**
 * One sweep pass across all tenants that have non-null tenant + signed rows.
 */
export async function runAuditAnchorSweep(
  options: AnchorSweepOptions = {},
): Promise<AnchorSweepResult> {
  const env = options.env ?? process.env;
  const db = options.db ?? getClient();
  const batchSize = options.batchSize ?? batchSizeFromEnv(env);
  const maxLagMs = options.maxLagMs ?? maxLagFromEnv(env);
  const signer = options.signer !== undefined ? options.signer : resolveRootSigner(env);
  const now = options.now ?? (() => new Date());
  const canAnchor = options.canAnchorTenant ?? ((t: string) => defaultCanAnchorTenant(db, t));
  const doMeter = options.recordMeter !== false;

  const result: AnchorSweepResult = {
    tenantsConsidered: 0,
    anchorsInserted: 0,
    tenantsSkipped: 0,
    tenantsWaiting: 0,
    tenantsFloorEngaged: 0,
    nullTenantSignedRows: 0,
    systemOutcome: 'skipped',
    errors: [],
  };

  if (!signer) {
    logger.info('audit-anchor-sweep: skipped (no REVEALUI_AUDIT_SIGNING_KEY — unsigned mode)');
    return result;
  }

  // GAP-427: null-tenant (system) volume gauge. Anchored below via the
  // dedicated system-scope pass, not the per-tenant loop.
  const [nullRow] = await db
    .select({ c: count() })
    .from(auditLog)
    .where(and(isNull(auditLog.tenant), isNotNull(auditLog.signature)));
  result.nullTenantSignedRows = Number(nullRow?.c ?? 0);
  mNullTenant.set(result.nullTenantSignedRows);

  const tenantRows = await db
    .selectDistinct({ tenant: auditLog.tenant })
    .from(auditLog)
    .where(and(isNotNull(auditLog.tenant), isNotNull(auditLog.signature)));

  for (const { tenant } of tenantRows) {
    if (!tenant) continue;
    // Defensive: a hostile or buggy writer must never collide with the
    // system scope's anchor bookkeeping (GAP-427).
    if (tenant === SYSTEM_ANCHOR_SCOPE) continue;
    result.tenantsConsidered++;
    try {
      if (!(await canAnchor(tenant))) {
        mEntitlementSkip.inc();
        result.tenantsSkipped++;
        continue;
      }

      const { outcome, floorEngaged } = await anchorTenantBatch(
        db,
        signer,
        tenant,
        batchSize,
        maxLagMs,
        now,
        doMeter,
      );
      if (floorEngaged) result.tenantsFloorEngaged++;
      if (outcome === 'inserted') result.anchorsInserted++;
      else if (outcome === 'waiting') {
        result.tenantsWaiting++;
        mWaiting.inc();
      } else result.tenantsSkipped++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${tenant}: ${msg}`);
      mErrors.inc();
      logger.error(
        `audit-anchor-sweep: tenant ${tenant} failed`,
        err instanceof Error ? err : new Error(msg),
      );
    }
  }

  // GAP-427: one system-scope pass for null-tenant rows. Not entitlement
  // gated and never metered (recordMeter forced false — no account FK).
  try {
    const { outcome, floorEngaged } = await anchorTenantBatch(
      db,
      signer,
      SYSTEM_ANCHOR_SCOPE,
      batchSize,
      maxLagMs,
      now,
      /* doMeter */ false,
      /* isSystem */ true,
    );
    result.systemOutcome = outcome;
    if (floorEngaged) result.tenantsFloorEngaged++;
    if (outcome === 'inserted') result.anchorsInserted++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`${SYSTEM_ANCHOR_SCOPE}: ${msg}`);
    logger.error(
      'audit-anchor-sweep: system scope failed',
      err instanceof Error ? err : new Error(msg),
    );
  }

  return result;
}

/**
 * audit_log.tenant predicate for a scope: a real tenant (`eq`) or the
 * GAP-427 system scope, which matches null-tenant rows directly since
 * audit_log.tenant is never set to SYSTEM_ANCHOR_SCOPE itself.
 */
function auditLogTenantMatch(tenant: string, isSystem: boolean) {
  return isSystem ? isNull(auditLog.tenant) : eq(auditLog.tenant, tenant);
}

async function lastAnchoredSeq(db: Database, tenant: string): Promise<number> {
  const rows = await db
    .select({ m: max(auditAnchors.seqTo) })
    .from(auditAnchors)
    .where(eq(auditAnchors.tenant, tenant));
  const m = rows[0]?.m;
  return typeof m === 'number' && Number.isFinite(m) ? m : 0;
}

/**
 * GAP-427: legacy anchor floor. Rows written before signed writes were
 * enforced (GAP-417 both rails) left unsigned rows interleaved in the seq
 * order; each one is a permanent contiguity hole, so a tenant with no anchors
 * yet would gap-stall forever after the first pre-hole run. The rails
 * guarantee no new unsigned rows, so the era is closed and the tenant's
 * highest unsigned seq is a stable floor: anchoring attests floor+1 forward.
 * Legacy rows are never retro-signed — a backfilled signature would be
 * indistinguishable from tampering (ADR 2026-07-12 §2a).
 *
 * `isSystem` (GAP-427 ruling 2026-07-27) selects the null-tenant floor
 * instead of a real tenant's; `tenant` is still the audit_anchors.tenant key
 * (SYSTEM_ANCHOR_SCOPE) the caller is deriving the floor for.
 *
 * Exported for the anchors API lag surface (GAP-429), which reports the same
 * floor so sub-floor legacy rows are visible rather than silently excluded.
 */
export async function legacyUnsignedFloor(
  db: Database,
  tenant: string,
  isSystem = false,
): Promise<number> {
  const rows = await db
    .select({ m: max(auditLog.seq) })
    .from(auditLog)
    .where(and(auditLogTenantMatch(tenant, isSystem), isNull(auditLog.signature)));
  const m = rows[0]?.m;
  return typeof m === 'number' && Number.isFinite(m) ? m : 0;
}

type TenantOutcome = 'inserted' | 'waiting' | 'skipped';

// GAP-429: a tenant stuck in the no-anchors state (e.g. floor above the entire
// signed era) re-engages the floor on every poll tick — log once per tenant
// per process; the counter still increments every pass.
const floorLoggedTenants = new Set<string>();

async function anchorTenantBatch(
  db: Database,
  signer: Ed25519AuditRowSigner,
  tenant: string,
  batchSize: number,
  maxLagMs: number,
  now: () => Date,
  doMeter: boolean,
  isSystem = false,
): Promise<{ outcome: TenantOutcome; floorEngaged: boolean }> {
  const anchored = await lastAnchoredSeq(db, tenant);
  // GAP-427: first anchor for a tenant (or the system scope) starts above the
  // closed unsigned era, not at seq 1. Once anchors exist, strict last+1
  // contiguity governs.
  const floor = anchored > 0 ? 0 : await legacyUnsignedFloor(db, tenant, isSystem);
  const floorEngaged = floor > 0;
  if (floorEngaged) {
    mFloorEngaged.inc();
    if (!floorLoggedTenants.has(tenant)) {
      floorLoggedTenants.add(tenant);
      logger.info(
        `audit-anchor-sweep: legacy floor engaged tenant=${tenant} floor=${floor} — anchors attest seq ${floor + 1} onward`,
      );
    }
  }
  const done = (outcome: TenantOutcome) => ({ outcome, floorEngaged });
  const last = anchored > 0 ? anchored : floor;

  const candidates = await db
    .select({
      seq: auditLog.seq,
      signature: auditLog.signature,
      timestamp: auditLog.timestamp,
    })
    .from(auditLog)
    .where(
      and(
        auditLogTenantMatch(tenant, isSystem),
        isNotNull(auditLog.signature),
        gt(auditLog.seq, last),
      ),
    )
    .orderBy(asc(auditLog.seq))
    .limit(batchSize);

  const signed: SignedAuditRow[] = [];
  let oldestTs: Date | null = null;
  for (const row of candidates) {
    if (row.signature === null || row.signature === undefined) continue;
    signed.push({ seq: row.seq, signature: row.signature });
    if (oldestTs === null) oldestTs = row.timestamp;
  }

  if (signed.length === 0) return done('skipped');

  const batch = planContiguousBatch(last, signed);
  if (!batch || batch.length === 0) {
    if (signed[0] && (last === 0 || signed[0].seq !== last + 1)) {
      mGaps.inc();
      logger.warn(
        `audit-anchor-sweep: gap for tenant=${tenant} lastAnchored=${last} nextSeq=${signed[0].seq} — skip`,
      );
    }
    return done('skipped');
  }

  // Size primary; time is max lag for a partial batch (§9).
  const readyBySize = batch.length >= batchSize;
  const ageMs = oldestTs ? now().getTime() - oldestTs.getTime() : 0;
  const readyByLag = batch.length >= 1 && ageMs >= maxLagMs;
  if (!(readyBySize || readyByLag)) {
    return done('waiting');
  }

  const seqs = batch.map((r) => r.seq);
  assertContiguousSeq(seqs);
  const signatures = batch.map((r) => r.signature);
  const { root, leafCount } = buildMerkleRootFromSignatures(signatures);
  const seqFrom = batch[0]?.seq;
  const seqTo = batch[batch.length - 1]?.seq;
  if (seqFrom === undefined || seqTo === undefined) return done('skipped');

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

  mAnchorsCreated.inc();
  logger.info(
    `audit-anchor-sweep: anchored tenant=${tenant} seq=${seqFrom}..${seqTo} leaves=${leafCount}`,
  );

  if (doMeter) {
    try {
      const periodStart = now();
      await recordUsageMeter({
        id: randomUUID(),
        accountId: tenant,
        meterName: AUDIT_ANCHOR_METER_NAME,
        quantity: 1,
        periodStart,
        source: 'system',
        idempotencyKey: `audit_anchor:${tenant}:${seqFrom}:${seqTo}`,
      });
    } catch (err) {
      // Meter is best-effort after insert; missing accounts FK must not roll back anchors.
      logger.warn(`audit-anchor-sweep: meter write failed for tenant=${tenant}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return done('inserted');
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let bootTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start the poll loop on the Fly worker. No-op when disabled.
 *
 * Env:
 *   AUDIT_ANCHOR_SWEEP_ENABLED=true
 *   AUDIT_ANCHOR_INTERVAL_MS (default 60000 — poll cadence)
 *   AUDIT_ANCHOR_BATCH_SIZE (default 256)
 *   AUDIT_ANCHOR_MAX_LAG_MS (default 3600000 — partial-batch age trigger)
 *   REVEALUI_AUDIT_SIGNING_KEY (required for any insert)
 */
export function startAuditAnchorSweep(env: Record<string, string | undefined> = process.env): void {
  if (env.AUDIT_ANCHOR_SWEEP_ENABLED !== 'true') {
    logger.info('audit-anchor-sweep: not started (set AUDIT_ANCHOR_SWEEP_ENABLED=true to enable)');
    return;
  }

  const intervalMs = pollMsFromEnv(env);

  const tick = () => {
    void runAuditAnchorSweep({ env }).then((r) => {
      logger.info(
        `audit-anchor-sweep: tick tenants=${r.tenantsConsidered} inserted=${r.anchorsInserted} ` +
          `waiting=${r.tenantsWaiting} skipped=${r.tenantsSkipped} nullTenant=${r.nullTenantSignedRows} ` +
          `system=${r.systemOutcome} errors=${r.errors.length}`,
      );
    });
  };

  // Fire once soon after boot, then on interval
  bootTimer = setTimeout(tick, 15_000);
  if (typeof bootTimer === 'object' && bootTimer !== null && 'unref' in bootTimer) {
    (bootTimer as NodeJS.Timeout).unref?.();
  }
  sweepTimer = setInterval(tick, intervalMs);
  if (typeof sweepTimer === 'object' && sweepTimer !== null && 'unref' in sweepTimer) {
    (sweepTimer as NodeJS.Timeout).unref?.();
  }
  logger.info(
    `audit-anchor-sweep: started pollMs=${intervalMs} batchSize=${batchSizeFromEnv(env)} ` +
      `maxLagMs=${maxLagFromEnv(env)}`,
  );
}

/** Test / shutdown helper. */
export function stopAuditAnchorSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  if (bootTimer) {
    clearTimeout(bootTimer);
    bootTimer = null;
  }
}
