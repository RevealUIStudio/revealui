/**
 * P5 `graph.*` replica — the in-repo half of the daemon replica surface.
 *
 * The RevDev daemon (separate repo) is expected to wrap these handlers as
 * JSON-RPC `graph.pull` / `graph.apply` / `graph.push`. This package owns the
 * convergent op log (`kg_outbox`) and the apply path; it does not open a
 * network socket and never writes a remote production graph from tests.
 *
 *   graph.pull  — read unpushed outbox ops (no writes)
 *   graph.apply — apply a remote op batch (`recordOutbox: false` so peers
 *                 do not echo the same ops back)
 *   graph.push  — ack local outbox rows (`pushed_at`)
 */

import { applyOps } from '../ingest/merge.js';
import type { KgExecutor, KgOp } from '../types.js';
import { parseKgOps } from './ops.js';

export const GRAPH_METHODS = {
  pull: 'graph.pull',
  apply: 'graph.apply',
  push: 'graph.push',
} as const;

export type GraphMethod = (typeof GRAPH_METHODS)[keyof typeof GRAPH_METHODS];

const GRAPH_METHOD_SET: ReadonlySet<string> = new Set(Object.values(GRAPH_METHODS));

export function isGraphMethod(value: string): value is GraphMethod {
  return GRAPH_METHOD_SET.has(value);
}

export const GRAPH_REPLICA_CONFIG = {
  /** Default page size for graph.pull. */
  defaultLimit: 100,
  /** Hard cap on a single pull page. */
  maxLimit: 1000,
} as const;

export interface GraphOutboxEntry {
  seq: number;
  siteId: string;
  op: KgOp;
  createdAt: string;
}

export interface GraphPullParams {
  sinceSeq?: number;
  limit?: number;
  siteId?: string;
  includePushed?: boolean;
}

export interface GraphPullResult {
  entries: GraphOutboxEntry[];
  nextSeq: number;
}

export interface GraphApplyParams {
  ops: unknown;
  dryRun?: boolean;
}

export interface GraphApplyResult {
  applied: number;
  dryRun: boolean;
}

export interface GraphPushParams {
  untilSeq?: number;
  seqs?: number[];
  dryRun?: boolean;
  pushedAt?: Date;
}

export interface GraphPushResult {
  marked: number;
  dryRun: boolean;
}

interface OutboxRow {
  seq: number | string;
  site_id: string;
  op: unknown;
  created_at: string | Date;
}

function asSeq(value: number | string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`kg_outbox seq is not a number: ${String(value)}`);
  return n;
}

function asIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function resolveLimit(limit: number | undefined): number {
  const n = limit ?? GRAPH_REPLICA_CONFIG.defaultLimit;
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('graph.pull --limit must be a positive integer');
  }
  return Math.min(Math.floor(n), GRAPH_REPLICA_CONFIG.maxLimit);
}

export async function graphPull(
  exec: KgExecutor,
  params: GraphPullParams = {},
): Promise<GraphPullResult> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (params.sinceSeq !== undefined) {
    values.push(params.sinceSeq);
    clauses.push(`seq > $${values.length}`);
  }
  if (params.siteId) {
    values.push(params.siteId);
    clauses.push(`site_id = $${values.length}`);
  }
  if (!params.includePushed) {
    clauses.push('pushed_at IS NULL');
  }
  values.push(resolveLimit(params.limit));
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await exec.query<OutboxRow>(
    `SELECT seq, site_id, op, created_at FROM kg_outbox ${where} ORDER BY seq LIMIT $${values.length}`,
    values,
  );
  const entries: GraphOutboxEntry[] = rows.map((row) => ({
    seq: asSeq(row.seq),
    siteId: row.site_id,
    op: parseKgOps([row.op])[0] as KgOp,
    createdAt: asIso(row.created_at),
  }));
  const last = entries[entries.length - 1];
  return {
    entries,
    nextSeq: last?.seq ?? params.sinceSeq ?? 0,
  };
}

export async function graphApply(
  exec: KgExecutor,
  params: GraphApplyParams,
): Promise<GraphApplyResult> {
  const ops = parseKgOps(params.ops);
  if (params.dryRun) {
    return { applied: ops.length, dryRun: true };
  }
  await exec.transaction((tx) => applyOps(tx, ops, { recordOutbox: false }));
  return { applied: ops.length, dryRun: false };
}

export async function graphPush(
  exec: KgExecutor,
  params: GraphPushParams = {},
): Promise<GraphPushResult> {
  const pushedAt = (params.pushedAt ?? new Date()).toISOString();
  const clauses = ['pushed_at IS NULL'];
  const values: unknown[] = [];

  if (params.seqs && params.seqs.length > 0) {
    values.push(params.seqs);
    clauses.push(`seq = ANY($${values.length}::bigint[])`);
  } else if (params.untilSeq !== undefined) {
    values.push(params.untilSeq);
    clauses.push(`seq <= $${values.length}`);
  } else {
    throw new Error('graph.push requires untilSeq or a non-empty seqs list');
  }

  if (params.dryRun) {
    const rows = await exec.query<{ seq: number | string }>(
      `SELECT seq FROM kg_outbox WHERE ${clauses.join(' AND ')}`,
      values,
    );
    return { marked: rows.length, dryRun: true };
  }

  values.push(pushedAt);
  const rows = await exec.query<{ seq: number | string }>(
    `UPDATE kg_outbox SET pushed_at = $${values.length}::timestamptz
     WHERE ${clauses.join(' AND ')}
     RETURNING seq`,
    values,
  );
  return { marked: rows.length, dryRun: false };
}

export async function handleGraphMethod(
  method: string,
  params: Record<string, unknown>,
  exec: KgExecutor,
): Promise<GraphPullResult | GraphApplyResult | GraphPushResult> {
  if (!isGraphMethod(method)) {
    throw new Error(`unknown graph method: ${method}`);
  }
  switch (method) {
    case GRAPH_METHODS.pull:
      return graphPull(exec, {
        sinceSeq: typeof params.sinceSeq === 'number' ? params.sinceSeq : undefined,
        limit: typeof params.limit === 'number' ? params.limit : undefined,
        siteId: typeof params.siteId === 'string' ? params.siteId : undefined,
        includePushed: params.includePushed === true,
      });
    case GRAPH_METHODS.apply:
      return graphApply(exec, {
        ops: params.ops,
        dryRun: params.dryRun === true,
      });
    case GRAPH_METHODS.push:
      return graphPush(exec, {
        untilSeq: typeof params.untilSeq === 'number' ? params.untilSeq : undefined,
        seqs: Array.isArray(params.seqs)
          ? params.seqs.filter((n): n is number => typeof n === 'number')
          : undefined,
        dryRun: params.dryRun === true,
      });
  }
}
