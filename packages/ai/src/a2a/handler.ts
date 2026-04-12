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
} from '@revealui/contracts';
import { A2ASendTaskParamsSchema } from '@revealui/contracts';
import { logger } from '@revealui/core/observability/logger';
import type { LLMClient } from '../llm/client.js';
import type { Message } from '../llm/providers/base.js';
import { agentCardRegistry } from './card.js';
import {
  appendArtifact,
  cancelTask,
  createTask,
  getTask,
  getTaskSignal,
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
  llmClient?: LLMClient,
): Promise<A2AJsonRpcResponse> {
  const parsed = A2ASendTaskParamsSchema.safeParse(params);
  if (!parsed.success) {
    return err(id, RPC_INVALID_PARAMS, 'Invalid tasks/send params', parsed.error.issues);
  }

  const p: A2ASendTaskParams = parsed.data;

  // Validate agent exists if agentId provided
  if (agentId && !agentCardRegistry.has(agentId)) {
    return err(id, RPC_AGENT_NOT_FOUND, `Agent '${agentId}' not found`);
  }

  // Create task in submitted state
  const task = createTask({
    id: p.id,
    sessionId: p.sessionId,
    message: p.message,
    metadata: p.metadata,
  });

  const signal = getTaskSignal(task.id);

  try {
    // Transition to working
    updateTaskState(task.id, 'working');

    // Execute via orchestration  -  for now, produce a direct text response.
    // Full AgentRuntime integration wires in when an LLM provider is configured.
    const agentDef = agentId
      ? agentCardRegistry.getDef(agentId)
      : agentCardRegistry.getDef('revealui-creator');

    if (signal?.aborted) {
      return ok(id, getTask(task.id));
    }

    // Build response message
    const textInput = p.message.parts
      .filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? part.text : ''))
      .join('\n')
      .trim();

    let responseText: string;
    if (llmClient && textInput) {
      // Real LLM call using the provided client
      const messages: Message[] = [];
      if (agentDef?.systemPrompt) {
        messages.push({ role: 'system', content: agentDef.systemPrompt });
      }
      messages.push({ role: 'user', content: textInput });
      const llmResponse = await llmClient.chat(messages);
      responseText = llmResponse.content;
    } else {
      // Stub response when no LLM client is configured
      responseText = agentDef
        ? `[${agentDef.name}] Received: "${textInput}". Task queued for execution. ` +
          `Capabilities: ${agentDef.capabilities.join(', ')}.`
        : `Task received: "${textInput}". Processing...`;
    }

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
    const message = e instanceof Error ? e.message : 'Task execution failed';
    logger.error(`A2A task ${task.id} failed: ${message}`);
    const failed = updateTaskState(task.id, 'failed', {
      role: 'agent',
      parts: [{ type: 'text', text: `Error: ${message}` }],
    });
    return ok(id, failed);
  }
}

function handleTasksGet(id: string | number, params: unknown): A2AJsonRpcResponse {
  const p = params as Record<string, unknown> | undefined;
  const taskId = p?.id;
  if (typeof taskId !== 'string') {
    return err(id, RPC_INVALID_PARAMS, 'params.id (string) is required');
  }
  const task = getTask(taskId);
  if (!task) {
    return err(id, RPC_TASK_NOT_FOUND, `Task '${taskId}' not found`);
  }
  return ok(id, task);
}

function handleTasksCancel(id: string | number, params: unknown): A2AJsonRpcResponse {
  const p = params as Record<string, unknown> | undefined;
  const taskId = p?.id;
  if (typeof taskId !== 'string') {
    return err(id, RPC_INVALID_PARAMS, 'params.id (string) is required');
  }
  const canceled = cancelTask(taskId);
  if (!canceled) {
    const task = getTask(taskId);
    if (!task) return err(id, RPC_TASK_NOT_FOUND, `Task '${taskId}' not found`);
    return err(id, RPC_TASK_NOT_CANCELABLE, `Task '${taskId}' is not in a cancelable state`);
  }
  return ok(id, getTask(taskId));
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
  llmClient?: LLMClient,
): Promise<A2AJsonRpcResponse> {
  const { id, method, params } = req;

  switch (method) {
    case 'tasks/send':
      return handleTasksSend(id, params, agentId, llmClient);

    case 'tasks/get':
      return handleTasksGet(id, params);

    case 'tasks/cancel':
      return handleTasksCancel(id, params);

    case 'tasks/sendSubscribe':
      // SSE streaming is handled at the Hono route level; return a reference task here
      return handleTasksSend(id, params, agentId, llmClient);

    default:
      return err(id, RPC_METHOD_NOT_FOUND, `Method '${method}' not found`);
  }
}

export { RPC_INVALID_REQUEST, RPC_PARSE_ERROR };
