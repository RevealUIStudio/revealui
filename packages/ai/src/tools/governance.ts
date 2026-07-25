/**
 * Tool governance wrapper (GAP-355 Stage 6 S6-3).
 *
 * Pre-authorize before side effects; soft-fail (return ToolResult error) when
 * denied so the model can recover. Compose outside integrity audit wraps:
 *   governance(integrity(realTool))
 * so authorize runs first and denied tools never execute or integrity-audit success.
 *
 * MCP server tools are not wrapped here (remote / governed-MCP gated).
 */

import type { Tool, ToolResult } from './base.js';

export interface ToolAuthorizeDecision {
  allowed: boolean;
  /** Machine-readable deny reason (e.g. exec_requires_grant). */
  reason: string;
}

export type ToolAuthorizeFn = (toolName: string) => ToolAuthorizeDecision;

export type ToolDeniedHandler = (info: {
  toolName: string;
  reason: string;
}) => void | Promise<void>;

export interface WrapToolWithGovernanceOptions {
  authorize: ToolAuthorizeFn;
  /**
   * Called when authorize denies. Soft-fail: errors here do not rethrow —
   * the tool still returns a denial ToolResult (owner: soft fail UX).
   */
  onDenied?: ToolDeniedHandler;
}

/**
 * Wrap a tool so execute is gated by authorize. Denied → no execute.
 * Returns a new tool object; does not mutate the input.
 */
export function wrapToolWithGovernance(tool: Tool, options: WrapToolWithGovernanceOptions): Tool {
  return {
    ...tool,
    async execute(params: unknown): Promise<ToolResult> {
      const decision = options.authorize(tool.name);
      if (!decision.allowed) {
        try {
          await options.onDenied?.({
            toolName: tool.name,
            reason: decision.reason,
          });
        } catch {
          // Soft-fail: still return denial to the model if deny-audit fails.
        }
        return {
          success: false,
          error: `Permission denied (${decision.reason}): ${tool.name}`,
        };
      }
      return tool.execute(params);
    },
  };
}

/** Map a tool list through wrapToolWithGovernance. */
export function wrapToolsWithGovernance(
  tools: Tool[],
  options: WrapToolWithGovernanceOptions,
): Tool[] {
  return tools.map((tool) => wrapToolWithGovernance(tool, options));
}
