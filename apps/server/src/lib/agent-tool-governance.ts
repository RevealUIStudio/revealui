/**
 * Apply Stage 6 pre-authorize wraps to in-process agent tools (S6-3).
 *
 * Uses authorizeAgentTool (S6-2) + soft-fail denial + recordAgentToolDenied.
 * Implemented here (not a static `@revealui/ai` import) so apps/server stays
 * free of a hard Pro-package dependency at module load; the wrap contract
 * matches `packages/ai` `wrapToolWithGovernance`.
 *
 * Pass only admin/coding tools — not MCP `mcp_*` tools (unknown would deny;
 * remote MCP is gated separately).
 */

import type { AgentPrincipal } from './agent-principal.js';
import { authorizeAgentTool } from './agent-tool-access.js';
import { recordAgentToolDenied } from './agent-tool-audit.js';

/**
 * Minimal tool shape (structurally satisfied by `@revealui/ai` Tool).
 * No index signature — keeps `Tool[]` assignable without casts.
 */
export interface GovernableTool {
  name: string;
  execute: (params: unknown) => Promise<unknown>;
}

export interface AgentToolGovernanceContext {
  principal: AgentPrincipal;
  namespace: string;
  sessionId?: string;
  accountId?: string | null;
  userId?: string | null;
  taskId?: string;
}

/**
 * Wrap tools so each execute is pre-authorized. Soft-fail denials do not throw.
 * Preserves extra tool fields via spread; return type stays the input element type.
 */
export function applyAgentToolGovernance<T extends GovernableTool>(
  tools: readonly T[],
  ctx: AgentToolGovernanceContext,
): T[] {
  const { principal } = ctx;
  return tools.map((tool) => {
    const originalExecute = tool.execute.bind(tool);
    return {
      ...tool,
      async execute(params: unknown): Promise<unknown> {
        const decision = authorizeAgentTool(principal, tool.name);
        if (!decision.allowed) {
          try {
            await recordAgentToolDenied({
              toolName: tool.name,
              reason: decision.reason,
              namespace: ctx.namespace,
              sessionId: ctx.sessionId,
              accountId: ctx.accountId,
              userId: ctx.userId,
              agentId: principal.agentId,
              taskId: ctx.taskId,
            });
          } catch {
            // Soft-fail: still return denial if deny-audit fails.
          }
          return {
            success: false,
            error: `Permission denied (${decision.reason}): ${tool.name}`,
          };
        }
        return originalExecute(params);
      },
    };
  }) as T[];
}
