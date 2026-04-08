import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Agent, AgentResult, Task } from '../../orchestration/agent.js';
import type { Tool } from '../../tools/base.js';
import {
  instrumentLLMCall,
  instrumentTaskExecution,
  instrumentTool,
  LLMCostCalculators,
  logTaskDelegation,
} from '../instrumentation.js';
import { AgentEventLogger } from '../logger.js';

describe('Instrumentation', () => {
  let logger: AgentEventLogger;

  beforeEach(() => {
    logger = new AgentEventLogger({ maxEvents: 100 });
  });

  describe('instrumentTool', () => {
    it('should log successful tool execution', async () => {
      const mockTool: Tool = {
        name: 'test-tool',
        description: 'Test tool',
        parameters: z.object({ input: z.string() }),
        execute: async (params: { input: string }) => ({
          success: true,
          data: { result: params.input.toUpperCase() },
        }),
      };

      const instrumentedTool = instrumentTool(mockTool, logger, 'agent-1', 'session-1');

      const result = await instrumentedTool.execute({ input: 'hello' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'HELLO' });

      const toolCalls = logger.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe('test-tool');
      expect(toolCalls[0].success).toBe(true);
      expect(toolCalls[0].agentId).toBe('agent-1');
      expect(toolCalls[0].sessionId).toBe('session-1');
    });

    it('should log failed tool execution', async () => {
      const mockTool: Tool = {
        name: 'failing-tool',
        description: 'Tool that fails',
        parameters: z.object({}),
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      };

      const instrumentedTool = instrumentTool(mockTool, logger, 'agent-1', 'session-1');

      await expect(instrumentedTool.execute({})).rejects.toThrow('Tool execution failed');

      const toolCalls = logger.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].success).toBe(false);
      expect(toolCalls[0].errorMessage).toBe('Tool execution failed');

      const errors = logger.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('failing-tool');
    });

    it('should measure execution duration', async () => {
      const mockTool: Tool = {
        name: 'slow-tool',
        description: 'Slow tool',
        parameters: z.object({}),
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { success: true, data: {} };
        },
      };

      const instrumentedTool = instrumentTool(mockTool, logger, 'agent-1', 'session-1');

      await instrumentedTool.execute({});

      const toolCalls = logger.getToolCalls();
      expect(toolCalls[0].durationMs).toBeGreaterThanOrEqual(90); // Account for timer precision (~10ms tolerance)
    });
  });

  describe('instrumentLLMCall', () => {
    it('should log successful LLM call', async () => {
      const mockExecutor = async () => ({
        content: 'Test response',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        cacheHit: false,
      });

      const costCalc = (usage: { promptTokens: number; completionTokens: number }) =>
        (usage.promptTokens + usage.completionTokens) * 0.00001;

      const response = await instrumentLLMCall(
        logger,
        {
          provider: 'test-provider',
          model: 'test-model',
          agentId: 'agent-1',
          sessionId: 'session-1',
          taskId: 'task-1',
        },
        mockExecutor,
        costCalc,
      );

      expect(response.content).toBe('Test response');

      const llmCalls = logger.getLLMCalls();
      expect(llmCalls).toHaveLength(1);
      expect(llmCalls[0].provider).toBe('test-provider');
      expect(llmCalls[0].model).toBe('test-model');
      expect(llmCalls[0].promptTokens).toBe(100);
      expect(llmCalls[0].completionTokens).toBe(50);
      expect(llmCalls[0].cost).toBe(0.0015);
      expect(llmCalls[0].cacheHit).toBe(false);
    });

    it('should log failed LLM call', async () => {
      const mockExecutor = async () => {
        throw new Error('LLM API error');
      };

      await expect(
        instrumentLLMCall(
          logger,
          {
            provider: 'test-provider',
            model: 'test-model',
            agentId: 'agent-1',
            sessionId: 'session-1',
          },
          mockExecutor,
        ),
      ).rejects.toThrow('LLM API error');

      const errors = logger.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('LLM call failed');
      expect(errors[0].context?.provider).toBe('test-provider');
    });

    it('should measure LLM call duration', async () => {
      const mockExecutor = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          content: 'Response',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };
      };

      await instrumentLLMCall(
        logger,
        {
          provider: 'test',
          model: 'test',
          agentId: 'agent-1',
          sessionId: 'session-1',
        },
        mockExecutor,
      );

      const llmCalls = logger.getLLMCalls();
      expect(llmCalls[0].durationMs).toBeGreaterThanOrEqual(90); // Account for timer precision (~10ms tolerance)
    });
  });

  describe('instrumentTaskExecution', () => {
    it('should log successful task execution', async () => {
      const mockTask: Task = {
        id: 'task-1',
        type: 'research',
        description: 'Test task',
        sessionId: 'session-1',
        input: { query: 'test' },
      };

      const mockExecutor = async (): Promise<AgentResult> => ({
        success: true,
        output: { result: 'Done' },
      });

      const result = await instrumentTaskExecution(logger, mockTask, 'agent-1', mockExecutor);

      expect(result.success).toBe(true);

      const toolCalls = logger.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe('task:research');
      expect(toolCalls[0].success).toBe(true);
      expect(toolCalls[0].taskId).toBe('task-1');
    });

    it('should log failed task execution', async () => {
      const mockTask: Task = {
        id: 'task-1',
        type: 'research',
        description: 'Test task',
        sessionId: 'session-1',
        input: {},
      };

      const mockExecutor = async () => {
        throw new Error('Task failed');
      };

      await expect(
        instrumentTaskExecution(logger, mockTask, 'agent-1', mockExecutor),
      ).rejects.toThrow('Task failed');

      const errors = logger.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Task execution failed');
      expect(errors[0].taskId).toBe('task-1');
    });
  });

  describe('logTaskDelegation', () => {
    it('should log task delegation decision', () => {
      const mockTask: Task = {
        id: 'task-1',
        type: 'research',
        description: 'Research task',
        sessionId: 'session-1',
        input: {},
      };

      const mockAgent: Agent = {
        id: 'agent-1',
        name: 'Research Agent',
        description: 'Handles research',
        tools: [],
        systemPrompt: 'You are a researcher',
      };

      logTaskDelegation(logger, mockTask, mockAgent, 'Agent has best tools for research', 0.92);

      const decisions = logger.getDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].agentId).toBe('agent-1');
      expect(decisions[0].sessionId).toBe('session-1');
      expect(decisions[0].taskId).toBe('task-1');
      expect(decisions[0].reasoning).toBe('Agent has best tools for research');
      expect(decisions[0].confidence).toBe(0.92);
      expect(decisions[0].context?.taskType).toBe('research');
    });
  });

  describe('LLMCostCalculators', () => {
    it('should calculate OpenAI costs correctly', () => {
      const usage = { promptTokens: 1000, completionTokens: 500 };

      const gpt4Cost = LLMCostCalculators.openai('gpt-4', usage);
      expect(gpt4Cost).toBeCloseTo(0.06, 4); // $30/1M * 1000 + $60/1M * 500

      const gpt35Cost = LLMCostCalculators.openai('gpt-3.5-turbo', usage);
      expect(gpt35Cost).toBeCloseTo(0.00125, 4); // $0.5/1M * 1000 + $1.5/1M * 500
    });

    it('should calculate Anthropic costs correctly', () => {
      const usage = { promptTokens: 1000, completionTokens: 500 };

      const opusCost = LLMCostCalculators.anthropic('claude-3-opus', usage);
      expect(opusCost).toBeCloseTo(0.0525, 4); // $15/1M * 1000 + $75/1M * 500

      const sonnetCost = LLMCostCalculators.anthropic('claude-3-sonnet', usage);
      expect(sonnetCost).toBeCloseTo(0.0105, 4); // $3/1M * 1000 + $15/1M * 500
    });

    it('should use default pricing for unknown models', () => {
      const usage = { promptTokens: 1000, completionTokens: 500 };

      const unknownCost = LLMCostCalculators.openai('unknown-model', usage);
      const gpt35Cost = LLMCostCalculators.openai('gpt-3.5-turbo', usage);
      expect(unknownCost).toBe(gpt35Cost);
    });
  });
});
