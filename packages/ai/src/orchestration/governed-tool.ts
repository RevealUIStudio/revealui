/**
 * Shared governed tool execution.
 *
 * AgentRuntime and StreamingAgentRuntime both call executeGovernedTool.
 * Approval (requiresApproval, alwaysRequireApproval, approvalCallback) and
 * the runtime onToolAudit hook live here so the two loops cannot drift.
 *
 * LoopGuard accounting stays with the caller via countsAsNewExecution:
 * a missing approval callback does not count, a denying callback does,
 * and a fresh execution does. Cached repeats do not.
 */

import type { ApprovalCallback, Tool, ToolResult } from '../tools/base.js';
import type { ToolCallDeduplicator } from '../tools/deduplicator.js';
import type { McpToolCallEvent } from '../tools/mcp-events.js';

/** Why the governed executor stopped or continued. */
export type GovernedToolDecision = 'allowed' | 'denied' | 'approval_required' | 'cached';

/**
 * Audit event for one governed tool attempt.
 *
 * The runtime hook is typed as McpToolCallEvent. namespace `governed`
 * marks events emitted by this executor (not an MCP server adapter).
 * Adapter audits keep the server namespace and omit `decision`.
 */
export interface GovernedToolAuditEvent extends McpToolCallEvent {
  decision: 'allowed' | 'denied' | 'approval_required';
}

export interface ExecuteGovernedToolInput {
  tool: Tool;
  params: unknown;
  deduplicator: ToolCallDeduplicator;
  approvalCallback?: ApprovalCallback;
  alwaysRequireApproval?: readonly string[];
  onToolAudit?: (event: McpToolCallEvent) => void | Promise<void>;
  /**
   * Skip the post-execution audit. MCP tools already audit inside execute
   * with the server namespace. Approval blocks still audit here, because
   * the tool body never runs.
   */
  skipExecutionAudit?: boolean;
}

export interface GovernedToolExecution {
  result: ToolResult;
  /**
   * True when AgentRuntime would increment LoopGuard newToolExecutions.
   * A missing approval callback does not. A denying callback does.
   * A cache hit does not. A fresh execution does.
   */
  countsAsNewExecution: boolean;
  decision: GovernedToolDecision;
}

const GOVERNED_AUDIT_NAMESPACE = 'governed';

/**
 * Union tool names that always require approval.
 * Empty input stays empty so an explicit empty list is preserved.
 */
export function mergeHumanApprovalNames(
  alwaysRequireApproval: readonly string[] | undefined,
  requiresHumanApproval: readonly string[] | undefined,
): string[] | undefined {
  const always = alwaysRequireApproval ?? [];
  const fromSpec = requiresHumanApproval ?? [];
  if (always.length === 0 && fromSpec.length === 0) {
    if (alwaysRequireApproval !== undefined) return [...alwaysRequireApproval];
    if (requiresHumanApproval !== undefined) return [...requiresHumanApproval];
    return undefined;
  }
  const names = new Set<string>();
  for (const name of always) names.add(name);
  for (const name of fromSpec) names.add(name);
  return [...names];
}

function toolNeedsApproval(
  tool: Tool,
  alwaysRequireApproval: readonly string[] | undefined,
): boolean {
  if (tool.requiresApproval === true) return true;
  if (!alwaysRequireApproval) return false;
  return alwaysRequireApproval.includes(tool.name);
}

function approvalRequiredMessage(tool: Tool): string {
  return `Tool "${tool.label ?? tool.name}" requires human approval but no approval handler is configured.`;
}

function denialMessage(tool: Tool, reason: string | undefined): string {
  if (reason) return `Tool "${tool.label ?? tool.name}" denied: ${reason}`;
  return `Tool "${tool.label ?? tool.name}" was denied by the user.`;
}

function auditEvent(
  toolName: string,
  decision: GovernedToolAuditEvent['decision'],
  success: boolean,
  durationMs: number,
  error?: string,
): GovernedToolAuditEvent {
  return {
    kind: 'mcp.tool.call',
    namespace: GOVERNED_AUDIT_NAMESPACE,
    toolName,
    decision,
    success,
    duration_ms: durationMs,
    ...(error !== undefined ? { error } : {}),
  };
}

async function emitAudit(
  onToolAudit: ExecuteGovernedToolInput['onToolAudit'],
  event: GovernedToolAuditEvent,
  failClosed: boolean,
): Promise<void> {
  if (!onToolAudit) return;
  if (failClosed) {
    await onToolAudit(event);
    return;
  }
  try {
    await onToolAudit(event);
  } catch {
    // A failed audit write must not hide a denial or a tool error.
  }
}

/**
 * Approve, audit, and execute one tool call.
 * Does not throw for approval blocks. Tool and audit failures on an
 * allowed success still throw so the caller records them.
 */
export async function executeGovernedTool(
  input: ExecuteGovernedToolInput,
): Promise<GovernedToolExecution> {
  const { tool, params, deduplicator } = input;
  const needsApproval = toolNeedsApproval(tool, input.alwaysRequireApproval);

  if (needsApproval) {
    if (!input.approvalCallback) {
      const error = approvalRequiredMessage(tool);
      await emitAudit(
        input.onToolAudit,
        auditEvent(tool.name, 'approval_required', false, 0, error),
        false,
      );
      return {
        result: { success: false, error },
        countsAsNewExecution: false,
        decision: 'approval_required',
      };
    }

    const approval = await input.approvalCallback({
      toolName: tool.name,
      toolLabel: tool.label,
      params,
      description: `${tool.label ?? tool.name}: ${tool.description}`,
    });

    if (!approval.approved) {
      const error = denialMessage(tool, approval.reason);
      await emitAudit(input.onToolAudit, auditEvent(tool.name, 'denied', false, 0, error), false);
      return {
        result: { success: false, error },
        countsAsNewExecution: true,
        decision: 'denied',
      };
    }
  }

  if (deduplicator.isDuplicate(tool.name, params)) {
    const cached = deduplicator.getResult(tool.name, params);
    if (cached) {
      return { result: cached, countsAsNewExecution: false, decision: 'cached' };
    }
  }

  const started = Date.now();
  let result: ToolResult;
  try {
    result = await tool.execute(params);
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    if (!input.skipExecutionAudit) {
      await emitAudit(
        input.onToolAudit,
        auditEvent(tool.name, 'allowed', false, Date.now() - started, errorText),
        false,
      );
    }
    throw error;
  }

  if (!input.skipExecutionAudit) {
    await emitAudit(
      input.onToolAudit,
      auditEvent(tool.name, 'allowed', result.success, Date.now() - started, result.error),
      result.success,
    );
  }

  deduplicator.record(tool.name, params, result);
  return { result, countsAsNewExecution: true, decision: 'allowed' };
}
