/**
 * Scoped budget reserve and record.
 *
 * Neon HTTP has no multi-statement transactions. `budget_apply_spend` is one
 * SQL statement: it takes an account advisory lock, then (as the next command
 * inside that transaction) reads and writes ledgers and incidents. Callers
 * on either driver issue a single `SELECT budget_apply_spend(...)`.
 *
 * Reserve (tasks, governed_actions) is all-or-nothing across scopes and never
 * spends past a hard-stop limit. Record (cost_micros, and post-action counts
 * such as a governed MCP tool call) always adds. Cost can overshoot by the
 * call in flight. Shadow performs the same writes and returns allowed.
 */

import { randomUUID } from 'node:crypto';
import { type SQL, sql } from 'drizzle-orm';
import type { AuditEntry } from '../audit-store.js';
import {
  BUDGET_METRICS,
  BUDGET_RESOLUTIONS,
  BUDGET_SCOPE_TYPES,
  type BudgetMetric,
  type BudgetResolution,
  type BudgetScopeType,
  type BudgetThresholdType,
} from '../schema/budgets.js';
import type { BudgetMode } from './mode.js';

export const BUDGET_SYSTEM_AGENT_ID = 'budget:system';

const RESERVE_METRICS: ReadonlySet<string> = new Set(['governed_actions', 'tasks']);
const SCOPE_SET: ReadonlySet<string> = new Set(BUDGET_SCOPE_TYPES);
const METRIC_SET: ReadonlySet<string> = new Set(BUDGET_METRICS);
const RESOLUTION_SET: ReadonlySet<string> = new Set(BUDGET_RESOLUTIONS);
const SCOPE_RANK: ReadonlyMap<string, number> = new Map([
  ['account', 0],
  ['agent', 1],
  ['goal', 2],
]);

export interface BudgetDb {
  execute(query: SQL): Promise<unknown>;
}

export interface BudgetAuditWriter {
  append(entry: AuditEntry): Promise<void>;
  appendBatch?(entries: AuditEntry[]): Promise<void>;
}

export interface BudgetScopeRef {
  scopeType: BudgetScopeType;
  scopeId: string;
}

export interface BudgetWriteInput {
  accountId: string;
  scopes: readonly BudgetScopeRef[];
  units: number;
  at?: Date;
  mode: BudgetMode;
  actorAgentId?: string;
  runId?: string;
  sessionId?: string;
}

export interface BudgetReserveInput extends BudgetWriteInput {
  metric: 'governed_actions' | 'tasks';
}

export interface BudgetRecordInput extends BudgetWriteInput {
  metric: BudgetMetric;
}

export interface BudgetIncidentRef {
  incidentId: string;
  policyId: string;
  scopeType: BudgetScopeType;
  scopeId: string;
  thresholdType: BudgetThresholdType;
  amountLimit: number;
  amountObserved: number;
  windowStart: string;
}

export interface BudgetDecision {
  allowed: boolean;
  mode: BudgetMode;
  wouldDeny: boolean;
  reason?: 'budget_hard_stop';
  policyId?: string;
  incidentId?: string;
  scopeType?: BudgetScopeType;
  scopeId?: string;
  incidentsOpened: BudgetIncidentRef[];
}

export interface BudgetRecordResult {
  mode: BudgetMode;
  applied: boolean;
  wouldPause: boolean;
  incidentsOpened: BudgetIncidentRef[];
}

export interface ResolveBudgetIncidentInput {
  accountId: string;
  incidentId: string;
  resolution: BudgetResolution;
  actorUserId: string;
}

export interface ResolveBudgetIncidentResult {
  resolved: boolean;
  incidentId: string;
}

interface ApplyRow {
  id?: string;
  incidentId?: string;
  policyId: string;
  scopeType: BudgetScopeType;
  scopeId: string;
  windowStart: string;
  thresholdType?: BudgetThresholdType;
  amountLimit?: number;
  amountObserved?: number;
  spent?: number;
}

interface ApplyResult {
  allowed: boolean;
  policyCount: number;
  applied: ApplyRow[];
  opened: ApplyRow[];
  pauses: ApplyRow[];
}

function failClosedMode(mode: BudgetMode): BudgetMode {
  if (mode === 'off' || mode === 'shadow' || mode === 'enforce') return mode;
  return 'enforce';
}

function assertUnits(units: number): void {
  if (!Number.isSafeInteger(units) || units < 0) {
    throw new Error('budget units must be a non-negative safe integer');
  }
}

function assertAccount(accountId: string): void {
  if (accountId.length === 0) throw new Error('budget accountId is required');
}

function normalizeScopes(scopes: readonly BudgetScopeRef[]): BudgetScopeRef[] {
  const seen = new Set<string>();
  const out: BudgetScopeRef[] = [];
  for (const scope of scopes) {
    if (!SCOPE_SET.has(scope.scopeType)) {
      throw new Error(`budget scopeType must be account, agent, or goal`);
    }
    if (scope.scopeId.length === 0) throw new Error('budget scopeId is required');
    const key = `${scope.scopeType}\0${scope.scopeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ scopeType: scope.scopeType, scopeId: scope.scopeId });
  }
  return out;
}

function extractRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as Record<string, unknown>[];
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error('budget_apply_spend returned a non-object');
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  }
  return [];
}

function asInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value.length > 0) return Number(value);
  throw new Error('budget: expected an integer field');
}

function asBool(value: unknown): boolean {
  return value === true || value === 't' || value === 'true';
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error('budget: expected a text field');
}

function asScopeType(value: unknown): BudgetScopeType {
  if (typeof value === 'string' && SCOPE_SET.has(value)) return value as BudgetScopeType;
  throw new Error('budget: expected a scope type');
}

function asThreshold(value: unknown): BudgetThresholdType {
  if (value === 'warn' || value === 'hard_stop') return value;
  throw new Error('budget: expected a threshold type');
}

function isoWindow(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  throw new Error('budget: expected a window timestamp');
}

function readRow(value: unknown): ApplyRow {
  const row = asObject(value);
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    incidentId: typeof row.incidentId === 'string' ? row.incidentId : undefined,
    policyId: asText(row.policyId),
    scopeType: asScopeType(row.scopeType),
    scopeId: asText(row.scopeId),
    windowStart: isoWindow(row.windowStart),
    thresholdType: row.thresholdType === undefined ? undefined : asThreshold(row.thresholdType),
    amountLimit: row.amountLimit === undefined ? undefined : asInt(row.amountLimit),
    amountObserved: row.amountObserved === undefined ? undefined : asInt(row.amountObserved),
    spent: row.spent === undefined ? undefined : asInt(row.spent),
  };
}

function readApplyResult(result: unknown): ApplyResult {
  const rows = extractRows(result);
  const first = rows[0];
  if (!first) throw new Error('budget_apply_spend returned no row');
  const payload = asObject(first.result ?? first.budget_apply_spend);
  return {
    allowed: asBool(payload.allowed),
    policyCount: asInt(payload.policyCount),
    applied: asArray(payload.applied).map(readRow),
    opened: asArray(payload.opened).map(readRow),
    pauses: asArray(payload.pauses).map(readRow),
  };
}

function toIncident(row: ApplyRow, threshold: BudgetThresholdType): BudgetIncidentRef {
  const incidentId = row.id ?? row.incidentId;
  if (!incidentId) throw new Error('budget incident row is missing an id');
  return {
    incidentId,
    policyId: row.policyId,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    thresholdType: threshold,
    amountLimit: row.amountLimit ?? 0,
    amountObserved: row.amountObserved ?? 0,
    windowStart: row.windowStart,
  };
}

function rankScope(scopeType: string): number {
  return SCOPE_RANK.get(scopeType) ?? 9;
}

function pickPrimary(rows: BudgetIncidentRef[]): BudgetIncidentRef | undefined {
  const sorted = [...rows].sort((a, b) => {
    const byScope = rankScope(a.scopeType) - rankScope(b.scopeType);
    if (byScope !== 0) return byScope;
    if (a.policyId < b.policyId) return -1;
    if (a.policyId > b.policyId) return 1;
    return 0;
  });
  return sorted[0];
}

async function applySpend(
  db: BudgetDb,
  input: {
    accountId: string;
    metric: BudgetMetric;
    units: number;
    at: Date;
    scopes: readonly BudgetScopeRef[];
    kind: 'reserve' | 'record';
  },
): Promise<ApplyResult> {
  const scopesJson = JSON.stringify(
    input.scopes.map((scope) => ({ scope_type: scope.scopeType, scope_id: scope.scopeId })),
  );
  const result = await db.execute(sql`
    SELECT budget_apply_spend(
      ${input.accountId}::text,
      ${input.metric}::text,
      ${input.units}::bigint,
      ${input.at.toISOString()}::timestamptz,
      ${scopesJson}::jsonb,
      ${input.kind}::text
    ) AS result
  `);
  return readApplyResult(result);
}

function auditEntry(input: {
  eventType: string;
  severity: 'info' | 'warn' | 'critical';
  accountId: string;
  agentId: string;
  payload: Record<string, unknown>;
  sessionId?: string;
  taskId?: string;
}): AuditEntry {
  return {
    id: randomUUID(),
    timestamp: new Date(),
    eventType: input.eventType,
    severity: input.severity,
    agentId: input.agentId,
    taskId: input.taskId,
    sessionId: input.sessionId,
    payload: input.payload,
    policyViolations: [],
    tenant: input.accountId,
  };
}

function incidentPayload(
  metric: BudgetMetric,
  incident: BudgetIncidentRef,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    policyId: incident.policyId,
    scopeType: incident.scopeType,
    scopeId: incident.scopeId,
    metric,
    windowStart: incident.windowStart,
    incidentId: incident.incidentId,
    amountObserved: incident.amountObserved,
    amountLimit: incident.amountLimit,
    ...extra,
  };
}

async function writeAudits(
  audit: BudgetAuditWriter | undefined,
  entries: AuditEntry[],
): Promise<void> {
  if (!audit || entries.length === 0) return;
  if (audit.appendBatch) {
    await audit.appendBatch(entries);
    return;
  }
  for (const entry of entries) {
    await audit.append(entry);
  }
}

function openedIncidents(applied: ApplyResult): BudgetIncidentRef[] {
  return applied.opened.map((row) => toIncident(row, row.thresholdType ?? 'hard_stop'));
}

function pauseIncidents(applied: ApplyResult): BudgetIncidentRef[] {
  return applied.pauses.map((row) => toIncident(row, 'hard_stop'));
}

/**
 * Pre-action gate for count metrics. Hard-stop scopes pass together or the
 * reserve does not spend. Shadow still writes the denial and returns allowed.
 */
export async function reserveBudget(
  db: BudgetDb,
  input: BudgetReserveInput,
  audit?: BudgetAuditWriter,
): Promise<BudgetDecision> {
  const mode = failClosedMode(input.mode);
  assertAccount(input.accountId);
  assertUnits(input.units);
  if (!RESERVE_METRICS.has(input.metric)) {
    throw new Error('budget reserve metric must be tasks or governed_actions');
  }
  const scopes = normalizeScopes(input.scopes);
  if (mode === 'off' || input.units === 0 || scopes.length === 0) {
    return { allowed: true, mode, wouldDeny: false, incidentsOpened: [] };
  }

  const applied = await applySpend(db, {
    accountId: input.accountId,
    metric: input.metric,
    units: input.units,
    at: input.at ?? new Date(),
    scopes,
    kind: 'reserve',
  });
  const opened = openedIncidents(applied);
  const pauses = pauseIncidents(applied);
  const wouldDeny = applied.policyCount > 0 && !applied.allowed;
  const blocking = pickPrimary([
    ...pauses,
    ...opened.filter((incident) => incident.thresholdType === 'hard_stop'),
  ]);
  const agentId = input.actorAgentId ?? BUDGET_SYSTEM_AGENT_ID;
  const entries: AuditEntry[] = [];
  for (const incident of opened) {
    entries.push(
      auditEntry({
        eventType:
          incident.thresholdType === 'warn'
            ? 'budget:threshold:warned'
            : 'budget:hard_stop:tripped',
        severity: incident.thresholdType === 'warn' ? 'warn' : 'critical',
        accountId: input.accountId,
        agentId,
        sessionId: input.sessionId,
        taskId: input.runId,
        payload: incidentPayload(input.metric, incident),
      }),
    );
  }
  if (wouldDeny && blocking) {
    entries.push(
      auditEntry({
        eventType: mode === 'shadow' ? 'budget:would_deny' : 'budget:action:denied',
        severity: mode === 'shadow' ? 'info' : 'warn',
        accountId: input.accountId,
        agentId,
        sessionId: input.sessionId,
        taskId: input.runId,
        payload: incidentPayload(input.metric, blocking, {
          reason: 'budget_hard_stop',
          ...(input.runId ? { runId: input.runId } : {}),
        }),
      }),
    );
  }
  await writeAudits(audit, entries);

  return {
    allowed: mode === 'shadow' ? true : applied.allowed || applied.policyCount === 0,
    mode,
    wouldDeny,
    ...(wouldDeny ? { reason: 'budget_hard_stop' as const } : {}),
    ...(blocking
      ? {
          policyId: blocking.policyId,
          incidentId: blocking.incidentId,
          scopeType: blocking.scopeType,
          scopeId: blocking.scopeId,
        }
      : {}),
    incidentsOpened: opened,
  };
}

/**
 * Post-action spend. Always adds, including past a hard limit (honest
 * overshoot). Opens warn once per window and hard_stop when the total crosses
 * the limit. Shadow does not turn this into a refusal; the open incident is
 * what a later reserve refuses.
 */
export async function recordBudgetSpend(
  db: BudgetDb,
  input: BudgetRecordInput,
  audit?: BudgetAuditWriter,
): Promise<BudgetRecordResult> {
  const mode = failClosedMode(input.mode);
  assertAccount(input.accountId);
  assertUnits(input.units);
  if (!METRIC_SET.has(input.metric)) throw new Error('budget record metric is invalid');
  const scopes = normalizeScopes(input.scopes);
  if (mode === 'off' || input.units === 0 || scopes.length === 0) {
    return { mode, applied: false, wouldPause: false, incidentsOpened: [] };
  }

  const applied = await applySpend(db, {
    accountId: input.accountId,
    metric: input.metric,
    units: input.units,
    at: input.at ?? new Date(),
    scopes,
    kind: 'record',
  });
  const opened = openedIncidents(applied);
  const hardOpened = opened.filter((incident) => incident.thresholdType === 'hard_stop');
  const wouldPause = hardOpened.length > 0 || pauseIncidents(applied).length > 0;
  const agentId = input.actorAgentId ?? BUDGET_SYSTEM_AGENT_ID;
  const entries: AuditEntry[] = [];
  for (const incident of opened) {
    entries.push(
      auditEntry({
        eventType:
          incident.thresholdType === 'warn'
            ? 'budget:threshold:warned'
            : 'budget:hard_stop:tripped',
        severity: incident.thresholdType === 'warn' ? 'warn' : 'critical',
        accountId: input.accountId,
        agentId,
        sessionId: input.sessionId,
        taskId: input.runId,
        payload: incidentPayload(input.metric, incident),
      }),
    );
  }
  if (mode === 'shadow' && hardOpened.length > 0) {
    const primary = pickPrimary(hardOpened);
    if (primary) {
      entries.push(
        auditEntry({
          eventType: 'budget:would_deny',
          severity: 'info',
          accountId: input.accountId,
          agentId,
          sessionId: input.sessionId,
          taskId: input.runId,
          payload: incidentPayload(input.metric, primary, { reason: 'budget_hard_stop' }),
        }),
      );
    }
  }
  await writeAudits(audit, entries);
  return {
    mode,
    applied: applied.policyCount > 0,
    wouldPause,
    incidentsOpened: opened,
  };
}

/** Human resume. The next reserve re-opens a hard stop if the limit still binds. */
export async function resolveBudgetIncident(
  db: BudgetDb,
  input: ResolveBudgetIncidentInput,
  audit?: BudgetAuditWriter,
): Promise<ResolveBudgetIncidentResult> {
  assertAccount(input.accountId);
  if (!RESOLUTION_SET.has(input.resolution)) {
    throw new Error('budget resolution is invalid');
  }
  if (input.actorUserId.length === 0) throw new Error('budget actorUserId is required');
  const result = await db.execute(sql`
    UPDATE budget_incidents
       SET status = 'resolved',
           resolution = ${input.resolution}::text,
           resolved_by_user_id = ${input.actorUserId}::text,
           resolved_at = now()
     WHERE id = ${input.incidentId}::text
       AND account_id = ${input.accountId}::text
       AND status = 'open'
    RETURNING id, policy_id, scope_type, scope_id, window_start, threshold_type,
              amount_limit, amount_observed
  `);
  const rows = extractRows(result);
  const row = rows[0];
  if (!row) return { resolved: false, incidentId: input.incidentId };
  if (audit) {
    const windowValue = row.window_start ?? row.windowStart;
    await audit.append(
      auditEntry({
        eventType: 'budget:incident:resolved',
        severity: 'info',
        accountId: input.accountId,
        agentId: input.actorUserId,
        payload: {
          incidentId: input.incidentId,
          resolution: input.resolution,
          actorUserId: input.actorUserId,
          policyId: asText(row.policy_id ?? row.policyId),
          scopeType: asText(row.scope_type ?? row.scopeType),
          scopeId: asText(row.scope_id ?? row.scopeId),
          windowStart: isoWindow(windowValue),
          thresholdType: asText(row.threshold_type ?? row.thresholdType),
        },
      }),
    );
  }
  return { resolved: true, incidentId: input.incidentId };
}
