/**
 * In-process agent tool authorization (GAP-355 Stage 6 S6-2).
 *
 * Deny-by-default policy for admin CMS + coding tools used by agent-stream /
 * dispatcher. Mirrors the shape of `mcp-tool-access.ts` (exact permission
 * keys + dedicated AuthorizationSystem instance) but targets
 * `agent:tool:<name>` resources and `AgentPrincipal` identities.
 *
 * Owner countersigns (2026-07-24):
 *  1. Admin tools: **agent role ∩ human role** must both allow the tool.
 *  2. Coding exec (shell_exec, git_ops, test_runner, lint_fix): **deny
 *     until explicit principal grant**.
 *  3. Soft-fail UX is S6-3's job; this module only returns allow/deny.
 *
 * MCP server tools (`mcp_*`) are NOT listed here — they are gated by the
 * remote server + governed MCP path; S6-3 skips this authorize for them.
 *
 * @see .jv/docs/gap-specs/GAP-355-stage6-govern-agents-design.md §4.3–4.5
 */

import { AuthorizationSystem } from '@revealui/core/security';
import type { AgentPrincipal } from './agent-principal.js';
import { principalHasGrant } from './agent-principal.js';

const EXECUTE_ACTION = 'execute';

/** Permission resource for one in-process agent tool. */
export function agentToolPermissionKey(toolName: string): string {
  return `agent:tool:${toolName}`;
}

export type AgentToolClass = 'read' | 'propose' | 'mutate' | 'exec' | 'admin-pii';
export type AgentToolSurface = 'admin' | 'coding';

export interface AgentToolMeta {
  name: string;
  surface: AgentToolSurface;
  class: AgentToolClass;
}

/** Catalog of known in-process tools (admin factory + coding package). */
export const AGENT_TOOL_CATALOG: readonly AgentToolMeta[] = [
  // Admin — collections
  { name: 'list_collections', surface: 'admin', class: 'read' },
  { name: 'find_documents', surface: 'admin', class: 'read' },
  { name: 'get_document', surface: 'admin', class: 'read' },
  { name: 'create_document', surface: 'admin', class: 'mutate' },
  { name: 'update_document', surface: 'admin', class: 'mutate' },
  { name: 'delete_document', surface: 'admin', class: 'mutate' },
  // Admin — globals
  { name: 'list_globals', surface: 'admin', class: 'read' },
  { name: 'get_global', surface: 'admin', class: 'read' },
  { name: 'update_global', surface: 'admin', class: 'mutate' },
  // Admin — media
  { name: 'list_media', surface: 'admin', class: 'read' },
  { name: 'get_media', surface: 'admin', class: 'read' },
  { name: 'upload_media', surface: 'admin', class: 'mutate' },
  { name: 'update_media', surface: 'admin', class: 'mutate' },
  { name: 'delete_media', surface: 'admin', class: 'mutate' },
  // Admin — users
  { name: 'get_current_user', surface: 'admin', class: 'read' },
  { name: 'list_users', surface: 'admin', class: 'admin-pii' },
  { name: 'create_user', surface: 'admin', class: 'admin-pii' },
  { name: 'update_user', surface: 'admin', class: 'admin-pii' },
  { name: 'delete_user', surface: 'admin', class: 'admin-pii' },
  // Ticket agent sidecars (S6-4 — TicketAgentDispatcher)
  { name: 'update_ticket_status', surface: 'admin', class: 'mutate' },
  { name: 'add_ticket_comment', surface: 'admin', class: 'mutate' },
  // Coding
  { name: 'file_read', surface: 'coding', class: 'read' },
  { name: 'file_glob', surface: 'coding', class: 'read' },
  { name: 'file_grep', surface: 'coding', class: 'read' },
  { name: 'project_context', surface: 'coding', class: 'read' },
  { name: 'file_write', surface: 'coding', class: 'mutate' },
  { name: 'file_edit', surface: 'coding', class: 'mutate' },
  { name: 'shell_exec', surface: 'coding', class: 'exec' },
  { name: 'git_ops', surface: 'coding', class: 'exec' },
  { name: 'test_runner', surface: 'coding', class: 'exec' },
  { name: 'lint_fix', surface: 'coding', class: 'exec' },
  // Dispatch extras (read-class; no shell)
  { name: 'web_scrape', surface: 'coding', class: 'read' },
  { name: 'document_summarize', surface: 'coding', class: 'read' },
] as const;

const TOOL_BY_NAME = new Map(AGENT_TOOL_CATALOG.map((t) => [t.name, t]));

export function getAgentToolMeta(toolName: string): AgentToolMeta | undefined {
  return TOOL_BY_NAME.get(toolName);
}

// ─── Role matrices (exact keys only; no globs) ──────────────────────────────

const ADMIN_READ = AGENT_TOOL_CATALOG.filter(
  (t) => t.surface === 'admin' && t.class === 'read',
).map((t) => t.name);

const ADMIN_MUTATE = AGENT_TOOL_CATALOG.filter(
  (t) => t.surface === 'admin' && t.class === 'mutate',
).map((t) => t.name);

const ADMIN_PII = AGENT_TOOL_CATALOG.filter(
  (t) => t.surface === 'admin' && t.class === 'admin-pii',
).map((t) => t.name);

const CODING_READ = AGENT_TOOL_CATALOG.filter(
  (t) => t.surface === 'coding' && t.class === 'read',
).map((t) => t.name);

const CODING_MUTATE = AGENT_TOOL_CATALOG.filter(
  (t) => t.surface === 'coding' && t.class === 'mutate',
).map((t) => t.name);

/** Exec tools are never role-granted; explicit principal.grants only. */
const CODING_EXEC = AGENT_TOOL_CATALOG.filter(
  (t) => t.surface === 'coding' && t.class === 'exec',
).map((t) => t.name);

/**
 * Per-role tool name grants (registered on the dedicated authz engine).
 * Exec tools intentionally absent from every role.
 */
const ROLE_TOOL_GRANTS: Record<string, readonly string[]> = {
  owner: [...ADMIN_READ, ...ADMIN_MUTATE, ...ADMIN_PII, ...CODING_READ, ...CODING_MUTATE],
  admin: [...ADMIN_READ, ...ADMIN_MUTATE, ...ADMIN_PII, ...CODING_READ, ...CODING_MUTATE],
  editor: [...ADMIN_READ, ...ADMIN_MUTATE, ...CODING_READ, ...CODING_MUTATE],
  contributor: [...ADMIN_READ, ...ADMIN_MUTATE, ...CODING_READ],
  viewer: [...ADMIN_READ, ...CODING_READ],
  // agent role: no admin-pii, no exec; mutate coding yes for paid stream agents
  agent: [...ADMIN_READ, ...ADMIN_MUTATE, ...CODING_READ, ...CODING_MUTATE],
};

const agentAuthz = new AuthorizationSystem();
for (const [roleId, tools] of Object.entries(ROLE_TOOL_GRANTS)) {
  agentAuthz.registerRole({
    id: roleId,
    name: roleId,
    permissions: tools.map((tool) => ({
      resource: agentToolPermissionKey(tool),
      action: EXECUTE_ACTION,
    })),
  });
}

// ─── Authorize ──────────────────────────────────────────────────────────────

export type AgentToolAuthzReason =
  | 'allowed'
  | 'explicit_grant'
  | 'unknown_tool'
  | 'exec_requires_grant'
  | 'agent_role_denied'
  | 'user_role_denied'
  | 'no_human_role';

export interface AgentToolAuthzResult {
  allowed: boolean;
  reason: AgentToolAuthzReason;
  /** `agent:tool:<name>` when the tool is catalogued. */
  permissionKey: string | null;
  class: AgentToolClass | null;
  surface: AgentToolSurface | null;
}

function roleAllows(roles: readonly string[], permissionKey: string): boolean {
  if (roles.length === 0) return false;
  return agentAuthz.hasPermission([...roles], permissionKey, EXECUTE_ACTION);
}

/**
 * Deny-by-default authorization for one in-process agent tool.
 *
 * Order:
 *  1. Unknown tool → deny
 *  2. Explicit principal grant → allow (covers exec + exceptions)
 *  3. Exec class without grant → deny
 *  4. Agent role must allow (via `agent` in principal.roles or other roles)
 *  5. Admin surface: human role (roles minus `agent`) must also allow (∩)
 */
export function authorizeAgentTool(
  principal: AgentPrincipal,
  toolName: string,
): AgentToolAuthzResult {
  const meta = getAgentToolMeta(toolName);
  if (!meta) {
    return {
      allowed: false,
      reason: 'unknown_tool',
      permissionKey: null,
      class: null,
      surface: null,
    };
  }

  const permissionKey = agentToolPermissionKey(toolName);

  if (principalHasGrant(principal, permissionKey, EXECUTE_ACTION)) {
    return {
      allowed: true,
      reason: 'explicit_grant',
      permissionKey,
      class: meta.class,
      surface: meta.surface,
    };
  }

  if (meta.class === 'exec') {
    return {
      allowed: false,
      reason: 'exec_requires_grant',
      permissionKey,
      class: meta.class,
      surface: meta.surface,
    };
  }

  // Agent-side of the matrix: evaluate with full principal.roles (includes agent).
  if (!roleAllows(principal.roles, permissionKey)) {
    return {
      allowed: false,
      reason: 'agent_role_denied',
      permissionKey,
      class: meta.class,
      surface: meta.surface,
    };
  }

  // Admin surface: ∩ with human role alone (owner countersign).
  if (meta.surface === 'admin') {
    const humanRoles = principal.roles.filter((r) => r !== 'agent');
    if (humanRoles.length === 0) {
      return {
        allowed: false,
        reason: 'no_human_role',
        permissionKey,
        class: meta.class,
        surface: meta.surface,
      };
    }
    if (!roleAllows(humanRoles, permissionKey)) {
      return {
        allowed: false,
        reason: 'user_role_denied',
        permissionKey,
        class: meta.class,
        surface: meta.surface,
      };
    }
  }

  return {
    allowed: true,
    reason: 'allowed',
    permissionKey,
    class: meta.class,
    surface: meta.surface,
  };
}

/** Test helper: known exec tool names. */
export function listExecToolNames(): readonly string[] {
  return CODING_EXEC;
}

/** Ticket Agent card skills: create / search / update tickets. No user PII. */
export const TICKET_AGENT_ADMIN_TOOLS: readonly string[] = [
  'list_collections',
  'find_documents',
  'get_document',
  'create_document',
  'update_document',
];

/** Creator scaffolds agents. No user-PII tools. */
export const CREATOR_AGENT_ADMIN_TOOLS: readonly string[] = [
  'list_collections',
  'find_documents',
  'get_document',
  'create_document',
  'update_document',
  'get_current_user',
];

/**
 * Allowlist for Watch live / agent-stream admin tools.
 * `undefined` means the full admin catalog (generic admin mode).
 */
export function adminToolIncludeForAgent(
  agentId: string | undefined,
): readonly string[] | undefined {
  if (agentId === 'revealui-ticket-agent') {
    return TICKET_AGENT_ADMIN_TOOLS;
  }
  if (agentId === 'revealui-creator') {
    return CREATOR_AGENT_ADMIN_TOOLS;
  }
  return undefined;
}
