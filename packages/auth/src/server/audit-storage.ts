/**
 * Audit storage boundary + signer composition — the ONE shared home (GAP-338).
 *
 * Moved here from `apps/server/src/lib/{audit-storage,audit-signer}.ts` so BOTH
 * server processes (Hono api + Next.js admin) can swap the process-wide
 * `@revealui/security` AuditSystem onto persistent storage. Before this move the
 * boundary was stranded in apps/server, so every admin-process audit emit
 * (including the GAP-334 login receipts wired through `audit-bridge.ts` in this
 * package) landed in that process's default `InMemoryAuditStorage` and
 * evaporated on restart. `@revealui/auth` is the home because it already sits
 * above `@revealui/security`, `@revealui/db`, and `@revealui/core`, is consumed
 * by both apps, and owns the auth→audit bridge whose emits this rescues.
 *
 * This is THE boundary between two audit models that intentionally differ
 * (see docs/decisions/2026-07-12-audit-receipt-architecture.md §5):
 *
 *   - `@revealui/security` emits `AuditEvent` with severity
 *     `low | medium | high | critical` (the request-middleware vocabulary).
 *   - `@revealui/db` / `@revealui/ai` own `audit_log`, whose CHECK constraint
 *     accepts only `info | warn | critical`. That model wins; the security
 *     vocabulary is mapped here, at the boundary, so every emitted event lands
 *     instead of being silently rejected by the constraint.
 *
 * Signing (GAP-355 Stage 3): the `DrizzleAuditStore` is built via
 * `createAuditStore`, which injects the process-wide Ed25519 row signer. On a
 * signing deployment every row lands with a `v1.ed25519` signature verifiable
 * offline from the published public key; in dev/test (no key) rows stay honestly
 * unsigned. `previous_signature` is never written (the hash chain is abandoned),
 * which is what makes the two-writer topology (api + admin processes appending
 * to one `audit_log`) safe: rows are independent, each signed at its own door
 * with the same env-derived key. Ruled for GAP-338 — see the gap file.
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import type {
  AuditRowSignerFn,
  DrizzleAuditStoreOptions,
  DrizzleAuditStore as DrizzleAuditStoreType,
} from '@revealui/db';
import { DrizzleAuditStore, getClient, hasDatabaseConnectionEnv } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import type {
  AuditEvent,
  AuditQuery,
  AuditSeverity,
  AuditStorage,
  AuditSystem,
} from '@revealui/security/server';
import {
  audit,
  classifyAuditWriteFailure,
  createAuditRowSignerFromEnv,
  recordAuditWriteResult,
} from '@revealui/security/server';

let cachedSigner: AuditRowSignerFn | undefined;
let resolved = false;

/**
 * The process-wide audit-row signer (composed once from `process.env`), or
 * `undefined` in unsigned mode. Cached so the mode is resolved and logged
 * exactly once per process (GAP-355 Stage 3, spec D5/D6: key present → SIGNING;
 * absent → UNSIGNED, legal only in dev/test — a production signing deployment
 * refuses to boot without the key).
 */
export function getAuditRowSigner(): AuditRowSignerFn | undefined {
  if (!resolved) {
    const { signer, mode, kid } = createAuditRowSignerFromEnv(process.env);
    if (mode === 'signed') {
      logger.info(`AUDIT SIGNING: ENABLED (alg=ed25519, kid=${kid})`);
    } else {
      logger.warn(
        'AUDIT SIGNING: DISABLED — audit rows will be written UNSIGNED (no ' +
          'REVEALUI_AUDIT_SIGNING_KEY). Legal only in dev/test; a production signing ' +
          'deployment refuses to boot without the key.',
      );
    }
    cachedSigner = signer;
    resolved = true;
  }
  return cachedSigner;
}

/**
 * Construct a `DrizzleAuditStore` wired to the process-wide signer. Every audit
 * writer builds its store through this helper so a row written through the one
 * door on a signing deployment always carries a signature.
 *
 * @param options Optional store options (GAP-417 residual): pass `targetEnv`
 *   from CLI writers that resolve a deployment target independent of NODE_ENV.
 */
export function createAuditStore(
  db: Database,
  options?: DrizzleAuditStoreOptions,
): DrizzleAuditStoreType {
  return new DrizzleAuditStore(db, getAuditRowSigner(), options);
}

/** Test-only reset of the cached signer (re-reads env on next `getAuditRowSigner`). */
export function __resetAuditSignerForTest(): void {
  cachedSigner = undefined;
  resolved = false;
}

/** DB-side severity vocabulary — matches the `audit_log_severity_check` constraint. */
type DbSeverity = 'info' | 'warn' | 'critical';

/**
 * Severity mapping AT THE BOUNDARY (ADR §5). Total over the security
 * vocabulary; every value lands in the DB CHECK vocabulary. Declared as a
 * `Record<AuditSeverity, ...>` so the compiler rejects any future severity
 * that is not mapped.
 */
const SEVERITY_TO_DB: Record<AuditSeverity, DbSeverity> = {
  low: 'info',
  medium: 'warn',
  high: 'critical',
  critical: 'critical',
};

export function mapSeverityToDb(severity: AuditSeverity): DbSeverity {
  return SEVERITY_TO_DB[severity];
}

/** Reverse map for reconstructing legacy rows written without a full payload. */
const DB_TO_SEVERITY: Record<DbSeverity, AuditSeverity> = {
  info: 'low',
  warn: 'medium',
  critical: 'critical',
};

/**
 * `AuditStorage` implementation backed by `DrizzleAuditStore`. Re-homes the
 * row-storing responsibility onto `DrizzleAuditStore.append()` and keeps the
 * security-model boundary mapping (severity + columns) here, so `@revealui/db`
 * stays free of a dependency on the security package.
 */
export class DrizzleBackedAuditStorage implements AuditStorage {
  private readonly store: DrizzleAuditStoreType;

  constructor(db: Database) {
    // createAuditStore injects the process-wide Ed25519 signer (GAP-355 Stage 3),
    // so rows land signed on a signing deployment and NULL-signature in unsigned
    // (dev/test) mode. The severity/column boundary mapping stays here.
    this.store = createAuditStore(db);
  }

  async write(event: AuditEvent): Promise<void> {
    try {
      // The injected signer (createAuditStore) signs the row at the door on a
      // signing deployment; a signer failure makes append THROW (fail-closed),
      // caught below and routed through the write-result rails.
      await this.store.append({
        id: event.id,
        timestamp: new Date(event.timestamp),
        eventType: event.type,
        severity: mapSeverityToDb(event.severity),
        agentId: event.actor.id,
        payload: event as unknown as Record<string, unknown>,
        policyViolations: [],
      });
      recordAuditWriteResult({ ok: true, eventId: event.id, eventType: event.type });
    } catch (err) {
      recordAuditWriteResult({
        ok: false,
        reason: classifyAuditWriteFailure(err),
        eventId: event.id,
        eventType: event.type,
      });
      throw err;
    }
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    const dbSeverities =
      query.severity && query.severity.length > 0
        ? [...new Set(query.severity.map(mapSeverityToDb))]
        : undefined;

    const entries = await this.store.query({
      agentId: query.actorId,
      eventTypes: query.types ? [...query.types] : undefined,
      severity: dbSeverities,
      startTime: query.startDate,
      endTime: query.endDate,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });

    return entries
      .map((entry) => reconstructEvent(entry))
      .filter((event): event is AuditEvent => {
        if (query.resourceType && event.resource?.type !== query.resourceType) return false;
        if (query.resourceId && event.resource?.id !== query.resourceId) return false;
        if (query.result && query.result.length > 0 && !query.result.includes(event.result)) {
          return false;
        }
        return true;
      });
  }

  async count(query: AuditQuery): Promise<number> {
    // Count ignores pagination (matches InMemoryAuditStorage semantics). Query
    // with an unbounded limit and count the post-filtered results.
    const events = await this.query({ ...query, limit: Number.MAX_SAFE_INTEGER, offset: 0 });
    return events.length;
  }
}

/**
 * Reconstruct the full `AuditEvent` from a stored row. The complete event is
 * persisted in the `payload` column, so it round-trips exactly. Rows written
 * before this adapter (or by another writer without a full-event payload) fall
 * back to a column-derived event.
 */
function reconstructEvent(entry: {
  id: string;
  timestamp: Date;
  eventType: string;
  severity: string;
  agentId: string;
  payload: Record<string, unknown>;
}): AuditEvent {
  const stored = entry.payload;
  if (stored && typeof stored === 'object' && 'type' in stored) {
    return stored as unknown as AuditEvent;
  }
  return {
    id: entry.id,
    timestamp: entry.timestamp.toISOString(),
    type: entry.eventType as AuditEvent['type'],
    severity: DB_TO_SEVERITY[entry.severity as DbSeverity] ?? 'low',
    actor: { id: entry.agentId, type: 'system' },
    action: entry.eventType,
    result: 'success',
    metadata: stored ?? undefined,
  };
}

/**
 * Synchronous env-parity assertion for the audit write path — GAP-355 Stage 1
 * closure, owner-ruled 2026-07-17.
 *
 * A serving process installs audit storage but cannot always run the async
 * round-trip self-test (serverless has no clean "refuse to serve" for a
 * boot-time DB round trip). This asserts the audit path's ENV preconditions
 * SYNCHRONOUSLY at the install point, so a deploy whose audit-critical env has
 * diverged (a required var missing or empty) FAILS THE DEPLOY rather than
 * serving with an audit sink that silently drops every row.
 *
 * Scope, honestly: this catches env-var ABSENCE/emptiness synchronously — which
 * `installAuditStorage()` itself does not, because `getClient()` is a lazy pool
 * factory, so a missing connection URL would otherwise surface only on the
 * first write, at request time. It does NOT, and on serverless cannot, catch
 * migration-state divergence (the `audit_log` table missing or misshapen on the
 * target DB); that needs the write-read round trip of `auditStorageSelfTest`.
 */
export function assertAuditStorageEnv(env: NodeJS.ProcessEnv = process.env): void {
  // GAP-417 item 5: the predicate is OWNED by @revealui/db and matches
  // getClient()'s resolution exactly (config url, then POSTGRES_URL /
  // DATABASE_URL). The previous local triple also accepted DATABASE_HOST,
  // which getClient() never consults — so the assert passed, the install then
  // threw, and production silently kept the in-memory sink (proven in the
  // #2161 re-review). Never re-inline this check.
  if (!hasDatabaseConnectionEnv(env)) {
    throw new Error(
      'AUDIT STORAGE ENV PARITY FAILED: no usable database connection is configured ' +
        '(set POSTGRES_URL or DATABASE_URL, or provide @revealui/config database.url), ' +
        'so the audit write path cannot persist rows. Refusing to serve — an agent ' +
        'action that cannot be recorded must not execute (fail-closed integrity, ' +
        'docs/decisions/2026-07-12-audit-receipt-architecture.md §2a).',
    );
  }

  // Signing key (GAP-355 Stage 3): a production signing deployment must have the
  // Ed25519 key so rows land signed. Absence is a diverged-env deploy — fail it
  // synchronously here (the serverless serving process's refuse-to-serve), the
  // same rail the DB-connection check above uses. Full Ed25519 PKCS#8 parsing is
  // done by validate-startup; this is the audit-owned presence parity check, so
  // the contract cannot silently drift on one serving process. Dev/test
  // (NODE_ENV !== 'production') runs unsigned by design and is exempt.
  //
  // GAP-417 items 1-2 (owner-countersigned 2026-07-25): SKIP_ENV_VALIDATION no
  // longer exempts this check. The audit path has NO escape hatch — a
  // production process that cannot sign must not boot, because unsigned rows
  // are indistinguishable from tampering AND permanently stall anchor
  // contiguity once the sweep filters them. SKIP still covers non-audit env
  // validation elsewhere; it never buys an unsigned production audit log.
  if (env.NODE_ENV === 'production') {
    if (!env.REVEALUI_AUDIT_SIGNING_KEY) {
      throw new Error(
        'AUDIT STORAGE ENV PARITY FAILED: REVEALUI_AUDIT_SIGNING_KEY is not set on a ' +
          'production deployment, so the audit write path cannot sign rows. Refusing to ' +
          'serve — an unsigned row in the post-Stage-3 era is indistinguishable from ' +
          'tampering (docs/decisions/2026-07-12-audit-receipt-architecture.md §2a). ' +
          'SKIP_ENV_VALIDATION does not exempt the audit path (GAP-417).',
      );
    }
  }
}

/**
 * Swap the process-wide `audit` system onto persistent Postgres storage.
 * Synchronous and side-effect-free at call time: `getClient()` is a lazy pool
 * factory (no connection opened here), so this is safe to run on a serverless
 * cold-start path. WITHOUT this call, audit events fall into the default
 * `InMemoryAuditStorage` and evaporate on restart — which is exactly what
 * happened to every admin-process emit before GAP-338.
 *
 * Call `assertAuditStorageEnv()` before this at each install site so a
 * diverged-env deploy fails loudly instead of installing a store that can
 * never write.
 */
export function installAuditStorage(): void {
  audit.setStorage(new DrizzleBackedAuditStorage(getClient()));
}

/**
 * Boot-time round-trip self-test. Writes a synthetic audit event through the
 * REAL installed path (AuditSystem → boundary → DrizzleAuditStore → audit_log)
 * and reads it back. Throws if the round trip fails, so a runtime that cannot
 * record agent actions REFUSES TO SERVE rather than silently dropping them
 * (fail-closed integrity — ADR §2a).
 *
 * Uses `severity: 'low'` deliberately: that value would be rejected by the DB
 * CHECK constraint if the boundary mapping regressed, so this exercises the
 * exact defect Stage 1 fixes. A healthy audit path lets startup proceed.
 *
 * Runs on the long-running worker (once per deploy) and the dev boot path,
 * where an async boot chain already exists and `process.exit(1)` gives
 * "refuse to serve" clean semantics. It is NOT run on serverless cold-start
 * paths, which stay free of per-invocation DB round-trips (storage is still
 * installed there synchronously by `installAuditStorage()`).
 */
export async function auditStorageSelfTest(auditSystem: AuditSystem = audit): Promise<void> {
  const marker = `__audit-self-test__:${randomUUID()}`;
  const written = await auditSystem.log({
    type: 'security.audit_self_test',
    severity: 'low',
    actor: { id: marker, type: 'system' },
    action: 'audit-storage-self-test',
    result: 'success',
    metadata: { synthetic: true },
  });

  const found = await auditSystem.query({ actorId: marker, limit: 5 });
  if (!found.some((event) => event.id === written.id)) {
    throw new Error(
      'AUDIT STORAGE SELF-TEST FAILED: wrote a synthetic audit event but could not read it ' +
        'back. Refusing to serve — a runtime that cannot record agent actions must not accept ' +
        'traffic (fail-closed integrity, docs/decisions/2026-07-12-audit-receipt-architecture.md §2a).',
    );
  }
}
