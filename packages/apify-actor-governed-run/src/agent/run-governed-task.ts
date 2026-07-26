import type { LLMChatOptions, LLMResponse, Message, Tool, ToolDefinition } from '@revealui/ai';
import { toJSONSchema } from 'zod/v4';
import type { ActionLogEntry } from '../types.js';

export const DEFAULT_MAX_STEPS = 10;

const SYSTEM_PROMPT =
  'You are a governed agent. Every model call and tool call you make is recorded ' +
  'into a signed, offline-verifiable receipt. Complete the task directly and concisely. ' +
  'When you have a final answer, respond with plain text and no further tool calls.';

/** Why a run stopped, recorded in the final output so a receipt reader can
 * tell a clean finish from a budget/step ceiling. */
export type RunStopReason = 'completed' | 'charge-limit' | 'max-steps';

export interface RunGovernedTaskDeps {
  task: string;
  tools: Tool[];
  maxSteps?: number;
  /** Sends messages to the LLM. Injected so tests never touch the network. */
  chat: (messages: Message[], options?: LLMChatOptions) => Promise<LLMResponse>;
  /** Called before each governed action (model call or tool call). Returns
   * `false` when the run's charge budget is exhausted and execution must stop
   * before doing the (billable) work. */
  chargeAction: () => Promise<boolean>;
}

export interface RunGovernedTaskResult {
  output: string;
  actionLog: ActionLogEntry[];
  stopReason: RunStopReason;
}

function toolToDefinition(tool: Tool): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      // Tool.parameters is a Zod schema; providers need JSON Schema-shaped
      // params. zod/v4 ships a native converter (toJSONSchema) -- no second
      // schema-conversion dependency needed.
      parameters: toJSONSchema(tool.parameters) as Record<string, unknown>,
    },
  };
}

/** Strip `undefined` values (recursively, one level is enough for our shapes)
 * so a record is safe to canonicalize with `canonicalizeJcs`, which throws on
 * `undefined` anywhere in the tree (see receipt/signable.ts). */
function definedOnly(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Run a governed agent task, recording every model call and tool call into an
 * ordered action log.
 *
 * This is a dedicated, minimal tool-calling loop rather than a wrapper around
 * `@revealui/ai`'s `AgentRuntime.executeTask()`. `AgentRuntime` is a complete,
 * exported, production loop (packages/ai/src/orchestration/runtime.ts) -- but
 * its `AgentResult` return shape (packages/ai/src/orchestration/agent.ts:46-56)
 * is `{ success, output?, toolResults?, error?, metadata? }`: an aggregate
 * summary, not an ordered per-call trail. Its only instrumentation hooks
 * (`RuntimeConfig.onToolAudit` and `approvalCallback`, runtime.ts:76-96) fire
 * for MCP-discovered tools and approval gates respectively, not for every
 * model call. Deriving a complete, ordered action log -- this product's core
 * value proposition -- from that black box after the fact would be lossy. So
 * this loop reuses the genuinely reusable pieces (`LLMClient`/`Reasoner.chat`,
 * the `Tool`/`ToolResult` contract, both from `@revealui/ai`) and owns the
 * iteration + recording itself.
 */
export async function runGovernedTask(deps: RunGovernedTaskDeps): Promise<RunGovernedTaskResult> {
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;
  const toolByName = new Map(deps.tools.map((tool) => [tool.name, tool]));
  const toolDefinitions = deps.tools.map(toolToDefinition);

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: deps.task },
  ];

  const actionLog: ActionLogEntry[] = [];
  let output = '';
  let stopReason: RunStopReason = 'max-steps';

  const nextIndex = (): number => actionLog.length;

  for (let step = 0; step < maxSteps; step++) {
    const allowedToCallModel = await deps.chargeAction();
    if (!allowedToCallModel) {
      output = 'Run stopped: the charge budget was exhausted before the next model call.';
      stopReason = 'charge-limit';
      break;
    }

    const response = await deps.chat(messages, {
      tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
    });

    actionLog.push({
      index: nextIndex(),
      type: 'model_call',
      timestamp: new Date().toISOString(),
      detail: definedOnly({
        content: response.content,
        finishReason: response.finishReason,
        toolCallsRequested: response.toolCalls?.map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        })),
        usage: response.usage,
      }),
    });

    messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      output = response.content;
      stopReason = 'completed';
      break;
    }

    let chargeLimitReachedMidStep = false;
    for (const call of response.toolCalls) {
      let params: unknown = {};
      try {
        params = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        params = { _unparsedArguments: call.function.arguments };
      }

      const tool = toolByName.get(call.function.name);
      let result: { success: boolean; content?: string; data?: unknown; error?: string };

      if (!tool) {
        result = { success: false, error: `unknown or disallowed tool: ${call.function.name}` };
      } else {
        const allowedToCallTool = await deps.chargeAction();
        if (!allowedToCallTool) {
          result = { success: false, error: 'charge budget exhausted before this tool call' };
          chargeLimitReachedMidStep = true;
        } else {
          try {
            result = await tool.execute(params);
          } catch (err) {
            result = { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        }
      }

      actionLog.push({
        index: nextIndex(),
        type: 'tool_call',
        timestamp: new Date().toISOString(),
        detail: definedOnly({
          toolCallId: call.id,
          toolName: call.function.name,
          params,
          success: result.success,
          content: result.content,
          error: result.error,
        }),
      });

      messages.push({
        role: 'tool',
        content: result.content ?? JSON.stringify(result.data ?? result.error ?? null),
        toolCallId: call.id,
      });

      if (chargeLimitReachedMidStep) break;
    }

    if (chargeLimitReachedMidStep) {
      output = 'Run stopped: the charge budget was exhausted mid-step.';
      stopReason = 'charge-limit';
      break;
    }

    if (step === maxSteps - 1) {
      output = 'Run stopped: reached the maximum number of steps without a final answer.';
      stopReason = 'max-steps';
    }
  }

  actionLog.push({
    index: nextIndex(),
    type: 'final_output',
    timestamp: new Date().toISOString(),
    detail: definedOnly({ output, stopReason }),
  });

  return { output, actionLog, stopReason };
}
