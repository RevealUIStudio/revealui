/**
 * Tool integrity audit wrapper (GAP-355 Stage 5 S5-4).
 *
 * Same fail-closed contract as `createToolsFromMcpClient({ onToolAudit })`:
 * after a successful tool execution, await the audit hook and rethrow so an
 * unrecorded success cannot complete. On tool failure, prefer the tool error
 * if a secondary audit write fails.
 *
 * Used for admin CMS + coding tools that are not MCP server tools.
 */

import type { Tool, ToolResult } from './base.js';

/** Summary event for one tool execution (no raw args / results). */
export interface ToolIntegrityAuditEvent {
  toolName: string;
  success: boolean;
  duration_ms: number;
  error?: string;
}

export type ToolIntegrityAuditHandler = (event: ToolIntegrityAuditEvent) => void | Promise<void>;

/**
 * Wrap a tool so each `execute` emits an integrity audit event.
 * Returns a new tool object; does not mutate the input.
 */
export function wrapToolWithIntegrityAudit(
  tool: Tool,
  onToolAudit: ToolIntegrityAuditHandler,
): Tool {
  return {
    ...tool,
    async execute(params: unknown): Promise<ToolResult> {
      const started = Date.now();
      let result: ToolResult;

      try {
        result = await tool.execute(params);
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error);
        try {
          await onToolAudit({
            toolName: tool.name,
            success: false,
            duration_ms: Date.now() - started,
            error: errorText,
          });
        } catch {
          // Prefer the original tool exception over a secondary audit failure.
        }
        throw error;
      }

      const event: ToolIntegrityAuditEvent = {
        toolName: tool.name,
        success: result.success,
        duration_ms: Date.now() - started,
        ...(result.error !== undefined ? { error: result.error } : {}),
      };

      if (result.success) {
        await onToolAudit(event);
        return result;
      }

      try {
        await onToolAudit(event);
      } catch {
        // Prefer the tool failure over a secondary audit failure.
      }
      return result;
    },
  };
}

/** Map over a tool list when a handler is provided; otherwise return as-is. */
export function maybeWrapToolsWithIntegrityAudit(
  tools: Tool[],
  onToolAudit: ToolIntegrityAuditHandler | undefined,
): Tool[] {
  if (!onToolAudit) return tools;
  return tools.map((tool) => wrapToolWithIntegrityAudit(tool, onToolAudit));
}
