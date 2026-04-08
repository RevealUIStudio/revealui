/**
 * Tests for the human approval flow in AgentRuntime.
 *
 * Uses a minimal mock LLM client to verify approval gate behavior
 * without making real API calls.
 */

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { LLMClient } from '../../../llm/client.js';
import type { LLMResponse } from '../../../llm/providers/base.js';
import type { Agent, Task } from '../../../orchestration/agent.js';
import { AgentRuntime } from '../../../orchestration/runtime.js';
import type { ApprovalCallback, ApprovalRequest, Tool, ToolResult } from '../../../tools/base.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-approval');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

// ---- Helpers ----

function createMockTool(name: string, opts?: { requiresApproval?: boolean }): Tool {
  return {
    name,
    label: name.replace(/_/g, ' '),
    description: `Mock tool: ${name}`,
    requiresApproval: opts?.requiresApproval,
    parameters: z.object({ target: z.string().optional() }),
    async execute(): Promise<ToolResult> {
      return { success: true, data: { called: true }, content: `${name} executed` };
    },
  };
}

function createMockAgent(tools: Tool[]): Agent {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    tools,
    getContext: () => ({ agentId: 'test-agent' }),
  };
}

function createTask(description = 'test task'): Task {
  return { id: 'task-1', type: 'test', description };
}

/**
 * Creates a mock LLM client that returns one tool call on the first request,
 * then a final text response on the second.
 */
function createMockLLM(toolName: string, toolArgs: Record<string, unknown> = {}): LLMClient {
  let callCount = 0;
  return {
    chat: vi.fn(async (): Promise<LLMResponse> => {
      callCount++;
      if (callCount === 1) {
        return {
          content: '',
          role: 'assistant',
          toolCalls: [
            {
              id: 'tc-1',
              type: 'function',
              function: { name: toolName, arguments: JSON.stringify(toolArgs) },
            },
          ],
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };
      }
      return {
        content: 'Done.',
        role: 'assistant',
        usage: { promptTokens: 200, completionTokens: 30, totalTokens: 230 },
      };
    }),
  } as unknown as LLMClient;
}

// ---- Tests ----

describe('approval flow', () => {
  it('executes tool normally when no approval required', async () => {
    const tool = createMockTool('safe_read');
    const agent = createMockAgent([tool]);
    const runtime = new AgentRuntime({ maxIterations: 5 });
    const llm = createMockLLM('safe_read');

    const result = await runtime.executeTask(agent, createTask(), llm);
    expect(result.success).toBe(true);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults?.[0]?.success).toBe(true);
  });

  it('denies tool when approval required but no callback configured', async () => {
    const tool = createMockTool('dangerous_write', { requiresApproval: true });
    const agent = createMockAgent([tool]);
    const runtime = new AgentRuntime({ maxIterations: 5 });
    const llm = createMockLLM('dangerous_write');

    const result = await runtime.executeTask(agent, createTask(), llm);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults?.[0]?.success).toBe(false);
    expect(result.toolResults?.[0]?.error).toContain('requires human approval');
  });

  it('executes tool when approval callback approves', async () => {
    const tool = createMockTool('dangerous_write', { requiresApproval: true });
    const agent = createMockAgent([tool]);
    const approvalCallback: ApprovalCallback = vi.fn(async () => ({ approved: true }));
    const runtime = new AgentRuntime({ maxIterations: 5, approvalCallback });
    const llm = createMockLLM('dangerous_write');

    const result = await runtime.executeTask(agent, createTask(), llm);
    expect(approvalCallback).toHaveBeenCalledOnce();
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults?.[0]?.success).toBe(true);
  });

  it('denies tool when approval callback rejects', async () => {
    const tool = createMockTool('dangerous_write', { requiresApproval: true });
    const agent = createMockAgent([tool]);
    const approvalCallback: ApprovalCallback = vi.fn(async () => ({
      approved: false,
      reason: 'User chose not to proceed',
    }));
    const runtime = new AgentRuntime({ maxIterations: 5, approvalCallback });
    const llm = createMockLLM('dangerous_write');

    const result = await runtime.executeTask(agent, createTask(), llm);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults?.[0]?.success).toBe(false);
    expect(result.toolResults?.[0]?.error).toContain('User chose not to proceed');
  });

  it('passes correct ApprovalRequest to callback', async () => {
    const tool = createMockTool('deploy_production', { requiresApproval: true });
    const agent = createMockAgent([tool]);
    let capturedRequest: ApprovalRequest | undefined;
    const approvalCallback: ApprovalCallback = vi.fn(async (req) => {
      capturedRequest = req;
      return { approved: true };
    });
    const runtime = new AgentRuntime({ maxIterations: 5, approvalCallback });
    const llm = createMockLLM('deploy_production', { target: 'prod' });

    await runtime.executeTask(agent, createTask(), llm);
    expect(capturedRequest).toBeDefined();
    expect(capturedRequest?.toolName).toBe('deploy_production');
    expect(capturedRequest?.toolLabel).toBe('deploy production');
    expect(capturedRequest?.params).toEqual({ target: 'prod' });
    expect(capturedRequest?.description).toContain('deploy production');
  });

  it('enforces alwaysRequireApproval even for tools without the flag', async () => {
    const tool = createMockTool('file_write'); // no requiresApproval
    const agent = createMockAgent([tool]);
    const approvalCallback: ApprovalCallback = vi.fn(async () => ({
      approved: false,
      reason: 'Blocked by policy',
    }));
    const runtime = new AgentRuntime({
      maxIterations: 5,
      approvalCallback,
      alwaysRequireApproval: ['file_write'],
    });
    const llm = createMockLLM('file_write');

    const result = await runtime.executeTask(agent, createTask(), llm);
    expect(approvalCallback).toHaveBeenCalledOnce();
    expect(result.toolResults?.[0]?.success).toBe(false);
    expect(result.toolResults?.[0]?.error).toContain('Blocked by policy');
  });

  it('does not require approval for tools not in alwaysRequireApproval list', async () => {
    const readTool = createMockTool('file_read');
    const writeTool = createMockTool('file_write');
    const agent = createMockAgent([readTool, writeTool]);
    const approvalCallback: ApprovalCallback = vi.fn(async () => ({ approved: true }));
    const runtime = new AgentRuntime({
      maxIterations: 5,
      approvalCallback,
      alwaysRequireApproval: ['file_write'], // only file_write needs approval
    });
    const llm = createMockLLM('file_read'); // calling file_read, not file_write

    await runtime.executeTask(agent, createTask(), llm);
    // Approval callback should NOT be called for file_read
    expect(approvalCallback).not.toHaveBeenCalled();
  });
});
