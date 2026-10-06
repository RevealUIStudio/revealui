/**
 * Governed tool-execution contract.
 *
 * The same four cases run against AgentRuntime.executeTask and
 * StreamingAgentRuntime.streamTask so the approval and audit paths cannot drift.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

vi.mock('@revealui/core/monitoring', () => ({
  registerCleanupHandler: vi.fn(),
  unregisterCleanupHandler: vi.fn(),
}));

vi.mock('../../tools/mcp-adapter.js', () => ({
  createToolsFromMcpClient: vi.fn().mockResolvedValue([]),
}));

import type { LLMClient } from '../../llm/client.js';
import type { LLMChunk, LLMResponse } from '../../llm/providers/base.js';
import { approvalConfigFromAgentSecurity, createAgentSpec } from '../../templates/agent-spec.js';
import type { ApprovalCallback, Tool, ToolResult } from '../../tools/base.js';
import type { McpToolCallEvent } from '../../tools/mcp-events.js';
import type { Agent, Task } from '../agent.js';
import { AgentRuntime } from '../runtime.js';
import { type AgentStreamChunk, StreamingAgentRuntime } from '../streaming-runtime.js';

interface AuditRecord {
  toolName: string;
  success: boolean;
  decision?: string;
  error?: string;
}

function makeTool(execute: ReturnType<typeof vi.fn>): Tool {
  return {
    name: 'dangerous_write',
    label: 'dangerous write',
    description: 'Writes a file',
    requiresApproval: true,
    parameters: z.object({ target: z.string().optional() }),
    execute,
  };
}

function makeAgent(tool: Tool): Agent {
  return {
    id: 'contract-agent',
    name: 'Contract Agent',
    instructions: 'You are a test agent.',
    tools: [tool],
    getContext: () => ({ agentId: 'contract-agent' }),
  };
}

function makeTask(): Task {
  return { id: 'task-contract', type: 'test', description: 'run the governed tool' };
}

function chatClient(): LLMClient {
  let callCount = 0;
  return {
    chat: vi.fn(async (): Promise<LLMResponse> => {
      callCount += 1;
      if (callCount === 1) {
        return {
          content: '',
          role: 'assistant',
          toolCalls: [
            {
              id: 'tc-1',
              type: 'function',
              function: { name: 'dangerous_write', arguments: '{"target":"notes.txt"}' },
            },
          ],
        };
      }
      return { content: 'Done.', role: 'assistant' };
    }),
  } as unknown as LLMClient;
}

async function* chunkGen(chunks: LLMChunk[]): AsyncIterable<LLMChunk> {
  for (const chunk of chunks) yield chunk;
}

function streamClient(): LLMClient {
  const first: LLMChunk[] = [
    {
      content: '',
      done: true,
      toolCalls: [
        {
          id: 'tc-1',
          type: 'function',
          function: { name: 'dangerous_write', arguments: '{"target":"notes.txt"}' },
        },
      ],
    },
  ];
  const second: LLMChunk[] = [{ content: 'Done.', done: true }];
  const stream = vi.fn().mockReturnValueOnce(chunkGen(first)).mockReturnValueOnce(chunkGen(second));
  return { stream } as unknown as LLMClient;
}

async function collect(gen: AsyncGenerator<AgentStreamChunk>): Promise<AgentStreamChunk[]> {
  const chunks: AgentStreamChunk[] = [];
  for await (const chunk of gen) chunks.push(chunk);
  return chunks;
}

interface CaseInput {
  approvalCallback?: ApprovalCallback;
  onToolAudit: (event: McpToolCallEvent) => void | Promise<void>;
}

async function runAgent(tool: Tool, input: CaseInput): Promise<void> {
  const runtime = new AgentRuntime({
    maxIterations: 4,
    loopGuard: false,
    ...(input.approvalCallback ? { approvalCallback: input.approvalCallback } : {}),
    onToolAudit: input.onToolAudit,
  });
  await runtime.executeTask(makeAgent(tool), makeTask(), chatClient());
}

async function runStream(tool: Tool, input: CaseInput): Promise<AgentStreamChunk[]> {
  const runtime = new StreamingAgentRuntime({
    maxIterations: 4,
    loopGuard: false,
    ...(input.approvalCallback ? { approvalCallback: input.approvalCallback } : {}),
    onToolAudit: input.onToolAudit,
  });
  return collect(runtime.streamTask(makeAgent(tool), makeTask(), streamClient()));
}

const cases = [
  {
    name: 'AgentRuntime',
    run: async (tool: Tool, input: CaseInput): Promise<AgentStreamChunk[] | undefined> => {
      await runAgent(tool, input);
      return undefined;
    },
  },
  {
    name: 'StreamingAgentRuntime',
    run: async (tool: Tool, input: CaseInput): Promise<AgentStreamChunk[] | undefined> =>
      runStream(tool, input),
  },
] as const;

describe('governed tool contract', () => {
  describe.each(cases)('$name', ({ name, run }) => {
    it('blocks an approval-required tool when no callback is configured', async () => {
      const execute = vi.fn(
        async (): Promise<ToolResult> => ({ success: true, data: { ran: true } }),
      );
      const audits: AuditRecord[] = [];
      const chunks = await run(makeTool(execute), {
        onToolAudit: async (event) => {
          audits.push(event as AuditRecord);
        },
      });

      expect(execute).not.toHaveBeenCalled();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        toolName: 'dangerous_write',
        success: false,
        decision: 'approval_required',
      });
      expect(audits[0]?.error).toContain('requires human approval');

      if (name === 'StreamingAgentRuntime') {
        const result = chunks?.find((chunk) => chunk.type === 'tool_call_result');
        expect(result?.approval).toBe('required');
        expect(result?.toolResult?.success).toBe(false);
        expect(result?.toolResult?.error).toContain('requires human approval');
        expect(chunks?.some((chunk) => chunk.type === 'error')).toBe(false);
        expect(chunks?.some((chunk) => chunk.type === 'done')).toBe(true);
      }
    });

    it('blocks when the approval callback denies', async () => {
      const execute = vi.fn(async (): Promise<ToolResult> => ({ success: true }));
      const audits: AuditRecord[] = [];
      const approvalCallback: ApprovalCallback = vi.fn(async () => ({
        approved: false,
        reason: 'User chose not to proceed',
      }));
      const chunks = await run(makeTool(execute), {
        approvalCallback,
        onToolAudit: async (event) => {
          audits.push(event as AuditRecord);
        },
      });

      expect(approvalCallback).toHaveBeenCalledOnce();
      expect(execute).not.toHaveBeenCalled();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        toolName: 'dangerous_write',
        success: false,
        decision: 'denied',
      });
      expect(audits[0]?.error).toContain('User chose not to proceed');

      if (name === 'StreamingAgentRuntime') {
        const result = chunks?.find((chunk) => chunk.type === 'tool_call_result');
        expect(result?.approval).toBe('denied');
        expect(result?.toolResult?.success).toBe(false);
        expect(result?.toolResult?.error).toContain('User chose not to proceed');
        expect(chunks?.some((chunk) => chunk.type === 'error')).toBe(false);
      }
    });

    it('executes when the approval callback approves', async () => {
      const execute = vi.fn(
        async (): Promise<ToolResult> => ({
          success: true,
          content: 'wrote notes.txt',
        }),
      );
      const audits: AuditRecord[] = [];
      const approvalCallback: ApprovalCallback = vi.fn(async () => ({ approved: true }));
      const chunks = await run(makeTool(execute), {
        approvalCallback,
        onToolAudit: async (event) => {
          audits.push(event as AuditRecord);
        },
      });

      expect(approvalCallback).toHaveBeenCalledOnce();
      expect(execute).toHaveBeenCalledOnce();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        toolName: 'dangerous_write',
        success: true,
        decision: 'allowed',
      });

      if (name === 'StreamingAgentRuntime') {
        const result = chunks?.find((chunk) => chunk.type === 'tool_call_result');
        expect(result?.approval).toBeUndefined();
        expect(result?.toolResult?.success).toBe(true);
        expect(chunks?.some((chunk) => chunk.type === 'done')).toBe(true);
      }
    });
  });
});

describe('requiresHumanApproval mapping', () => {
  it('copies AgentSecuritySchema.requiresHumanApproval into runtime config that blocks the tool', async () => {
    const spec = createAgentSpec({
      id: 'spec-agent',
      name: 'Spec Agent',
      version: '1.0.0',
      description: 'Checks approval mapping from the agent spec.',
      instructions: 'You are a test agent with a security policy.',
      owner: 'test',
      permissions: { allowedTools: ['dangerous_write'] },
      security: { requiresHumanApproval: ['dangerous_write'] },
    });
    const mapped = approvalConfigFromAgentSecurity(spec.security);
    expect(mapped.requiresHumanApproval).toEqual(['dangerous_write']);

    const execute = vi.fn(async (): Promise<ToolResult> => ({ success: true }));
    const tool: Tool = {
      name: 'dangerous_write',
      description: 'Writes a file',
      parameters: z.object({}),
      execute,
    };
    const agent = makeAgent(tool);

    const agentRuntime = new AgentRuntime({
      maxIterations: 4,
      loopGuard: false,
      ...mapped,
    });
    const agentResult = await agentRuntime.executeTask(agent, makeTask(), chatClient());
    expect(execute).not.toHaveBeenCalled();
    expect(agentResult.toolResults?.[0]?.success).toBe(false);
    expect(agentResult.toolResults?.[0]?.error).toContain('requires human approval');

    const streamRuntime = new StreamingAgentRuntime({
      maxIterations: 4,
      loopGuard: false,
      ...mapped,
    });
    const chunks = await collect(streamRuntime.streamTask(agent, makeTask(), streamClient()));
    expect(execute).not.toHaveBeenCalled();
    const result = chunks.find((chunk) => chunk.type === 'tool_call_result');
    expect(result?.approval).toBe('required');
    expect(result?.toolResult?.error).toContain('requires human approval');
  });
});
