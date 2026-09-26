/**
 * Governed MCP approval routes, mounted as siblings of the exact `/api/mcp` path.
 *
 *   GET  /api/mcp/approvals?status=pending
 *   GET  /api/mcp/approvals/:id
 *   POST /api/mcp/approvals/:id/decide
 *   GET  /api/mcp/approval-settings
 *   PUT  /api/mcp/approval-settings
 *
 * A decider is a session-authenticated human with owner or admin on the account.
 * The requester cannot decide their own request. An agent principal cannot decide.
 * An `rvui_dev_` device token cannot decide. Free plans cannot change settings.
 * Decide writes the audit row first, then one conditional status update. If the
 * audit write throws, the row stays pending.
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { classifyAuditWriteFailure, recordAuditWriteResult } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { type McpToolApproval, mcpApprovalSettings, mcpToolApprovals } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, desc, eq, gt, ne, or, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createAuditStore } from '../lib/audit-signer.js';
import { MCP_APPROVAL_ELIGIBLE_TOOLS } from '../lib/mcp-tool-access.js';

const APPROVAL_STATUSES = ['pending', 'approved', 'denied', 'consumed', 'expired'] as const;
const DECISION_VERDICTS = ['approved', 'denied'] as const;
const ACCOUNT_DECIDER_ROLES: ReadonlySet<string> = new Set(['owner', 'admin']);
const SETTINGS_TIERS: ReadonlySet<string> = new Set(['pro', 'max', 'enterprise']);

export interface McpApprovalRouteConfig {
  /** How long an approved row stays consumable. Default: 5 minutes. */
  consumeTtlMs: number;
  /** Max rows returned by the list route. Default: 100. */
  maxList: number;
  /** Max characters stored for a decision note. Default: 500. */
  maxNoteLength: number;
}

const DEFAULT_ROUTE_CONFIG: McpApprovalRouteConfig = {
  consumeTtlMs: 5 * 60 * 1000,
  maxList: 100,
  maxNoteLength: 500,
};

let routeConfig: McpApprovalRouteConfig = { ...DEFAULT_ROUTE_CONFIG };

export function configureMcpApprovalRoutes(
  overrides: Partial<McpApprovalRouteConfig> | null,
): void {
  routeConfig = overrides ? { ...DEFAULT_ROUTE_CONFIG, ...overrides } : { ...DEFAULT_ROUTE_CONFIG };
}

export interface McpApprovalDecisionAudit {
  verdict: 'approved' | 'denied';
  accountId: string;
  approvalId: string;
  tool: string;
  argsHash: string;
  toolSchemaHash: string;
  callDigest: string;
  requesterUserId: string;
  deciderUserId: string;
  clientName: string;
  sessionId?: string;
  consumeBy?: string;
  notePresent?: boolean;
}

export interface McpApprovalRouteDeps {
  db?: Database;
  appendAudit?: (input: McpApprovalDecisionAudit) => Promise<void>;
}

interface ApprovalUser {
  id: string;
  role: string;
}

interface ApprovalSession {
  deviceAuth?: boolean;
}

interface ApprovalEntitlements {
  accountId?: string | null;
  membershipRole?: string | null;
  tier?: string | null;
}

type ApprovalVariables = {
  user?: ApprovalUser;
  session?: ApprovalSession;
  entitlements?: ApprovalEntitlements;
};

type ApprovalContext = Context<{ Variables: ApprovalVariables }>;

interface Decider {
  userId: string;
  accountId: string;
  tier: string;
}

type AuthFailure = { ok: false; status: 401 | 403 | 409; error: string };
type AuthSuccess = { ok: true; decider: Decider };

const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const StatusSchema = z.enum(APPROVAL_STATUSES);
const VerdictSchema = z.enum(DECISION_VERDICTS);

const SummarySchema = z.object({
  id: z.string(),
  tool: z.string(),
  status: StatusSchema,
  requesterUserId: z.string(),
  requestedAt: z.string(),
  expiresAt: z.string(),
  decidedAt: z.string().nullable(),
  consumeBy: z.string().nullable(),
});

const DetailSchema = SummarySchema.extend({
  argsPreview: z.record(z.string(), z.unknown()),
  argsHash: z.string(),
  toolSchemaHash: z.string(),
  callDigest: z.string(),
  decidedByUserId: z.string().nullable(),
  decisionNote: z.string().nullable(),
  consumedAt: z.string().nullable(),
});

const DecideBodySchema = z.object({
  verdict: VerdictSchema,
  note: z.string().max(DEFAULT_ROUTE_CONFIG.maxNoteLength).optional(),
});

const DecideResponseSchema = z.object({
  success: z.literal(true),
  id: z.string(),
  status: VerdictSchema,
  consumeBy: z.string().nullable(),
});

const SettingsBodySchema = z.object({
  requireTools: z.array(z.string().min(1)).max(MCP_APPROVAL_ELIGIBLE_TOOLS.size),
});

const SettingsResponseSchema = z.object({
  requireTools: z.array(z.string()),
});

function dbOf(deps: McpApprovalRouteDeps): Database {
  return deps.db ?? getClient();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result.filter(isPlainRecord);
  if (isPlainRecord(result) && Array.isArray(result.rows)) {
    return result.rows.filter(isPlainRecord);
  }
  return [];
}

function timeMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isoRequired(value: Date | string): string {
  const rendered = iso(value);
  if (!rendered) {
    throw new Error('Approval timestamp is missing');
  }
  return rendered;
}

function previewOf(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {};
}

function toSummary(row: McpToolApproval) {
  return {
    id: row.id,
    tool: row.tool,
    status: row.status,
    requesterUserId: row.requesterUserId,
    requestedAt: isoRequired(row.requestedAt),
    expiresAt: isoRequired(row.expiresAt),
    decidedAt: iso(row.decidedAt),
    consumeBy: iso(row.consumeBy),
  };
}

function toDetail(row: McpToolApproval) {
  return {
    ...toSummary(row),
    argsPreview: previewOf(row.argsPreview),
    argsHash: row.argsHash,
    toolSchemaHash: row.toolSchemaHash,
    callDigest: row.callDigest,
    decidedByUserId: row.decidedByUserId,
    decisionNote: row.decisionNote,
    consumedAt: iso(row.consumedAt),
  };
}

function authorizeApprover(c: ApprovalContext): AuthSuccess | AuthFailure {
  const user = c.get('user');
  if (!user?.id) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  const session = c.get('session');
  if (!session) {
    return { ok: false, status: 403, error: 'Sign in with a session to review approvals' };
  }
  if (session.deviceAuth === true) {
    return {
      ok: false,
      status: 403,
      error: 'A device token cannot review approvals. Sign in with a session.',
    };
  }
  if (user.role === 'agent') {
    return { ok: false, status: 403, error: 'Agent principals cannot review approvals' };
  }
  const entitlements = c.get('entitlements');
  const accountId = entitlements?.accountId;
  if (!accountId) {
    return { ok: false, status: 409, error: 'Caller has no active account membership' };
  }
  const membershipRole = entitlements?.membershipRole;
  if (!(membershipRole && ACCOUNT_DECIDER_ROLES.has(membershipRole))) {
    return {
      ok: false,
      status: 403,
      error: 'Only an account owner or admin can review approvals',
    };
  }
  return {
    ok: true,
    decider: {
      userId: user.id,
      accountId,
      tier: entitlements?.tier ?? 'free',
    },
  };
}

function settingsTierError(tier: string): string | null {
  if (SETTINGS_TIERS.has(tier)) return null;
  if (tier === 'free') return 'Free plans cannot change approval settings';
  return 'Approval settings require a Pro plan';
}

function requireToolsError(tools: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool)) return 'requireTools lists a tool more than once';
    seen.add(tool);
    if (!MCP_APPROVAL_ELIGIBLE_TOOLS.has(tool)) {
      return 'requireTools includes a tool that cannot require approval';
    }
  }
  return null;
}

function normalizeNote(note: string | undefined): string | null {
  if (note === undefined) return null;
  const trimmed = note.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

async function writeDecisionAudit(
  deps: McpApprovalRouteDeps,
  input: McpApprovalDecisionAudit,
): Promise<void> {
  if (deps.appendAudit) {
    await deps.appendAudit(input);
    return;
  }
  const id = randomUUID();
  const eventType = input.verdict === 'approved' ? 'mcp:approval:approved' : 'mcp:approval:denied';
  const severity = input.verdict === 'approved' ? 'info' : 'warn';
  const payload: Record<string, unknown> = {
    approvalId: input.approvalId,
    tool: input.tool,
    argsHash: input.argsHash,
    toolSchemaHash: input.toolSchemaHash,
    callDigest: input.callDigest,
    requesterUserId: input.requesterUserId,
    deciderUserId: input.deciderUserId,
  };
  if (input.verdict === 'approved') {
    payload.consumeBy = input.consumeBy;
    payload.notePresent = input.notePresent === true;
  }
  try {
    await createAuditStore(dbOf(deps)).append({
      id,
      timestamp: new Date(),
      eventType,
      severity,
      agentId: `mcp:${input.clientName}`,
      sessionId: input.sessionId,
      payload,
      policyViolations: [],
      tenant: input.accountId,
    });
    recordAuditWriteResult({ ok: true, eventId: id, eventType });
  } catch (err) {
    recordAuditWriteResult({
      ok: false,
      reason: classifyAuditWriteFailure(err),
      eventId: id,
      eventType,
    });
    throw err;
  }
}

async function applyDecision(
  deps: McpApprovalRouteDeps,
  input: {
    id: string;
    accountId: string;
    deciderUserId: string;
    verdict: 'approved' | 'denied';
    note: string | null;
    consumeBy: Date;
  },
): Promise<boolean> {
  const db = dbOf(deps);
  if (input.verdict === 'approved') {
    // drizzle-raw: atomic conditional UPDATE RETURNING; Neon HTTP has no transactions
    const result = await db.execute(sql`
      UPDATE mcp_tool_approvals
         SET status = 'approved',
             decided_by_user_id = ${input.deciderUserId},
             decision_note = ${input.note},
             decided_at = now(),
             consume_by = ${input.consumeBy}
       WHERE id = ${input.id}
         AND account_id = ${input.accountId}
         AND status = 'pending'
         AND expires_at > now()
         AND requester_user_id <> ${input.deciderUserId}
      RETURNING id
    `);
    const updated = extractRows(result)[0]?.id;
    return updated === input.id;
  }
  // drizzle-raw: atomic conditional UPDATE RETURNING; Neon HTTP has no transactions
  const result = await db.execute(sql`
    UPDATE mcp_tool_approvals
       SET status = 'denied',
           decided_by_user_id = ${input.deciderUserId},
           decision_note = ${input.note},
           decided_at = now(),
           consume_by = NULL
     WHERE id = ${input.id}
       AND account_id = ${input.accountId}
       AND status = 'pending'
       AND expires_at > now()
       AND requester_user_id <> ${input.deciderUserId}
    RETURNING id
  `);
  const updated = extractRows(result)[0]?.id;
  return updated === input.id;
}

const listRoute = createRoute({
  method: 'get',
  path: '/approvals',
  tags: ['mcp'],
  summary: 'List governed MCP approvals for the caller account',
  request: {
    query: z.object({
      status: StatusSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: 'Approvals visible to this account',
      content: {
        'application/json': {
          schema: z.object({ approvals: z.array(SummarySchema) }),
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    403: {
      description: 'Caller cannot review approvals',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    409: {
      description: 'Caller has no account',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/approvals/:id',
  tags: ['mcp'],
  summary: 'Read one governed MCP approval',
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: {
      description: 'Approval detail with a redacted argument preview',
      content: { 'application/json': { schema: DetailSchema } },
    },
    401: {
      description: 'Authentication required',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    403: {
      description: 'Caller cannot review approvals',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'Approval not found',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    409: {
      description: 'Caller has no account',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

const decideRoute = createRoute({
  method: 'post',
  path: '/approvals/:id/decide',
  tags: ['mcp'],
  summary: 'Approve or deny a pending MCP approval',
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      content: { 'application/json': { schema: DecideBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Decision recorded',
      content: { 'application/json': { schema: DecideResponseSchema } },
    },
    401: {
      description: 'Authentication required',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    403: {
      description: 'Caller cannot decide this approval',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'Approval not found',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    409: {
      description: 'Approval is not a pending unexpired request',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    503: {
      description: 'Audit write failed, so the decision was refused',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

const getSettingsRoute = createRoute({
  method: 'get',
  path: '/approval-settings',
  tags: ['mcp'],
  summary: 'Read which eligible tools require approval',
  responses: {
    200: {
      description: 'Current requireTools list',
      content: { 'application/json': { schema: SettingsResponseSchema } },
    },
    401: {
      description: 'Authentication required',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    403: {
      description: 'Caller cannot review approval settings',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    409: {
      description: 'Caller has no account',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

const putSettingsRoute = createRoute({
  method: 'put',
  path: '/approval-settings',
  tags: ['mcp'],
  summary: 'Replace which eligible tools require approval',
  request: {
    body: {
      content: { 'application/json': { schema: SettingsBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Settings saved',
      content: { 'application/json': { schema: SettingsResponseSchema } },
    },
    400: {
      description: 'requireTools is not a set of eligible tools',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    401: {
      description: 'Authentication required',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    403: {
      description: 'Caller cannot change approval settings',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    409: {
      description: 'Caller has no account',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

function refuse(c: ApprovalContext, failureResult: AuthFailure): never {
  const body = { success: false as const, error: failureResult.error };
  const res =
    failureResult.status === 401
      ? c.json(body, 401)
      : failureResult.status === 403
        ? c.json(body, 403)
        : c.json(body, 409);
  throw new HTTPException(failureResult.status, { res });
}

export function createMcpApprovalRoutes(
  deps: McpApprovalRouteDeps = {},
): OpenAPIHono<{ Variables: ApprovalVariables }> {
  const app = new OpenAPIHono<{ Variables: ApprovalVariables }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({ success: false as const, error: 'Invalid request' }, 400);
      }
    },
  });

  app.openapi(listRoute, async (c) => {
    const auth = authorizeApprover(c);
    if (!auth.ok) refuse(c, auth);
    const status = c.req.valid('query').status;
    const now = new Date();
    const scope =
      status === 'pending'
        ? and(
            eq(mcpToolApprovals.accountId, auth.decider.accountId),
            eq(mcpToolApprovals.status, 'pending'),
            gt(mcpToolApprovals.expiresAt, now),
          )
        : status
          ? and(
              eq(mcpToolApprovals.accountId, auth.decider.accountId),
              eq(mcpToolApprovals.status, status),
            )
          : and(
              eq(mcpToolApprovals.accountId, auth.decider.accountId),
              or(ne(mcpToolApprovals.status, 'pending'), gt(mcpToolApprovals.expiresAt, now)),
            );
    const rows = await dbOf(deps)
      .select()
      .from(mcpToolApprovals)
      .where(scope)
      .orderBy(desc(mcpToolApprovals.requestedAt))
      .limit(routeConfig.maxList);
    return c.json({ approvals: rows.map(toSummary) }, 200);
  });

  app.openapi(detailRoute, async (c) => {
    const auth = authorizeApprover(c);
    if (!auth.ok) refuse(c, auth);
    const { id } = c.req.valid('param');
    const [row] = await dbOf(deps)
      .select()
      .from(mcpToolApprovals)
      .where(
        and(eq(mcpToolApprovals.id, id), eq(mcpToolApprovals.accountId, auth.decider.accountId)),
      )
      .limit(1);
    if (!row) {
      return c.json({ success: false as const, error: 'Approval not found' }, 404);
    }
    return c.json(toDetail(row), 200);
  });

  app.openapi(decideRoute, async (c) => {
    const auth = authorizeApprover(c);
    if (!auth.ok) refuse(c, auth);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const note = normalizeNote(body.note);
    const [row] = await dbOf(deps)
      .select()
      .from(mcpToolApprovals)
      .where(
        and(eq(mcpToolApprovals.id, id), eq(mcpToolApprovals.accountId, auth.decider.accountId)),
      )
      .limit(1);
    if (!row) {
      return c.json({ success: false as const, error: 'Approval not found' }, 404);
    }
    if (row.requesterUserId === auth.decider.userId) {
      return c.json({ success: false as const, error: 'You cannot decide your own approval' }, 403);
    }
    if (row.status !== 'pending') {
      return c.json({ success: false as const, error: 'Approval is not pending' }, 409);
    }
    const expiresMs = timeMs(row.expiresAt);
    if (expiresMs === null || expiresMs <= Date.now()) {
      return c.json({ success: false as const, error: 'Approval has expired' }, 409);
    }

    const consumeBy = new Date(Date.now() + routeConfig.consumeTtlMs);
    const clientName = row.clientName.trim().length > 0 ? row.clientName : 'unknown';
    const audit: McpApprovalDecisionAudit = {
      verdict: body.verdict,
      accountId: auth.decider.accountId,
      approvalId: row.id,
      tool: row.tool,
      argsHash: row.argsHash,
      toolSchemaHash: row.toolSchemaHash,
      callDigest: row.callDigest,
      requesterUserId: row.requesterUserId,
      deciderUserId: auth.decider.userId,
      clientName,
      sessionId: row.mcpSessionId ?? undefined,
    };
    if (body.verdict === 'approved') {
      audit.consumeBy = consumeBy.toISOString();
      audit.notePresent = note !== null;
    }
    try {
      await writeDecisionAudit(deps, audit);
    } catch (err) {
      logger.warn('mcp approval decision audit failed', {
        approvalId: row.id,
        message: err instanceof Error ? err.message : 'unknown',
      });
      return c.json({ success: false as const, error: 'Approval decision was not recorded' }, 503);
    }

    const updated = await applyDecision(deps, {
      id: row.id,
      accountId: auth.decider.accountId,
      deciderUserId: auth.decider.userId,
      verdict: body.verdict,
      note,
      consumeBy,
    });
    if (!updated) {
      return c.json({ success: false as const, error: 'Approval is no longer pending' }, 409);
    }
    return c.json(
      {
        success: true as const,
        id: row.id,
        status: body.verdict,
        consumeBy: body.verdict === 'approved' ? consumeBy.toISOString() : null,
      },
      200,
    );
  });

  app.openapi(getSettingsRoute, async (c) => {
    const auth = authorizeApprover(c);
    if (!auth.ok) refuse(c, auth);
    const [row] = await dbOf(deps)
      .select({ requireTools: mcpApprovalSettings.requireTools })
      .from(mcpApprovalSettings)
      .where(eq(mcpApprovalSettings.accountId, auth.decider.accountId))
      .limit(1);
    const requireTools = Array.isArray(row?.requireTools)
      ? row.requireTools.filter((tool): tool is string => typeof tool === 'string')
      : [];
    return c.json({ requireTools }, 200);
  });

  app.openapi(putSettingsRoute, async (c) => {
    const auth = authorizeApprover(c);
    if (!auth.ok) refuse(c, auth);
    const tierError = settingsTierError(auth.decider.tier);
    if (tierError) {
      return c.json({ success: false as const, error: tierError }, 403);
    }
    const tools = c.req.valid('json').requireTools;
    const toolError = requireToolsError(tools);
    if (toolError) {
      return c.json({ success: false as const, error: toolError }, 400);
    }
    const requireTools = [...tools];
    await dbOf(deps)
      .insert(mcpApprovalSettings)
      .values({
        accountId: auth.decider.accountId,
        requireTools,
        updatedByUserId: auth.decider.userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: mcpApprovalSettings.accountId,
        set: {
          requireTools,
          updatedByUserId: auth.decider.userId,
          updatedAt: new Date(),
        },
      });
    return c.json({ requireTools }, 200);
  });

  return app;
}

const mcpApprovalRoutes = createMcpApprovalRoutes();

export default mcpApprovalRoutes;
