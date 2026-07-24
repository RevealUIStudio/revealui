/**
 * Agent principal (GAP-355 Stage 6 S6-1).
 *
 * A server-derived identity for an in-process agent run. Resolved once at run
 * start and threaded into tool factories / authorize adapters (S6-2+). Never
 * trusted from client tool arguments.
 *
 * Stage 5 receipts record what happened; Stage 6 principals decide what may
 * happen. This module is types + pure resolvers only — no HTTP wiring yet.
 *
 * @see .jv/docs/gap-specs/GAP-355-stage6-govern-agents-design.md §4.1
 */

/** How the agent run was started. */
export type AgentPrincipalKind = 'stream' | 'dispatch' | 'mcp-bound' | 'job';

/** Optional explicit grant (AGENT mode / future scope grants). */
export interface AgentGrant {
  resource: string;
  action: string;
}

/**
 * Server-derived agent identity for RBAC evaluation.
 *
 * Owner countersign (2026-07-24): admin tools use **agent grants ∩ user
 * permissions** — `roles` therefore includes both the acting human role and
 * the `agent` role when known.
 */
export interface AgentPrincipal {
  /** Stable id for audit rows (e.g. coding-stream-agent, ticket-agent-<id>). */
  agentId: string;
  kind: AgentPrincipalKind;
  tenantId: string | null;
  accountId: string | null;
  /** Human who initiated or owns the run; null for unattended jobs when unknown. */
  actingUserId: string | null;
  /**
   * Roles for RBAC. Deduped. In-process agents always include `agent` when a
   * human role is present so policy matrices can key off either.
   */
  roles: readonly string[];
  /** Explicit grants; empty means role-only evaluation (default). */
  grants: readonly AgentGrant[];
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

function uniqueRoles(roles: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of roles) {
    if (!r) continue;
    const trimmed = r.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function freezePrincipal(principal: AgentPrincipal): AgentPrincipal {
  return Object.freeze({
    ...principal,
    roles: Object.freeze([...principal.roles]),
    grants: Object.freeze(principal.grants.map((g) => Object.freeze({ ...g }))),
  });
}

/**
 * Roles used for agent-side RBAC (copy of principal.roles).
 */
export function principalRoleList(principal: AgentPrincipal): string[] {
  return [...principal.roles];
}

/**
 * True when the principal carries an explicit grant for resource+action.
 * Empty grants ⇒ false (role-only mode; S6-2 authorize uses roles).
 */
export function principalHasGrant(
  principal: AgentPrincipal,
  resource: string,
  action: string,
): boolean {
  return principal.grants.some((g) => g.resource === resource && g.action === action);
}

// ─── Resolvers (one per kind) ───────────────────────────────────────────────

export interface ResolveStreamPrincipalInput {
  /** agent-stream body.mode */
  mode: 'admin' | 'coding';
  userId: string;
  /** Session user role from auth (e.g. owner, admin, editor). */
  userRole: string;
  tenantId?: string | null;
  accountId?: string | null;
  grants?: readonly AgentGrant[];
}

/**
 * Principal for POST /api/agent-stream (admin or coding mode).
 */
export function resolveStreamPrincipal(input: ResolveStreamPrincipalInput): AgentPrincipal {
  if (!input.userId.trim()) {
    throw new Error('resolveStreamPrincipal: userId is required');
  }
  const agentId = input.mode === 'coding' ? 'coding-stream-agent' : 'admin-stream-agent';
  return freezePrincipal({
    agentId,
    kind: 'stream',
    tenantId: input.tenantId ?? null,
    accountId: input.accountId ?? null,
    actingUserId: input.userId,
    roles: uniqueRoles([input.userRole, 'agent']),
    grants: input.grants ? [...input.grants] : [],
  });
}

export interface ResolveDispatchPrincipalInput {
  /** Ticket id when known (scopes agentId for audit correlation). */
  ticketId?: string | null;
  userId: string | null;
  userRole?: string | null;
  /** Workspace / board tenant when known. */
  workspaceId?: string | null;
  accountId?: string | null;
  grants?: readonly AgentGrant[];
}

/**
 * Principal for TicketAgentDispatcher / sync dispatch paths.
 * agentId matches Stage 5 audit convention when ticketId is set.
 */
export function resolveDispatchPrincipal(input: ResolveDispatchPrincipalInput): AgentPrincipal {
  const ticketId = input.ticketId?.trim();
  const agentId = ticketId ? `ticket-agent-${ticketId}` : 'ticket-agent-dispatcher';
  return freezePrincipal({
    agentId,
    kind: 'dispatch',
    tenantId: input.workspaceId ?? null,
    accountId: input.accountId ?? null,
    actingUserId: input.userId,
    roles: uniqueRoles([input.userRole, 'agent']),
    grants: input.grants ? [...input.grants] : [],
  });
}

export interface ResolveJobPrincipalInput {
  agentId: string;
  userId?: string | null;
  userRole?: string | null;
  tenantId?: string | null;
  accountId?: string | null;
  grants?: readonly AgentGrant[];
}

/**
 * Principal for durable job workers (e.g. agent-dispatch queue).
 */
export function resolveJobPrincipal(input: ResolveJobPrincipalInput): AgentPrincipal {
  if (!input.agentId.trim()) {
    throw new Error('resolveJobPrincipal: agentId is required');
  }
  return freezePrincipal({
    agentId: input.agentId.trim(),
    kind: 'job',
    tenantId: input.tenantId ?? null,
    accountId: input.accountId ?? null,
    actingUserId: input.userId ?? null,
    roles: uniqueRoles([input.userRole, 'agent']),
    grants: input.grants ? [...input.grants] : [],
  });
}

export interface ResolveMcpBoundPrincipalInput {
  /** MCP client name from handshake (becomes agentId prefix). */
  clientName: string;
  userId: string;
  userRole: string;
  tenantId?: string | null;
  accountId?: string | null;
  grants?: readonly AgentGrant[];
}

/**
 * Principal for a bearer-bound MCP client acting as a governed user/agent.
 * Complements mcp-tool-access (which already gates by role+tier).
 */
export function resolveMcpBoundPrincipal(input: ResolveMcpBoundPrincipalInput): AgentPrincipal {
  if (!input.userId.trim()) {
    throw new Error('resolveMcpBoundPrincipal: userId is required');
  }
  const client = input.clientName.trim() || 'unknown';
  return freezePrincipal({
    agentId: `mcp:${client}`,
    kind: 'mcp-bound',
    tenantId: input.tenantId ?? null,
    accountId: input.accountId ?? null,
    actingUserId: input.userId,
    roles: uniqueRoles([input.userRole, 'agent']),
    grants: input.grants ? [...input.grants] : [],
  });
}
