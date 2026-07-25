/**
 * Drizzle Audit Store
 *
 * Persistent implementation of the AuditStore interface from @revealui/ai.
 * Stores audit entries in the audit_log PostgreSQL table via Drizzle ORM.
 * Append-only  -  no update or delete operations.
 *
 * Types are defined locally to avoid a circular dependency on @revealui/ai.
 * They mirror AuditEntry and AuditFilter from @revealui/ai/audit/types.
 */

import { and, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from './client/index.js';
import { auditLog } from './schema/audit-log.js';

// ─── Local Type Mirrors ─────────────────────────────────────────────────────
// These mirror @revealui/ai AuditEntry and AuditFilter to avoid circular deps.

/** Audit entry stored in the database */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  severity: string;
  agentId: string;
  taskId?: string;
  sessionId?: string;
  payload: Record<string, unknown>;
  policyViolations: string[];
  /**
   * Tenant/account scope (GAP-355 Stage 2), for per-tenant anchoring. Optional
   * pass-through; absent → NULL, no backfill. `seq` is never accepted here — it
   * is DB-assigned (unsigned mode) or fetched from the sequence before INSERT
   * (signed mode); a caller never supplies it.
   */
  tenant?: string | null;
}

// ─── Injected Row Signer (GAP-355 Stage 3, spec D5 / constraint B) ───────────

/**
 * The integrity-bearing shape handed to an injected audit-row signer. Structural
 * only: `@revealui/db` stays crypto-free AND security-package-free. The real
 * Ed25519 signer + RFC 8785 canonicalizer live in `@revealui/security`; the
 * `apps/server` construction site composes them into an `AuditRowSignerFn` and
 * injects it here. These fields mirror `@revealui/security`'s `AuditSignable`
 * exactly, so the composed closure is structurally assignable.
 */
export interface AuditRowSignable {
  id: string;
  sequence: number;
  tenant: string | null;
  timestamp: Date;
  eventType: string;
  severity: string;
  agentId: string;
  taskId: string | null;
  sessionId: string | null;
  payload: unknown;
  policyViolations: string[];
}

/**
 * Injected signer. Given the full row (including the pre-fetched `sequence`),
 * returns the `signature` column value (the `v1.ed25519.<kid>.<sig>` string).
 *
 * Fail-closed (spec D5): a signer that is configured but throws makes the append
 * THROW, so no unsigned row ever lands on a signing deployment. The store does
 * not catch it — the failure propagates to the caller's write-result rails.
 */
export type AuditRowSignerFn = (row: AuditRowSignable) => string;

/** Filters for querying audit entries */
export interface AuditFilter {
  agentId?: string;
  taskId?: string;
  sessionId?: string;
  eventTypes?: string[];
  severity?: string[];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

// ─── Drizzle Audit Store ────────────────────────────────────────────────────

/**
 * PostgreSQL-backed audit store using Drizzle ORM.
 * Implements the AuditStore interface for production use.
 *
 * All writes are append-only. The table has no UPDATE or DELETE operations.
 */
export class DrizzleAuditStore {
  /**
   * @param db     Drizzle client.
   * @param signer Optional injected row signer (GAP-355 Stage 3). When supplied,
   *   every append fetches the row's `seq` from the sequence FIRST (so the signed
   *   bytes can include it — see `nextSeqValues`), signs, and INSERTs with an
   *   explicit `seq` + `signature`. When absent, the DB assigns `seq` and the
   *   `signature` column stays NULL — the honest unsigned state for dev/test.
   */
  constructor(
    private readonly db: Database,
    private readonly signer?: AuditRowSignerFn,
  ) {}

  /**
   * GAP-417 items 1-2 (owner-countersigned 2026-07-25), store-level rail: a
   * production process must never land an unsigned audit row, regardless of
   * how it booted. Unsigned rows are indistinguishable from tampering and
   * permanently stall anchor contiguity once the sweep filters them. The
   * boot-time assert is the first rail; this is the backstop for any path
   * that constructs a signer-less store while NODE_ENV=production.
   */
  private refuseUnsignedInProduction(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'DrizzleAuditStore: refusing to write an UNSIGNED audit row in production — ' +
          'no row signer is injected. An unsigned row is indistinguishable from ' +
          'tampering and stalls anchor contiguity (GAP-417). Provision ' +
          'REVEALUI_AUDIT_SIGNING_KEY and construct the store through createAuditStore.',
      );
    }
  }

  /** Append a single entry to the audit log */
  async append(entry: AuditEntry): Promise<void> {
    if (!this.signer) {
      this.refuseUnsignedInProduction();
      // Unsigned mode (dev/test only): DB assigns `seq` (column default),
      // `signature` stays NULL.
      await this.db.insert(auditLog).values(this.unsignedValues(entry));
      return;
    }

    // Signed mode: the `seq` is a signed field but DB-assigned by a bigserial,
    // and migration 0026's append-only trigger forbids a sign-then-UPDATE. So
    // fetch the sequence value up front and INSERT it explicitly alongside the
    // signature computed over it.
    const [seq] = await this.nextSeqValues(1);
    if (seq === undefined) {
      throw new Error('DrizzleAuditStore: no seq value returned for a signed append');
    }
    const signature = this.signRow(entry, seq);
    await this.db.insert(auditLog).values({
      ...this.unsignedValues(entry),
      seq,
      signature,
    });
  }

  /** Append multiple entries atomically in a single INSERT */
  async appendBatch(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;

    if (!this.signer) {
      this.refuseUnsignedInProduction();
      await this.db.insert(auditLog).values(entries.map((entry) => this.unsignedValues(entry)));
      return;
    }

    // One round trip fetches N sequence values; each entry is signed over its own.
    const seqs = await this.nextSeqValues(entries.length);
    const values = entries.map((entry, i) => {
      const seq = seqs[i];
      if (seq === undefined) {
        throw new Error('DrizzleAuditStore: missing seq value for a signed batch append');
      }
      return { ...this.unsignedValues(entry), seq, signature: this.signRow(entry, seq) };
    });
    await this.db.insert(auditLog).values(values);
  }

  /**
   * The column values shared by signed and unsigned inserts. `seq` and
   * `signature` are intentionally omitted: in unsigned mode the DB assigns `seq`
   * and `signature` stays NULL; in signed mode both are set explicitly by the
   * caller. `previous_signature` is never written (GAP-355 Stage 3 abandons the
   * chain; the column is kept but stops being written, spec D7.5).
   */
  private unsignedValues(entry: AuditEntry) {
    return {
      id: entry.id,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      severity: entry.severity,
      agentId: entry.agentId,
      taskId: entry.taskId ?? null,
      sessionId: entry.sessionId ?? null,
      payload: entry.payload,
      policyViolations: entry.policyViolations,
      tenant: entry.tenant ?? null,
    };
  }

  /** Sign one entry over its pre-fetched `seq`. Throws if the signer throws. */
  private signRow(entry: AuditEntry, seq: number): string {
    if (!this.signer) {
      throw new Error('DrizzleAuditStore.signRow called without an injected signer');
    }
    return this.signer({
      id: entry.id,
      sequence: seq,
      tenant: entry.tenant ?? null,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      severity: entry.severity,
      agentId: entry.agentId,
      taskId: entry.taskId ?? null,
      sessionId: entry.sessionId ?? null,
      payload: entry.payload,
      policyViolations: entry.policyViolations,
    });
  }

  /**
   * Fetch `count` monotonic `seq` values from the `audit_log` seq sequence in a
   * single round trip, WITHOUT inserting a row. The sequence name is derived
   * robustly with `pg_get_serial_sequence` rather than hard-coding the implicit
   * `audit_log_seq_seq` bigserial name.
   *
   * Sequence gaps from an aborted transaction (a fetched value whose INSERT then
   * fails/rolls back) are inherent to Postgres sequences and expected — that is a
   * Stage-4 anchoring concern, already recorded; the signature over each row's
   * own `seq` is unaffected.
   */
  private async nextSeqValues(count: number): Promise<number[]> {
    // Drizzle's `db.execute` returns either a raw rows array (PGlite,
    // node-postgres) or `{ rows: [...] }` (neon-http). Normalize both; the driver
    // return shapes don't share a nominal type, so narrow through `unknown`.
    // drizzle-raw: nextval + generate_series over a sequence have no Drizzle query-builder equivalent; reads N seq values without inserting a row
    const result: unknown = await this.db.execute(
      sql`SELECT nextval(pg_get_serial_sequence('audit_log', 'seq')) AS seq FROM generate_series(1, ${count})`,
    );
    const rows = Array.isArray(result)
      ? (result as Array<{ seq: number | string }>)
      : ((result as { rows?: Array<{ seq: number | string }> }).rows ?? []);
    if (rows.length !== count) {
      throw new Error(
        `DrizzleAuditStore: expected ${count} audit_log seq value(s) from nextval, got ${rows.length}`,
      );
    }
    return rows.map((row) => Number(row.seq));
  }

  /** Query entries with filters (human-side only) */
  async query(filter: AuditFilter): Promise<AuditEntry[]> {
    const conditions = [];

    if (filter.agentId) {
      conditions.push(eq(auditLog.agentId, filter.agentId));
    }
    if (filter.taskId) {
      conditions.push(eq(auditLog.taskId, filter.taskId));
    }
    if (filter.sessionId) {
      conditions.push(eq(auditLog.sessionId, filter.sessionId));
    }
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      conditions.push(inArray(auditLog.eventType, filter.eventTypes));
    }
    if (filter.severity && filter.severity.length > 0) {
      conditions.push(inArray(auditLog.severity, filter.severity));
    }
    if (filter.startTime) {
      conditions.push(gte(auditLog.timestamp, filter.startTime));
    }
    if (filter.endTime) {
      conditions.push(lte(auditLog.timestamp, filter.endTime));
    }

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.timestamp))
      .limit(filter.limit ?? 1000)
      .offset(filter.offset ?? 0);

    return rows.map(rowToEntry);
  }

  /** Get total entry count (optionally filtered by agent) */
  async count(agentId?: string): Promise<number> {
    const condition = agentId ? eq(auditLog.agentId, agentId) : undefined;

    const result = await this.db.select({ value: count() }).from(auditLog).where(condition);

    return result[0]?.value ?? 0;
  }

  /** Get entries since a given timestamp */
  async since(timestamp: Date, limit = 1000): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(gte(auditLog.timestamp, timestamp))
      .orderBy(desc(auditLog.timestamp))
      .limit(limit);

    return rows.map(rowToEntry);
  }
}

// ─── Row Mapping ────────────────────────────────────────────────────────────

/** Convert a database row to an AuditEntry */
function rowToEntry(row: typeof auditLog.$inferSelect): AuditEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    eventType: row.eventType,
    severity: row.severity,
    agentId: row.agentId,
    taskId: row.taskId ?? undefined,
    sessionId: row.sessionId ?? undefined,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    policyViolations: row.policyViolations ?? [],
  };
}
