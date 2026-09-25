/**
 * Server policy for the governed MCP approval gate.
 *
 * The factory calls this only after authorization and the rate limiter.
 * A low-trust or role deny therefore never reaches here, and this gate
 * cannot widen one. Rows are status changes only: nothing in this module
 * deletes an approval.
 *
 * `off` (default) returns allow without reading the database.
 * `shadow` records would-require or would-deny and lets the call through.
 * `enforce` pauses eligible tools the account has switched to require.
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { classifyAuditWriteFailure, recordAuditWriteResult } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { mcpApprovalSettings, mcpToolApprovals, mcpToolTrustRules } from '@revealui/db/schema';
import { hashMcpArguments, hashMcpCallDigest } from '@revealui/mcp/approvals';
import type {
  McpToolApprovalGate,
  McpToolCallContext,
} from '@revealui/mcp/revealui-content-factory';
import { redactLogContext } from '@revealui/security';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { createAuditStore } from './audit-signer.js';
import { currentMcpApprovalsMode, type McpApprovalsMode } from './mcp-approvals-mode.js';
import { mcpToolApprovalEligibility } from './mcp-tool-access.js';

export interface McpApprovalGateConfig {
  /** How long a pending approval stays decidable. Default: 30 minutes. */
  pendingTtlMs: number;
  /** Max JSON bytes stored in args_preview. Larger previews become a truncation flag. */
  maxPreviewBytes: number;
}

const DEFAULT_GATE_CONFIG: McpApprovalGateConfig = {
  pendingTtlMs: 30 * 60 * 1000,
  maxPreviewBytes: 4_096,
};

let gateConfig: McpApprovalGateConfig = { ...DEFAULT_GATE_CONFIG };

export function configureMcpApprovalGate(overrides: Partial<McpApprovalGateConfig> | null): void {
  gateConfig = overrides ? { ...DEFAULT_GATE_CONFIG, ...overrides } : { ...DEFAULT_GATE_CONFIG };
}

export interface McpApprovalAuditWrite {
  eventType: string;
  severity: 'info' | 'warn';
  accountId: string;
  clientName: string;
  sessionId?: string;
  requesterUserId: string;
  tool: string;
  argsHash: string;
  toolSchemaHash: string;
  callDigest: string;
  approvalId?: string;
  expiresAt?: string;
  viaTrustRuleId?: string;
  reason?: string;
  trustRuleId?: string;
  oldSchemaHash?: string;
  newSchemaHash?: string;
}

export interface McpApprovalGateDeps {
  db?: Database;
  appendAudit?: (input: McpApprovalAuditWrite) => Promise<void>;
}

interface ReadyPrincipal {
  accountId: string;
  requesterUserId: string;
}

interface GateCall {
  tool: string;
  args: unknown;
  argsHash: string;
  toolSchemaHash: string;
  approvalId?: string;
  clientName?: string;
}

const REASON_ARGS = 'approval_args_mismatch';
const REASON_SCHEMA = 'approval_schema_changed';
const REASON_EXPIRED = 'approval_expired';
const REASON_NOT_APPROVED = 'approval_not_approved';
const REASON_CONSUMED = 'approval_already_consumed';
const REASON_PRINCIPAL = 'approval_wrong_principal';
const REASON_INELIGIBLE = 'approval_ineligible';
const REASON_AUDIT = 'approval_audit_failed';
const REASON_UNHASHABLE = 'approval_args_unhashable';

function dbOf(deps: McpApprovalGateDeps): Database {
  return deps.db ?? getClient();
}

function readyPrincipal(ctx: McpToolCallContext): ReadyPrincipal | null {
  const info = ctx.authInfo as { extra?: Record<string, unknown> } | undefined;
  const extra = info?.extra;
  if (!extra) return null;
  const userId = extra.userId;
  const accountId = extra.accountId;
  if (typeof userId !== 'string' || userId.trim().length === 0) return null;
  if (typeof accountId !== 'string' || accountId.trim().length === 0) return null;
  return { accountId, requesterUserId: userId };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function previewArgs(args: unknown): Record<string, unknown> {
  const redacted = redactLogContext(args ?? {});
  let record: Record<string, unknown>;
  if (isPlainRecord(redacted)) {
    record = redacted;
  } else if (Array.isArray(redacted)) {
    record = { items: redacted };
  } else if (redacted === undefined || redacted === null) {
    record = {};
  } else {
    record = { value: redacted };
  }
  const encoded = JSON.stringify(record);
  if (encoded.length > gateConfig.maxPreviewBytes) return { truncated: true };
  return record;
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result.filter(isPlainRecord);
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) return rows.filter(isPlainRecord);
  }
  return [];
}

function firstString(row: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = row?.[key];
  return typeof value === 'string' ? value : undefined;
}

function timeMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function writeAudit(deps: McpApprovalGateDeps, input: McpApprovalAuditWrite): Promise<void> {
  if (deps.appendAudit) {
    await deps.appendAudit(input);
    return;
  }
  const id = randomUUID();
  const payload: Record<string, unknown> = {
    tool: input.tool,
    argsHash: input.argsHash,
    toolSchemaHash: input.toolSchemaHash,
    callDigest: input.callDigest,
    requesterUserId: input.requesterUserId,
  };
  if (input.approvalId !== undefined) payload.approvalId = input.approvalId;
  if (input.expiresAt !== undefined) payload.expiresAt = input.expiresAt;
  if (input.viaTrustRuleId !== undefined) payload.viaTrustRuleId = input.viaTrustRuleId;
  if (input.reason !== undefined) payload.reason = input.reason;
  if (input.trustRuleId !== undefined) payload.trustRuleId = input.trustRuleId;
  if (input.oldSchemaHash !== undefined) payload.oldSchemaHash = input.oldSchemaHash;
  if (input.newSchemaHash !== undefined) payload.newSchemaHash = input.newSchemaHash;

  try {
    await createAuditStore(dbOf(deps)).append({
      id,
      timestamp: new Date(),
      eventType: input.eventType,
      severity: input.severity,
      agentId: `mcp:${input.clientName}`,
      sessionId: input.sessionId,
      payload,
      policyViolations: input.reason ? [input.reason] : [],
      tenant: input.accountId,
    });
    recordAuditWriteResult({ ok: true, eventId: id, eventType: input.eventType });
  } catch (err) {
    recordAuditWriteResult({
      ok: false,
      reason: classifyAuditWriteFailure(err),
      eventId: id,
      eventType: input.eventType,
    });
    throw err;
  }
}

async function accountRequiresTool(
  db: Database,
  accountId: string,
  tool: string,
): Promise<boolean> {
  const [settings] = await db
    .select({ requireTools: mcpApprovalSettings.requireTools })
    .from(mcpApprovalSettings)
    .where(eq(mcpApprovalSettings.accountId, accountId))
    .limit(1);
  const required = settings?.requireTools;
  if (!Array.isArray(required)) return false;
  return required.some((entry) => entry === tool);
}

async function matchingTrustRuleId(
  db: Database,
  principal: ReadyPrincipal,
  call: GateCall,
): Promise<string | undefined> {
  const now = new Date();
  const [rule] = await db
    .select({ id: mcpToolTrustRules.id })
    .from(mcpToolTrustRules)
    .where(
      and(
        eq(mcpToolTrustRules.accountId, principal.accountId),
        eq(mcpToolTrustRules.requesterUserId, principal.requesterUserId),
        eq(mcpToolTrustRules.tool, call.tool),
        eq(mcpToolTrustRules.argsHash, call.argsHash),
        eq(mcpToolTrustRules.toolSchemaHash, call.toolSchemaHash),
        isNull(mcpToolTrustRules.revokedAt),
        isNull(mcpToolTrustRules.lapsedAt),
        or(isNull(mcpToolTrustRules.expiresAt), gt(mcpToolTrustRules.expiresAt, now)),
        or(
          isNull(mcpToolTrustRules.maxUses),
          sql`${mcpToolTrustRules.uses} < ${mcpToolTrustRules.maxUses}`,
        ),
      ),
    )
    .limit(1);
  return rule?.id;
}

async function consumeTrustRule(
  db: Database,
  principal: ReadyPrincipal,
  call: GateCall,
): Promise<string | undefined> {
  const result = await db.execute(sql`
    UPDATE mcp_tool_trust_rules
       SET uses = uses + 1
     WHERE account_id = ${principal.accountId}
       AND requester_user_id = ${principal.requesterUserId}
       AND tool = ${call.tool}
       AND args_hash = ${call.argsHash}
       AND tool_schema_hash = ${call.toolSchemaHash}
       AND revoked_at IS NULL
       AND lapsed_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
       AND (max_uses IS NULL OR uses < max_uses)
    RETURNING id
  `);
  return firstString(extractRows(result)[0], 'id');
}

async function lapseStaleTrustRules(
  deps: McpApprovalGateDeps,
  principal: ReadyPrincipal,
  call: GateCall,
  auditBase: McpApprovalAuditWrite,
): Promise<'ok' | 'audit_failed'> {
  const db = dbOf(deps);
  const result = await db.execute(sql`
    UPDATE mcp_tool_trust_rules
       SET lapsed_at = now()
     WHERE account_id = ${principal.accountId}
       AND requester_user_id = ${principal.requesterUserId}
       AND tool = ${call.tool}
       AND args_hash = ${call.argsHash}
       AND tool_schema_hash <> ${call.toolSchemaHash}
       AND revoked_at IS NULL
       AND lapsed_at IS NULL
    RETURNING id, tool_schema_hash
  `);
  for (const row of extractRows(result)) {
    const trustRuleId = firstString(row, 'id');
    const oldSchemaHash =
      firstString(row, 'tool_schema_hash') ?? firstString(row, 'toolSchemaHash');
    if (!(trustRuleId && oldSchemaHash)) continue;
    try {
      await writeAudit(deps, {
        ...auditBase,
        eventType: 'mcp:trust_rule:lapsed',
        severity: 'warn',
        trustRuleId,
        oldSchemaHash,
        newSchemaHash: call.toolSchemaHash,
      });
    } catch (err) {
      logger.warn('mcp trust rule lapse audit failed', {
        tool: call.tool,
        trustRuleId,
        message: err instanceof Error ? err.message : 'unknown',
      });
      return 'audit_failed';
    }
  }
  return 'ok';
}

function diagnose(
  row: typeof mcpToolApprovals.$inferSelect | undefined,
  call: GateCall,
  principal: ReadyPrincipal,
): string {
  if (!row || row.requesterUserId !== principal.requesterUserId) return REASON_PRINCIPAL;
  if (row.argsHash !== call.argsHash) return REASON_ARGS;
  if (row.toolSchemaHash !== call.toolSchemaHash) return REASON_SCHEMA;
  if (row.status === 'consumed') return REASON_CONSUMED;
  if (row.status === 'expired') return REASON_EXPIRED;
  if (row.status !== 'approved') {
    const expires = timeMs(row.expiresAt);
    if (expires !== null && expires <= Date.now()) return REASON_EXPIRED;
    return REASON_NOT_APPROVED;
  }
  const consumeBy = timeMs(row.consumeBy);
  if (consumeBy === null || consumeBy <= Date.now()) return REASON_EXPIRED;
  return REASON_ARGS;
}

async function refusalReason(
  db: Database,
  principal: ReadyPrincipal,
  call: GateCall,
  approvalId: string,
): Promise<string> {
  const [row] = await db
    .select()
    .from(mcpToolApprovals)
    .where(
      and(eq(mcpToolApprovals.id, approvalId), eq(mcpToolApprovals.accountId, principal.accountId)),
    )
    .limit(1);
  return diagnose(row, call, principal);
}

async function consumeApproval(
  deps: McpApprovalGateDeps,
  principal: ReadyPrincipal,
  call: GateCall,
  approvalId: string,
  callDigest: string,
  auditBase: McpApprovalAuditWrite,
): Promise<{ decision: 'allow' } | { decision: 'deny'; reason: string }> {
  const db = dbOf(deps);
  const result = await db.execute(sql`
    UPDATE mcp_tool_approvals
       SET status = 'consumed', consumed_at = now()
     WHERE id = ${approvalId}
       AND account_id = ${principal.accountId}
       AND requester_user_id = ${principal.requesterUserId}
       AND status = 'approved'
       AND call_digest = ${callDigest}
       AND consume_by > now()
    RETURNING id
  `);
  const consumedId = firstString(extractRows(result)[0], 'id');
  if (!consumedId) {
    return {
      decision: 'deny',
      reason: await refusalReason(db, principal, call, approvalId),
    };
  }
  try {
    await writeAudit(deps, {
      ...auditBase,
      eventType: 'mcp:approval:consumed',
      severity: 'info',
      approvalId: consumedId,
    });
  } catch (err) {
    logger.warn('mcp approval consumed audit failed', {
      tool: call.tool,
      approvalId: consumedId,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return { decision: 'deny', reason: REASON_AUDIT };
  }
  return { decision: 'allow' };
}

async function requestApproval(
  deps: McpApprovalGateDeps,
  ctx: McpToolCallContext,
  principal: ReadyPrincipal,
  call: GateCall,
  callDigest: string,
  auditBase: McpApprovalAuditWrite,
): Promise<
  | { decision: 'approval_required'; approvalId: string; expiresAt: string }
  | { decision: 'deny'; reason: string }
> {
  const db = dbOf(deps);
  const approvalId = randomUUID();
  const expiresAt = new Date(Date.now() + gateConfig.pendingTtlMs);
  await db.insert(mcpToolApprovals).values({
    id: approvalId,
    accountId: principal.accountId,
    requesterUserId: principal.requesterUserId,
    clientName: auditBase.clientName,
    mcpSessionId: ctx.sessionId,
    tool: call.tool,
    argsHash: call.argsHash,
    toolSchemaHash: call.toolSchemaHash,
    callDigest,
    argsPreview: previewArgs(call.args),
    status: 'pending',
    expiresAt,
  });
  const expiresAtIso = expiresAt.toISOString();
  try {
    await writeAudit(deps, {
      ...auditBase,
      eventType: 'mcp:approval:requested',
      severity: 'info',
      approvalId,
      expiresAt: expiresAtIso,
    });
  } catch (err) {
    logger.warn('mcp approval requested audit failed', {
      tool: call.tool,
      approvalId,
      message: err instanceof Error ? err.message : 'unknown',
    });
    await db.execute(sql`
      UPDATE mcp_tool_approvals
         SET status = 'expired'
       WHERE id = ${approvalId}
         AND account_id = ${principal.accountId}
         AND status = 'pending'
    `);
    return { decision: 'deny', reason: REASON_AUDIT };
  }
  return { decision: 'approval_required', approvalId, expiresAt: expiresAtIso };
}

function auditBaseFor(
  ctx: McpToolCallContext,
  principal: ReadyPrincipal,
  call: GateCall,
  callDigest: string,
): McpApprovalAuditWrite {
  return {
    eventType: 'mcp:approval:requested',
    severity: 'info',
    accountId: principal.accountId,
    clientName: call.clientName?.trim() ? call.clientName : 'unknown',
    sessionId: ctx.sessionId,
    requesterUserId: principal.requesterUserId,
    tool: call.tool,
    argsHash: call.argsHash,
    toolSchemaHash: call.toolSchemaHash,
    callDigest,
  };
}

async function evaluate(
  deps: McpApprovalGateDeps,
  ctx: McpToolCallContext,
  input: GateCall,
  mode: Exclude<McpApprovalsMode, 'off'>,
): Promise<
  | { decision: 'allow' }
  | { decision: 'deny'; reason: string }
  | { decision: 'approval_required'; approvalId: string; expiresAt: string }
> {
  let argsHash: string;
  try {
    argsHash = hashMcpArguments(input.args ?? {});
  } catch {
    if (mode === 'shadow') {
      logger.info('mcp approval would deny', { tool: input.tool, reason: REASON_UNHASHABLE });
      return { decision: 'allow' };
    }
    return { decision: 'deny', reason: REASON_UNHASHABLE };
  }
  if (argsHash !== input.argsHash) {
    if (mode === 'shadow') {
      logger.info('mcp approval would deny', { tool: input.tool, reason: REASON_ARGS });
      return { decision: 'allow' };
    }
    return { decision: 'deny', reason: REASON_ARGS };
  }

  const principal = readyPrincipal(ctx);
  if (!principal) {
    if (mode === 'shadow') {
      logger.info('mcp approval would deny', { tool: input.tool, reason: REASON_INELIGIBLE });
      return { decision: 'allow' };
    }
    return { decision: 'deny', reason: REASON_INELIGIBLE };
  }

  const db = dbOf(deps);
  const required = await accountRequiresTool(db, principal.accountId, input.tool);
  if (!required) return { decision: 'allow' };

  const call: GateCall = { ...input, argsHash };
  const callDigest = hashMcpCallDigest({
    tool: call.tool,
    argsHash: call.argsHash,
    toolSchemaHash: call.toolSchemaHash,
    accountId: principal.accountId,
    requesterUserId: principal.requesterUserId,
  });
  const base = auditBaseFor(ctx, principal, call, callDigest);

  if (mode === 'shadow') {
    if (call.approvalId) {
      const consumed = await db
        .select({ id: mcpToolApprovals.id })
        .from(mcpToolApprovals)
        .where(
          and(
            eq(mcpToolApprovals.id, call.approvalId),
            eq(mcpToolApprovals.accountId, principal.accountId),
            eq(mcpToolApprovals.requesterUserId, principal.requesterUserId),
            eq(mcpToolApprovals.status, 'approved'),
            eq(mcpToolApprovals.callDigest, callDigest),
            gt(mcpToolApprovals.consumeBy, new Date()),
          ),
        )
        .limit(1);
      if (consumed.length === 0) {
        const reason = await refusalReason(db, principal, call, call.approvalId);
        try {
          await writeAudit(deps, {
            ...base,
            eventType: 'mcp:approval:would_deny',
            severity: 'info',
            approvalId: call.approvalId,
            reason,
          });
        } catch (err) {
          logger.warn('mcp approval would-deny audit failed', {
            tool: call.tool,
            message: err instanceof Error ? err.message : 'unknown',
          });
        }
        logger.info('mcp approval would deny', {
          tool: call.tool,
          reason,
          approvalId: call.approvalId,
        });
      }
      return { decision: 'allow' };
    }

    const ruleId = await matchingTrustRuleId(db, principal, call);
    if (ruleId) return { decision: 'allow' };

    try {
      await writeAudit(deps, {
        ...base,
        eventType: 'mcp:approval:would_require',
        severity: 'info',
      });
    } catch (err) {
      logger.warn('mcp approval would-require audit failed', {
        tool: call.tool,
        message: err instanceof Error ? err.message : 'unknown',
      });
    }
    logger.info('mcp approval would require', {
      tool: call.tool,
      argsHash: call.argsHash,
      accountId: principal.accountId,
    });
    return { decision: 'allow' };
  }

  if (call.approvalId) {
    return consumeApproval(deps, principal, call, call.approvalId, callDigest, base);
  }

  const trustRuleId = await consumeTrustRule(db, principal, call);
  if (trustRuleId) {
    try {
      await writeAudit(deps, {
        ...base,
        eventType: 'mcp:approval:consumed',
        severity: 'info',
        viaTrustRuleId: trustRuleId,
      });
    } catch (err) {
      logger.warn('mcp trust rule consume audit failed', {
        tool: call.tool,
        trustRuleId,
        message: err instanceof Error ? err.message : 'unknown',
      });
      return { decision: 'deny', reason: REASON_AUDIT };
    }
    return { decision: 'allow' };
  }

  const lapsed = await lapseStaleTrustRules(deps, principal, call, base);
  if (lapsed === 'audit_failed') return { decision: 'deny', reason: REASON_AUDIT };

  return requestApproval(deps, ctx, principal, call, callDigest, base);
}

/**
 * Approval gate for `createRevealuiContentServer`.
 * Call it only after the tool authorizer (role, tier, low-trust) and the rate limiter.
 */
export function createMcpApprovalGate(deps: McpApprovalGateDeps = {}): McpToolApprovalGate {
  return async (ctx, input) => {
    const mode = currentMcpApprovalsMode();
    if (mode === 'off') return { decision: 'allow' };
    if (mcpToolApprovalEligibility(input.tool) !== 'eligible') return { decision: 'allow' };
    try {
      return await evaluate(deps, ctx, input, mode);
    } catch (err) {
      logger.warn('mcp approval gate failed', {
        tool: input.tool,
        message: err instanceof Error ? err.message : 'unknown',
      });
      if (mode === 'shadow') return { decision: 'allow' };
      return { decision: 'deny', reason: 'approval_gate_failed' };
    }
  };
}
