/**
 * Governed-MCP tool authorization policy (GAP-371 Phase 2, §5.4).
 *
 * Two independent gates decide whether a bound user may execute a tool:
 *
 *  1. ROLE gate (RBAC) — deny-by-default per-tool permission keyed
 *     `mcp:tool:<name>` through the existing `AuthorizationSystem`. Keys are
 *     EXACT strings, so the engine's `pattern === resource` fast path matches
 *     and its glob→RegExp branch is never taken (fleet no-regex posture; the
 *     GAP-371 ground-truth anchor's caution about that matcher). PII/admin tools
 *     (`revealui_list_users`) are granted to owner/admin only.
 *  2. TIER gate — the pro-gated surface. Content reads are available on every
 *     tier that can reach `/api/mcp`; `revealui_list_users` requires pro+. The
 *     tier is SERVER-DERIVED from the account entitlement (I-9), never client
 *     input.
 *
 * A tool is authorized iff BOTH gates pass. Unknown tool or unknown role →
 * denied (deny-by-default). This module owns the product policy; the
 * `@revealui/mcp` factory owns the mechanism (filtering + gating + receipts).
 */

import { AuthorizationSystem } from '@revealui/core/security';

/** Server-derived account tier (mirrors `EntitlementContext['tier']`). */
export type McpTier = 'free' | 'pro' | 'max' | 'enterprise';

/** The governed tool surface (content reads + VES session propose tools). */
export const MCP_TOOL_NAMES = [
  'revealui_list_sites',
  'revealui_list_content',
  'revealui_get_content',
  'revealui_site_stats',
  'revealui_list_users',
  'revealui_session_list',
  'revealui_session_open',
  'revealui_session_get',
  'revealui_session_patch',
  'revealui_page_read',
  'kg_search',
  'kg_get_node',
  'kg_neighbors',
  'kg_path',
  'kg_at_time',
  'kg_context',
  'kg_add_episode',
] as const;
export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

const CONTENT_READ_TOOLS: readonly McpToolName[] = [
  'revealui_list_sites',
  'revealui_list_content',
  'revealui_get_content',
  'revealui_site_stats',
  'revealui_page_read',
];
/** VES session tools — agents may propose; humans publish outside MCP. */
const SESSION_PROPOSE_TOOLS: readonly McpToolName[] = [
  'revealui_session_list',
  'revealui_session_open',
  'revealui_session_get',
  'revealui_session_patch',
];
const ADMIN_TOOLS: readonly McpToolName[] = ['revealui_list_users'];
const KG_READ_TOOLS: readonly McpToolName[] = [
  'kg_search',
  'kg_get_node',
  'kg_neighbors',
  'kg_path',
  'kg_at_time',
  'kg_context',
];
const KG_WRITE_TOOLS: readonly McpToolName[] = ['kg_add_episode'];

const EXECUTE_ACTION = 'execute';

function toolPermissionKey(toolName: string): string {
  return `mcp:tool:${toolName}`;
}

/** Which tools each role may execute (RBAC grants). */
const ROLE_TOOL_GRANTS: Record<string, readonly McpToolName[]> = {
  owner: [
    ...CONTENT_READ_TOOLS,
    ...SESSION_PROPOSE_TOOLS,
    ...ADMIN_TOOLS,
    ...KG_READ_TOOLS,
    ...KG_WRITE_TOOLS,
  ],
  admin: [
    ...CONTENT_READ_TOOLS,
    ...SESSION_PROPOSE_TOOLS,
    ...ADMIN_TOOLS,
    ...KG_READ_TOOLS,
    ...KG_WRITE_TOOLS,
  ],
  editor: [...CONTENT_READ_TOOLS, ...SESSION_PROPOSE_TOOLS, ...KG_READ_TOOLS, ...KG_WRITE_TOOLS],
  viewer: [...CONTENT_READ_TOOLS, ...KG_READ_TOOLS],
  agent: [...CONTENT_READ_TOOLS, ...SESSION_PROPOSE_TOOLS, ...KG_READ_TOOLS, ...KG_WRITE_TOOLS],
  contributor: [
    ...CONTENT_READ_TOOLS,
    ...SESSION_PROPOSE_TOOLS,
    ...KG_READ_TOOLS,
    ...KG_WRITE_TOOLS,
  ],
};

/** Which tiers may see/execute each tool (tier gate). `list_users` is pro-gated. */
const ALL_TIERS: ReadonlySet<McpTier> = new Set<McpTier>(['free', 'pro', 'max', 'enterprise']);
const PAID_TIERS: ReadonlySet<McpTier> = new Set<McpTier>(['pro', 'max', 'enterprise']);
const TOOL_TIER_GATE: Record<McpToolName, ReadonlySet<McpTier>> = {
  revealui_list_sites: ALL_TIERS,
  revealui_list_content: ALL_TIERS,
  revealui_get_content: ALL_TIERS,
  revealui_site_stats: ALL_TIERS,
  revealui_list_users: PAID_TIERS,
  revealui_session_list: ALL_TIERS,
  revealui_session_open: ALL_TIERS,
  revealui_session_get: ALL_TIERS,
  revealui_session_patch: ALL_TIERS,
  revealui_page_read: ALL_TIERS,
  kg_search: ALL_TIERS,
  kg_get_node: ALL_TIERS,
  kg_neighbors: ALL_TIERS,
  kg_path: ALL_TIERS,
  kg_at_time: ALL_TIERS,
  kg_context: ALL_TIERS,
  kg_add_episode: ALL_TIERS,
};

// A dedicated engine instance registered with the exact tool-permission keys.
// Not the global `authorization` singleton: registration state there is not
// guaranteed, and a security control must be deterministic and self-contained.
const mcpAuthz = new AuthorizationSystem();
for (const [roleId, tools] of Object.entries(ROLE_TOOL_GRANTS)) {
  mcpAuthz.registerRole({
    id: roleId,
    name: roleId,
    permissions: tools.map((tool) => ({
      resource: toolPermissionKey(tool),
      action: EXECUTE_ACTION,
    })),
  });
}

/** The verified, server-derived identity the authz decision is made against. */
export interface McpAuthzIdentity {
  /** The user's role from the DB (`users.role`), resolved via the bearer token. */
  role: string;
  /** The account's effective tier from the entitlement record (I-9). */
  tier: McpTier;
}

/**
 * Deny-by-default authorization for one governed tool. True iff the identity's
 * role holds the `mcp:tool:<name>` permission AND the tool is available at the
 * identity's server-derived tier. Governs both `tools/list` filtering and
 * `tools/call` execution.
 */
/**
 * Which tools may be placed behind an exact-call approval.
 * Reads stay `never` unless a later settings change opts an eligible tool in.
 * Only state-changing tools are eligible. The account `requireTools` list
 * chooses which of those eligible tools actually pause for a human.
 */
export const TOOL_APPROVAL_DEFAULT: Record<McpToolName, 'never' | 'eligible'> = {
  revealui_list_sites: 'never',
  revealui_list_content: 'never',
  revealui_get_content: 'never',
  revealui_site_stats: 'never',
  revealui_list_users: 'never',
  revealui_session_list: 'never',
  revealui_session_open: 'eligible',
  revealui_session_get: 'never',
  revealui_session_patch: 'eligible',
  revealui_page_read: 'never',
  kg_search: 'never',
  kg_get_node: 'never',
  kg_neighbors: 'never',
  kg_path: 'never',
  kg_at_time: 'never',
  kg_context: 'never',
  kg_add_episode: 'eligible',
};

export const MCP_APPROVAL_ELIGIBLE_TOOLS: ReadonlySet<string> = new Set(
  MCP_TOOL_NAMES.filter((name) => TOOL_APPROVAL_DEFAULT[name] === 'eligible'),
);

export function mcpToolApprovalEligibility(toolName: string): 'never' | 'eligible' {
  const policy = TOOL_APPROVAL_DEFAULT[toolName as McpToolName];
  return policy ?? 'never';
}

export function authorizeMcpTool(identity: McpAuthzIdentity, toolName: string): boolean {
  const roleAllowed = mcpAuthz.hasPermission(
    [identity.role],
    toolPermissionKey(toolName),
    EXECUTE_ACTION,
  );
  if (!roleAllowed) return false;
  const tierGate = TOOL_TIER_GATE[toolName as McpToolName];
  return tierGate?.has(identity.tier);
}
