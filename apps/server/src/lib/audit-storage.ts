/**
 * Audit storage boundary — wires the `@revealui/core/security` AuditSystem to
 * the persistent `DrizzleAuditStore` (@revealui/db) that owns the `audit_log`
 * table.
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
 * Rows are written UNSIGNED: `signature` / `previous_signature` are left NULL.
 * Stage 1 lands honest, queryable, append-only records. Signing (Ed25519 +
 * canonicalization) is Stage 3 — writing an unverifiable value here is the
 * original defect this whole effort exists to undo.
 */

import { randomUUID } from 'node:crypto';
import type {
  AuditEvent,
  AuditQuery,
  AuditSeverity,
  AuditStorage,
  AuditSystem,
} from '@revealui/core/security';
import { audit, classifyAuditWriteFailure, recordAuditWriteResult } from '@revealui/core/security';
import { DrizzleAuditStore, getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';

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
 * `AuditStorage` implementation backed by `DrizzleAuditStore`. Replaces the
 * deleted `PostgresAuditStorage`: it re-homes the row-storing responsibility
 * onto `DrizzleAuditStore.append()` and keeps the security-model boundary
 * mapping (severity + columns) here in apps/server, so `@revealui/db` stays
 * free of a dependency on the security package.
 */
export class DrizzleBackedAuditStorage implements AuditStorage {
  private readonly store: DrizzleAuditStore;

  constructor(db: Database) {
    this.store = new DrizzleAuditStore(db);
  }

  async write(event: AuditEvent): Promise<void> {
    try {
      // No `signature` / `previous_signature` — DrizzleAuditStore.append does
      // not set them, so they persist as NULL. Rows are unsigned by design in
      // Stage 1.
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
 * The Vercel serving process installs audit storage but, unlike the worker,
 * does not run the async round-trip self-test (serverless has no clean "refuse
 * to serve" for a boot-time DB round trip). This asserts the audit path's ENV
 * preconditions SYNCHRONOUSLY at the install point, so a deploy whose
 * audit-critical env has diverged (a required var missing or empty) FAILS THE
 * DEPLOY rather than serving with an audit sink that silently drops every row.
 * It is the audit-owned home for that contract: a future audit env dependency
 * (e.g. the Stage 3 Ed25519 signing key) is asserted here on every serving
 * process, not only wherever the general required-env list happens to cover it.
 *
 * Scope, honestly: this catches env-var ABSENCE/emptiness synchronously — which
 * `installAuditStorage()` itself does not, because `getClient()` is a lazy pool
 * factory, so a missing connection URL would otherwise surface only on the
 * first write, at request time. It does NOT, and on serverless cannot, catch
 * migration-state divergence (the `audit_log` table missing or misshapen on the
 * target DB); that needs the write-read round trip the worker runs. See
 * `auditStorageSelfTest`. The DB connection group is also validated by
 * `validateStartup()` (REQUIRED_ALWAYS_GROUPS); this is the audit-owned,
 * install-co-located restatement so the contract cannot silently drift.
 */
export function assertAuditStorageEnv(env: NodeJS.ProcessEnv = process.env): void {
  const hasDbConnection = Boolean(env.DATABASE_URL || env.POSTGRES_URL || env.DATABASE_HOST);
  if (!hasDbConnection) {
    throw new Error(
      'AUDIT STORAGE ENV PARITY FAILED: no database connection env is set (one of ' +
        'DATABASE_URL, POSTGRES_URL, DATABASE_HOST is required), so the audit write path ' +
        'cannot persist rows. Refusing to serve — an agent action that cannot be recorded ' +
        'must not execute (fail-closed integrity, ' +
        'docs/decisions/2026-07-12-audit-receipt-architecture.md §2a).',
    );
  }
}

/**
 * Swap the process-wide `audit` system onto persistent Postgres storage.
 * Synchronous and side-effect-free at call time: `getClient()` is a lazy pool
 * factory (no connection opened here), so this is safe to run on the Vercel
 * cold-start path alongside `validateStartup()`. WITHOUT this call in
 * production, request-level audit events fell into the default
 * `InMemoryAuditStorage` and evaporated on every serverless invocation.
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
 * "refuse to serve" clean semantics. It is NOT run on the Vercel cold-start
 * path, which the Phase-2 design keeps free of per-invocation DB round-trips
 * (storage is still installed there synchronously by `installAuditStorage()`).
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
