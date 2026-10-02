/**
 * A2A JSON-RPC Handler
 *
 * Dispatches A2A JSON-RPC 2.0 methods to the appropriate implementation.
 * Integrates with AgentRuntime and AgentOrchestrator from @revealui/ai/orchestration.
 *
 * Supported methods:
 *   tasks/send           -  synchronous task execution
 *   tasks/get            -  retrieve task by ID
 *   tasks/cancel         -  cancel a running task
 *   tasks/sendSubscribe  -  (handled at route level via SSE; returns taskId here)
 */

import type {
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
  A2AMessage,
  A2ASendTaskParams,
  A2ATask,
} from '@revealui/contracts';
import { A2ASendTaskParamsSchema } from '@revealui/contracts';
import { logger } from '@revealui/core/observability/logger';
import type { AgentActionScope } from '@revealui/db/schema';
import type { LLMClient } from '../llm/client.js';
import type { Message } from '../llm/providers/base.js';
import { agentCardRegistry } from './card.js';
import {
  appendArtifact,
  cancelTask,
  claimTask,
  createTask,
  getTask,
  getTaskExecution,
  getTaskSignal,
  isTaskReservation,
  matchesTaskInput,
  startClaimedTask,
  updateTaskState,
} from './task-store.js';

// =============================================================================
// JSON-RPC error codes (A2A uses standard JSON-RPC codes + custom range -32000+)
// =============================================================================

const RPC_PARSE_ERROR = -32700;
const RPC_INVALID_REQUEST = -32600;
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INVALID_PARAMS = -32602;
const RPC_TASK_NOT_FOUND = -32001;
const RPC_TASK_NOT_CANCELABLE = -32002;
const RPC_AGENT_NOT_FOUND = -32003;

type HandlerOptions = {
  scope: AgentActionScope;
  paymentVerified?: boolean;
  /** Original server reservation; provenance and one-use consumption checked by the store. */
  preparedTask?: A2ATask;
};

// =============================================================================
// Response helpers
// =============================================================================

function ok(id: string | number, result: unknown): A2AJsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function err(
  id: string | number,
  code: number,
  message: string,
  data?: unknown,
): A2AJsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

// =============================================================================
// Method handlers
// =============================================================================

async function handleTasksSend(
  id: string | number,
  params: unknown,
  agentId?: string,
  llmClient?: Pick<LLMClient, 'chat'>,
  options?: HandlerOptions,
): Promise<A2AJsonRpcResponse> {
  const parsed = A2ASendTaskParamsSchema.safeParse(params);
  if (!parsed.success) {
    return err(id, RPC_INVALID_PARAMS, 'Invalid tasks/send params', parsed.error.issues);
  }

  const p: A2ASendTaskParams = parsed.data;
  if (!options?.scope?.actorUserId) return err(id, RPC_TASK_NOT_FOUND, 'Task not found');

  // Validate agent exists if agentId provided
  if (agentId && !agentCardRegistry.has(agentId)) {
    return err(id, RPC_AGENT_NOT_FOUND, `Agent '${agentId}' not found`);
  }

  // Resolve agent definition early — needed for the pricing gate below AND
  // for execution context (system prompt, capabilities) further down.
  let agentDef = agentId
    ? agentCardRegistry.getDef(agentId)
    : agentCardRegistry.getDef('revealui-creator');
  const execution = { agentId: agentId ?? 'revealui-creator', definition: agentDef };

  const taskParams = {
    id: p.id,
    sessionId: p.sessionId,
    message: p.message,
    metadata: agentDef?.pricing ? { ...p.metadata, pricing: agentDef.pricing } : p.metadata,
  };
  const task = options.preparedTask ?? createTask(taskParams, options.scope, execution);
  if (
    !task ||
    (p.id !== undefined && p.id !== task.id) ||
    !matchesTaskInput(task, options.scope, taskParams, execution)
  )
    return err(id, RPC_TASK_NOT_FOUND, 'Task not found');
  agentDef = getTaskExecution(task, options.scope)?.definition;

  // x402 payment gate: when an agent has pricing AND payment was not
  // verified upstream by the route, emit a 'pending-payment' task. The
  // route layer translates this state into HTTP 402 with a fresh
  // X-PAYMENT-REQUIRED header. Pricing rides in task.metadata so the
  // route can build the requirements without re-querying the registry.
  if (agentDef?.pricing && !options?.paymentVerified) {
    if (!isTaskReservation(task, options.scope))
      return err(id, RPC_TASK_NOT_FOUND, 'Task not found');
    const pending = updateTaskState(task.id, 'pending-payment');
    return ok(id, pending);
  }

  if (
    !(
      (options.preparedTask || claimTask(task, options.scope)) &&
      startClaimedTask(task, options.scope)
    )
  )
    return err(id, RPC_TASK_NOT_FOUND, 'Task not found');
  const signal = getTaskSignal(task.id, options.scope);

  try {
    // Transition to working
    updateTaskState(task.id, 'working');

    // A receipt may complete only after configured execution, never a placeholder.
    if (signal?.aborted) {
      return ok(id, getTask(task.id, options.scope));
    }

    // Build response message
    const textInput = p.message.parts
      .filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? part.text : ''))
      .join('\n')
      .trim();

    if (!llmClient) {
      throw new Error(
        'No LLM provider is configured. Configure a provider before running this task.',
      );
    }
    if (!textInput) {
      throw new Error('This agent requires a non-empty text message to run a task.');
    }
    const messages: Message[] = [];
    if (agentDef?.systemPrompt) {
      messages.push({ role: 'system', content: agentDef.systemPrompt });
    }
    messages.push({ role: 'user', content: textInput });
    const llmResponse = await llmClient.chat(messages);
    if (signal?.aborted) return ok(id, getTask(task.id, options.scope));
    const responseText = llmResponse.content;

    const agentMessage: A2AMessage = {
      role: 'agent',
      parts: [{ type: 'text', text: responseText }],
    };

    // Append artifact and complete
    appendArtifact(task.id, {
      name: 'response',
      parts: [{ type: 'text', text: responseText }],
      index: 0,
      lastChunk: true,
    });

    const completed = updateTaskState(task.id, 'completed', agentMessage);
    logger.info(`A2A task ${task.id} completed`);
    return ok(id, completed);
  } catch (e: unknown) {
    if (signal?.aborted) return ok(id, getTask(task.id, options.scope));
    const message = e instanceof Error ? e.message : 'Task execution failed';
    logger.error(`A2A task ${task.id} failed: ${message}`);
    const failed = updateTaskState(task.id, 'failed', {
      role: 'agent',
      parts: [{ type: 'text', text: `Error: ${message}` }],
    });
    return ok(id, failed);
  }
}

function handleTasksGet(
  id: string | number,
  params: unknown,
  scope: AgentActionScope,
): A2AJsonRpcResponse {
  const p = params as Record<string, unknown> | undefined;
  const taskId = p?.id;
  if (typeof taskId !== 'string') {
    return err(id, RPC_INVALID_PARAMS, 'params.id (string) is required');
  }
  const task = getTask(taskId, scope);
  if (!task) {
    return err(id, RPC_TASK_NOT_FOUND, 'Task not found');
  }
  return ok(id, task);
}

function handleTasksCancel(
  id: string | number,
  params: unknown,
  scope: AgentActionScope,
): A2AJsonRpcResponse {
  const p = params as Record<string, unknown> | undefined;
  const taskId = p?.id;
  if (typeof taskId !== 'string') {
    return err(id, RPC_INVALID_PARAMS, 'params.id (string) is required');
  }
  const canceled = cancelTask(taskId, scope);
  if (!canceled) {
    const task = getTask(taskId, scope);
    if (!task) return err(id, RPC_TASK_NOT_FOUND, 'Task not found');
    return err(id, RPC_TASK_NOT_CANCELABLE, `Task '${taskId}' is not in a cancelable state`);
  }
  return ok(id, getTask(taskId, scope));
}

// =============================================================================
// Main dispatcher
// =============================================================================

/**
 * Handle an A2A JSON-RPC request and return a JSON-RPC response.
 *
 * @param req - Parsed JSON-RPC request body
 * @param agentId - Optional agent ID (from X-Agent-ID header)
 * @param llmClient - Optional LLM client for real inference (BYOK)
 */
export async function handleA2AJsonRpc(
  req: A2AJsonRpcRequest,
  agentId?: string,
  llmClient?: Pick<LLMClient, 'chat'>,
  options?: HandlerOptions,
): Promise<A2AJsonRpcResponse> {
  const { id, method, params } = req;
  if (!options?.scope?.actorUserId) return err(id, RPC_TASK_NOT_FOUND, 'Task not found');

  switch (method) {
    case 'tasks/send':
      return handleTasksSend(id, params, agentId, llmClient, options);

    case 'tasks/get':
      return handleTasksGet(id, params, options.scope);

    case 'tasks/cancel':
      return handleTasksCancel(id, params, options.scope);

    case 'tasks/sendSubscribe':
      // SSE streaming is handled at the Hono route level; return a reference task here
      return handleTasksSend(id, params, agentId, llmClient, options);

    default:
      return err(id, RPC_METHOD_NOT_FOUND, `Method '${method}' not found`);
  }
}

export { RPC_INVALID_REQUEST, RPC_PARSE_ERROR };
