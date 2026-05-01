import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentCardRegistry } from '../card.js';
import { handleA2AJsonRpc } from '../handler.js';
import {
  appendArtifact,
  cancelTask,
  createTask,
  evictTask,
  getTask,
  getTaskSignal,
  updateTaskState,
} from '../task-store.js';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function userMessage(text: string) {
  return {
    role: 'user' as const,
    parts: [{ type: 'text' as const, text }],
  };
}

const createdTaskIds: string[] = [];
const registeredAgentIds: string[] = [];

function trackTaskId(id: string) {
  createdTaskIds.push(id);
  return id;
}

describe('a2a agent card registry', () => {
  afterEach(() => {
    for (const agentId of registeredAgentIds.splice(0)) {
      agentCardRegistry.unregister(agentId);
    }
  });

  it('exposes built-in agent cards and normalizes the base URL', () => {
    const cards = agentCardRegistry.listCards('https://api.revealui.test/');
    const creatorCard = agentCardRegistry.getCard('revealui-creator', 'https://api.revealui.test/');
    const ticketCard = agentCardRegistry.getCard(
      'revealui-ticket-agent',
      'https://api.revealui.test/',
    );

    expect(cards).toHaveLength(2);
    expect(creatorCard).toMatchObject({
      name: 'The Creator',
      url: 'https://api.revealui.test/a2a',
      documentationUrl: 'https://api.revealui.test/docs',
    });
    expect(ticketCard).toMatchObject({
      name: 'Ticket Agent',
      url: 'https://api.revealui.test/a2a',
    });
  });

  it('supports register, update, unregister, and lookup', () => {
    const agentId = 'test-a2a-agent';
    registeredAgentIds.push(agentId);

    agentCardRegistry.register({
      id: agentId,
      version: 1,
      name: 'Test Agent',
      description: 'Original description',
      model: 'gpt-test',
      systemPrompt: 'Test system prompt',
      tools: [],
      capabilities: ['test'],
      temperature: 0.2,
      maxTokens: 512,
    });

    expect(agentCardRegistry.has(agentId)).toBe(true);
    expect(agentCardRegistry.getDef(agentId)?.description).toBe('Original description');

    expect(
      agentCardRegistry.update(agentId, {
        description: 'Updated description',
        capabilities: ['test', 'updated'],
      }),
    ).toBe(true);
    expect(agentCardRegistry.getDef(agentId)).toMatchObject({
      description: 'Updated description',
      capabilities: ['test', 'updated'],
    });

    expect(agentCardRegistry.unregister(agentId)).toBe(true);
    expect(agentCardRegistry.has(agentId)).toBe(false);
    expect(agentCardRegistry.getCard(agentId, 'https://api.revealui.test')).toBeNull();
  });
});

describe('a2a task store', () => {
  afterEach(() => {
    for (const taskId of createdTaskIds.splice(0)) {
      evictTask(taskId);
    }
  });

  it('creates, updates, appends artifacts, cancels, and evicts tasks', () => {
    const task = createTask({
      id: trackTaskId('task-store-basic'),
      sessionId: 'session-1',
      message: userMessage('Hello'),
      metadata: { source: 'test' },
    });

    expect(task.status.state).toBe('submitted');
    expect(getTask(task.id)?.history).toHaveLength(1);
    expect(getTaskSignal(task.id)?.aborted).toBe(false);

    const working = updateTaskState(task.id, 'working', {
      role: 'agent',
      parts: [{ type: 'text', text: 'Working...' }],
    });
    expect(working?.status.state).toBe('working');
    expect(working?.history).toHaveLength(2);

    const withArtifact = appendArtifact(task.id, {
      name: 'result',
      parts: [{ type: 'text', text: 'Done' }],
      index: 0,
      lastChunk: true,
    });
    expect(withArtifact?.artifacts).toHaveLength(1);

    expect(cancelTask(task.id)).toBe(true);
    expect(getTask(task.id)?.status.state).toBe('canceled');
    expect(getTaskSignal(task.id)?.aborted).toBe(true);

    evictTask(task.id);
    expect(getTask(task.id)).toBeNull();
    expect(getTaskSignal(task.id)).toBeNull();
  });

  it('rejects cancel requests for missing or non-cancelable tasks', () => {
    expect(cancelTask('missing-task')).toBe(false);

    const task = createTask({
      id: trackTaskId('task-store-completed'),
      message: userMessage('Complete this'),
    });
    updateTaskState(task.id, 'completed', {
      role: 'agent',
      parts: [{ type: 'text', text: 'Completed' }],
    });

    expect(cancelTask(task.id)).toBe(false);
    expect(getTask(task.id)?.status.state).toBe('completed');
  });

  it('allows cancel from the pending-payment state (requester releases the slot)', () => {
    const task = createTask({
      id: trackTaskId('task-store-pending-payment-cancel'),
      message: userMessage('Pay or cancel'),
    });
    updateTaskState(task.id, 'pending-payment');

    expect(getTask(task.id)?.status.state).toBe('pending-payment');
    expect(cancelTask(task.id)).toBe(true);
    expect(getTask(task.id)?.status.state).toBe('canceled');
  });
});

describe('a2a json-rpc handler', () => {
  afterEach(() => {
    for (const taskId of createdTaskIds.splice(0)) {
      evictTask(taskId);
    }
  });

  beforeEach(() => {
    const knownIds = ['rpc-task', 'rpc-invalid', 'rpc-cancel'];
    for (const taskId of knownIds) {
      evictTask(taskId);
    }
  });

  it('returns invalid params for malformed tasks/send requests', async () => {
    const response = await handleA2AJsonRpc({
      jsonrpc: '2.0',
      id: 'rpc-invalid',
      method: 'tasks/send',
      params: { message: { role: 'user' } },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'rpc-invalid',
      error: {
        code: -32602,
        message: 'Invalid tasks/send params',
      },
    });
  });

  it('completes a stubbed tasks/send request for a registered agent', async () => {
    trackTaskId('rpc-task');

    const response = await handleA2AJsonRpc(
      {
        jsonrpc: '2.0',
        id: 'rpc-task',
        method: 'tasks/send',
        params: {
          id: 'rpc-task',
          sessionId: 'session-123',
          message: userMessage('Help me ship this feature'),
          metadata: { source: 'test' },
        },
      },
      'revealui-ticket-agent',
    );

    expect(response.error).toBeUndefined();
    expect(response.result).toMatchObject({
      id: 'rpc-task',
      sessionId: 'session-123',
      status: {
        state: 'completed',
      },
      artifacts: [
        {
          name: 'response',
        },
      ],
    });

    const resultTask = response.result as {
      status: { message?: { parts: Array<{ text?: string }> } };
    };
    expect(resultTask.status.message?.parts[0]?.text).toContain('[Ticket Agent] Received:');
    expect(getTask('rpc-task')?.status.state).toBe('completed');
  });

  it('uses the llm client when provided', async () => {
    trackTaskId('rpc-llm-task');

    const response = await handleA2AJsonRpc(
      {
        jsonrpc: '2.0',
        id: 'rpc-llm-task',
        method: 'tasks/send',
        params: {
          id: 'rpc-llm-task',
          message: userMessage('Summarize this'),
        },
      },
      'revealui-creator',
      {
        chat: vi.fn().mockResolvedValue({ content: 'LLM generated response' }),
      } as never,
    );

    const resultTask = response.result as {
      status: { message?: { parts: Array<{ text?: string }> } };
    };
    expect(resultTask.status.message?.parts[0]?.text).toBe('LLM generated response');
  });

  it('returns agent not found for unknown agents', async () => {
    const response = await handleA2AJsonRpc(
      {
        jsonrpc: '2.0',
        id: 'rpc-missing-agent',
        method: 'tasks/send',
        params: {
          message: userMessage('Who are you?'),
        },
      },
      'missing-agent',
    );

    expect(response).toMatchObject({
      error: {
        code: -32003,
        message: "Agent 'missing-agent' not found",
      },
    });
  });

  it('gets and cancels tasks through JSON-RPC methods', async () => {
    const taskId = trackTaskId('rpc-cancel');
    createTask({
      id: taskId,
      message: userMessage('Cancelable task'),
    });

    const getResponse = await handleA2AJsonRpc({
      jsonrpc: '2.0',
      id: 'rpc-get',
      method: 'tasks/get',
      params: { id: taskId },
    });
    expect(getResponse.result).toMatchObject({
      id: taskId,
      status: { state: 'submitted' },
    });

    const cancelResponse = await handleA2AJsonRpc({
      jsonrpc: '2.0',
      id: 'rpc-cancel-request',
      method: 'tasks/cancel',
      params: { id: taskId },
    });
    expect(cancelResponse.result).toMatchObject({
      id: taskId,
      status: { state: 'canceled' },
    });
  });

  it('returns method not found and missing task errors', async () => {
    const methodResponse = await handleA2AJsonRpc({
      jsonrpc: '2.0',
      id: 'rpc-method',
      method: 'tasks/unknown',
    });
    expect(methodResponse).toMatchObject({
      error: {
        code: -32601,
        message: "Method 'tasks/unknown' not found",
      },
    });

    const getResponse = await handleA2AJsonRpc({
      jsonrpc: '2.0',
      id: 'rpc-missing-task',
      method: 'tasks/get',
      params: { id: 'does-not-exist' },
    });
    expect(getResponse).toMatchObject({
      error: {
        code: -32001,
        message: "Task 'does-not-exist' not found",
      },
    });
  });

  it('emits pending-payment when agent has pricing and payment is not verified', async () => {
    const agentId = 'paid-test-agent-pending';
    registeredAgentIds.push(agentId);
    agentCardRegistry.register({
      id: agentId,
      version: 1,
      name: 'Paid Agent',
      description: 'Charges for tasks',
      model: 'gpt-test',
      systemPrompt: 'Charges per call',
      tools: [],
      capabilities: ['paid'],
      temperature: 0.2,
      maxTokens: 512,
      pricing: { usdc: '0.05' },
    });
    trackTaskId('rpc-paid-pending');

    const response = await handleA2AJsonRpc(
      {
        jsonrpc: '2.0',
        id: 'rpc-paid-pending',
        method: 'tasks/send',
        params: {
          id: 'rpc-paid-pending',
          message: userMessage('Do paid work'),
        },
      },
      agentId,
    );

    expect(response.error).toBeUndefined();
    expect(response.result).toMatchObject({
      id: 'rpc-paid-pending',
      status: { state: 'pending-payment' },
      metadata: { pricing: { usdc: '0.05' } },
    });
    expect(getTask('rpc-paid-pending')?.status.state).toBe('pending-payment');
  });

  it('falls through to execution when paymentVerified=true is passed via options', async () => {
    const agentId = 'paid-test-agent-verified';
    registeredAgentIds.push(agentId);
    agentCardRegistry.register({
      id: agentId,
      version: 1,
      name: 'Paid Agent Verified',
      description: 'Charges for tasks',
      model: 'gpt-test',
      systemPrompt: 'Charges per call',
      tools: [],
      capabilities: ['paid'],
      temperature: 0.2,
      maxTokens: 512,
      pricing: { usdc: '0.05' },
    });
    trackTaskId('rpc-paid-verified');

    const response = await handleA2AJsonRpc(
      {
        jsonrpc: '2.0',
        id: 'rpc-paid-verified',
        method: 'tasks/send',
        params: {
          id: 'rpc-paid-verified',
          message: userMessage('Paid work'),
        },
      },
      agentId,
      undefined,
      { paymentVerified: true },
    );

    expect(response.error).toBeUndefined();
    expect(response.result).toMatchObject({
      id: 'rpc-paid-verified',
      status: { state: 'completed' },
    });
  });
});
