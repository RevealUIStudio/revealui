import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentCardRegistry, PROVIDER_RESOLVED_MODEL } from '../card.js';
import { handleA2AJsonRpc as dispatch } from '../handler.js';
import {
  appendArtifact,
  cancelTask as cancelOwnedTask,
  claimTask,
  createTask as createOwnedTask,
  evictTask,
  getTask as getOwnedTask,
  getTaskSignal as getOwnedTaskSignal,
  getTaskExecution,
  getTaskExecutionFingerprint,
  getTaskInputFingerprint,
  resumePendingTask,
  startClaimedTask,
  updateTaskState,
} from '../task-store.js';

const scope = { actorUserId: 'test-actor', accountId: 'test-account' };
const executionBinding = { agentId: 'test-agent', definition: undefined };
function createTask(params: Parameters<typeof createOwnedTask>[0]) {
  const task = createOwnedTask(params, scope, executionBinding);
  if (!task) throw new Error('Test task reservation failed');
  return task;
}
const getTask = (id: string) => getOwnedTask(id, scope);
const cancelTask = (id: string) => cancelOwnedTask(id, scope);
const getTaskSignal = (id: string) => getOwnedTaskSignal(id, scope);
type DispatchArgs = Parameters<typeof dispatch>;
const handleA2AJsonRpc = (
  request: DispatchArgs[0],
  agent?: DispatchArgs[1],
  client?: DispatchArgs[2],
  options?: Omit<NonNullable<DispatchArgs[3]>, 'scope'>,
) => dispatch(request, agent, client, { ...options, scope });

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

it('does not evict a newer reservation when an older insert attempt fails', () => {
  const id = trackTaskId('receipt-eviction-provenance');
  const old = createTask({ id, message: userMessage('Old request') });
  evictTask(id, old);
  const current = createTask({ id, message: userMessage('Current request') });
  evictTask(id, old);
  expect(getTask(id)).toBe(current);
  evictTask(id, current);
  expect(getTask(id)).toBeNull();
});

it('binds receipt fingerprints to canonical input and trusted execution, excluding the caller receipt namespace', async () => {
  const request = { message: userMessage('Run'), metadata: { b: 2, a: 1 } };
  const same = {
    metadata: { a: 1, b: 2, receipt: { persisted: true } },
    message: userMessage('Run'),
  };
  expect(await getTaskInputFingerprint(request, executionBinding)).toBe(
    await getTaskInputFingerprint(same, executionBinding),
  );
  expect(await getTaskInputFingerprint(request, executionBinding)).not.toBe(
    await getTaskInputFingerprint(
      { ...request, message: userMessage('Changed') },
      executionBinding,
    ),
  );
  expect(await getTaskExecutionFingerprint(executionBinding)).not.toBe(
    await getTaskExecutionFingerprint({ ...executionBinding, agentId: 'other-agent' }),
  );
});

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

  it('built-in agents defer model selection to the configured provider, not a vendor', () => {
    for (const agentId of ['revealui-creator', 'revealui-ticket-agent']) {
      const def = agentCardRegistry.getDef(agentId);
      expect(def).toBeDefined();
      // No hardcoded default: the model resolves from the account's configured
      // open-model provider at dispatch time.
      expect(def?.model).toBe(PROVIDER_RESOLVED_MODEL);
      const serialized = JSON.stringify(def).toLowerCase();
      expect(serialized).not.toContain('claude');
      expect(serialized).not.toContain('anthropic');
    }
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
  it('keeps ownership private and rejects a colliding task without replacing its controller', () => {
    const id = trackTaskId('private-owner-collision');
    const task = createTask({
      id,
      message: userMessage('Original input'),
      metadata: { actorUserId: 'forged' },
    });
    const signal = getTaskSignal(id);
    expect(
      createOwnedTask({ id, message: userMessage('Replacement input') }, scope, executionBinding),
    ).toBeNull();
    expect(getTaskSignal(id)).toBe(signal);
    expect(getTask(id)).toBe(task);
    for (const foreign of [
      { ...scope, actorUserId: 'other-user' },
      { ...scope, accountId: 'other-account' },
    ]) {
      expect(getOwnedTask(id, foreign)).toBeNull();
      expect(cancelOwnedTask(id, foreign)).toBe(false);
      expect(getOwnedTaskSignal(id, foreign)).toBeNull();
    }
    expect(signal?.aborted).toBe(false);
    expect(task).not.toHaveProperty('owner');
  });

  it('consumes original reservation provenance and execution exactly once', () => {
    const task = createTask({ id: trackTaskId('one-use-claim'), message: userMessage('Run once') });
    expect(claimTask({ ...task }, scope)).toBe(false);
    expect(claimTask(task, { ...scope, actorUserId: 'other' })).toBe(false);
    expect(startClaimedTask(task, scope)).toBe(false);
    expect(claimTask(task, scope)).toBe(true);
    expect(claimTask(task, scope)).toBe(false);
    expect(startClaimedTask(task, scope)).toBe(true);
    expect(startClaimedTask(task, scope)).toBe(false);
  });

  it('resumes only an unchanged owned unclaimed payment reservation', () => {
    const params = {
      id: trackTaskId('pending-payment-continuation'),
      message: userMessage('Original'),
    };
    const task = createTask(params);
    updateTaskState(task.id, 'pending-payment');
    expect(resumePendingTask(params, scope, executionBinding)).toBe(task);
    expect(
      resumePendingTask(params, scope, { ...executionBinding, agentId: 'changed-agent' }),
    ).toBeNull();
    expect(
      resumePendingTask({ ...params, message: userMessage('Changed') }, scope, executionBinding),
    ).toBeNull();
    expect(
      resumePendingTask(params, { ...scope, accountId: 'foreign' }, executionBinding),
    ).toBeNull();
    expect(claimTask(task, scope)).toBe(true);
    expect(resumePendingTask(params, scope, executionBinding)).toBeNull();
  });

  it('binds the immutable execution definition without exposing it in task metadata', () => {
    const registered = agentCardRegistry.getDef('revealui-creator');
    if (!registered) throw new Error('Built-in agent definition missing');
    const definition = structuredClone(registered);
    const original = structuredClone(definition);
    const params = { id: trackTaskId('bound-definition'), message: userMessage('Run') };
    const binding = { agentId: 'revealui-creator', definition };
    const task = createOwnedTask(params, scope, binding);
    if (!task) throw new Error('Test reservation failed');
    updateTaskState(task.id, 'pending-payment');
    definition.systemPrompt = 'Changed after reservation';
    expect(resumePendingTask(params, scope, binding)).toBeNull();
    expect(
      resumePendingTask(params, scope, { agentId: binding.agentId, definition: original }),
    ).toBe(task);
    expect(getTaskExecution(task, scope)?.definition?.systemPrompt).toBe(original.systemPrompt);
    expect(task).not.toHaveProperty('execution');
  });

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
  it('does not expose an existing task without trusted caller scope', async () => {
    const task = createTask({
      id: trackTaskId('private-task-without-caller-scope'),
      message: userMessage('Private task input'),
    });
    const response = await dispatch({
      jsonrpc: '2.0',
      id: 'anonymous-read',
      method: 'tasks/get',
      params: { id: task.id },
    });
    expect(response).toMatchObject({ error: { code: -32001 } });
  });

  it.each(['tasks/get', 'tasks/cancel'])(
    'returns identical missing and foreign errors for %s',
    async (method) => {
      const task = createTask({
        id: trackTaskId(`foreign-${method}`),
        message: userMessage('Private'),
      });
      const foreign = { ...scope, actorUserId: 'foreign' };
      const request = {
        jsonrpc: '2.0' as const,
        id: 'private-request',
        method,
        params: { id: task.id },
      };
      const denied = await dispatch(request, undefined, undefined, { scope: foreign });
      const missing = await dispatch(
        { ...request, params: { id: 'missing' } },
        undefined,
        undefined,
        { scope: foreign },
      );
      expect(denied).toEqual(missing);
      expect(denied).toMatchObject({ error: { code: -32001 } });
      expect(getTaskSignal(task.id)?.aborted).toBe(false);
    },
  );

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

  it('fails actionably without a provider instead of completing placeholder output', async () => {
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
        state: 'failed',
        message: { parts: [{ text: expect.stringContaining('Configure a provider') }] },
      },
    });
    expect((response.result as { artifacts?: unknown[] }).artifacts ?? []).toHaveLength(0);
    expect(getTask('rpc-task')?.status.state).toBe('failed');
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

  it.each(['resolves', 'rejects'] as const)(
    'preserves cancellation when a deferred provider %s afterward',
    async (outcome) => {
      const taskId = trackTaskId('rpc-cancel-deferred-provider');
      let enterProvider: () => void = () => {};
      let finishProvider: (response: { content: string; role: 'assistant' }) => void = () => {};
      let rejectProvider: (error: Error) => void = () => {};
      const entered = new Promise<void>((resolve) => {
        enterProvider = resolve;
      });
      const providerResponse = new Promise<{ content: string; role: 'assistant' }>(
        (resolve, reject) => {
          finishProvider = resolve;
          rejectProvider = reject;
        },
      );
      const chat = vi.fn(() => {
        enterProvider();
        return providerResponse;
      });
      const execution = handleA2AJsonRpc(
        {
          jsonrpc: '2.0',
          id: 'send-deferred-provider',
          method: 'tasks/send',
          params: { id: taskId, message: userMessage('Run until canceled') },
        },
        'revealui-creator',
        { chat },
      );
      await entered;
      await handleA2AJsonRpc({
        jsonrpc: '2.0',
        id: 'cancel-deferred-provider',
        method: 'tasks/cancel',
        params: { id: taskId },
      });
      if (outcome === 'resolves') {
        finishProvider({ content: 'Provider completed after cancellation', role: 'assistant' });
      } else {
        rejectProvider(new Error('Provider failed after cancellation'));
      }
      const response = await execution;
      expect(response.result).toMatchObject({ status: { state: 'canceled' } });
      expect((response.result as { artifacts?: unknown[] }).artifacts ?? []).toHaveLength(0);
    },
  );

  it('fails unsupported empty input without calling the configured provider', async () => {
    trackTaskId('rpc-empty-task');
    const chat = vi.fn();
    const response = await handleA2AJsonRpc(
      {
        jsonrpc: '2.0',
        id: 'rpc-empty-task',
        method: 'tasks/send',
        params: { id: 'rpc-empty-task', message: userMessage('   ') },
      },
      'revealui-creator',
      { chat } as never,
    );
    expect(response.result).toMatchObject({ status: { state: 'failed' } });
    expect(chat).not.toHaveBeenCalled();
    expect((response.result as { artifacts?: unknown[] }).artifacts ?? []).toHaveLength(0);
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
        message: 'Task not found',
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
      { chat: vi.fn().mockResolvedValue({ content: 'Actual paid execution' }) } as never,
      { paymentVerified: true },
    );

    expect(response.error).toBeUndefined();
    expect(response.result).toMatchObject({
      id: 'rpc-paid-verified',
      status: { state: 'completed' },
    });
  });
});
