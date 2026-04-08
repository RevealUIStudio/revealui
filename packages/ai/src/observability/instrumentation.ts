/**
 * @revealui/ai - Instrumentation Utilities
 *
 * Helper functions and wrappers for instrumenting agent operations with observability.
 */

import type { Agent, AgentResult, Task } from '../orchestration/agent.js';
import type { Tool, ToolResult } from '../tools/base.js';
import type { AgentEventLogger } from './logger.js';

/**
 * Wrap a tool execution with observability logging
 */
export function instrumentTool(
  tool: Tool,
  logger: AgentEventLogger,
  agentId: string,
  sessionId: string,
): Tool {
  return {
    ...tool,
    execute: async (params: unknown): Promise<ToolResult> => {
      const startTime = Date.now();

      try {
        const result = await tool.execute(params);
        const durationMs = Date.now() - startTime;

        // Log tool call
        logger.logToolCall({
          timestamp: Date.now(),
          agentId,
          sessionId,
          toolName: tool.name,
          params: params as Record<string, unknown>,
          result: result.data,
          durationMs,
          success: result.success,
          errorMessage: result.error,
        });

        return result;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Log failed tool call
        logger.logToolCall({
          timestamp: Date.now(),
          agentId,
          sessionId,
          toolName: tool.name,
          params: params as Record<string, unknown>,
          durationMs,
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        // Log error event
        logger.logError({
          timestamp: Date.now(),
          agentId,
          sessionId,
          message: `Tool execution failed: ${tool.name}`,
          stack: error instanceof Error ? error.stack : undefined,
          recoverable: true,
          errorCode: 'TOOL_EXECUTION_ERROR',
          context: { toolName: tool.name, params },
        });

        throw error;
      }
    },
  };
}

/**
 * Wrap an agent with observability logging
 */
export function instrumentAgent(
  agent: Agent,
  logger: AgentEventLogger,
): Agent & { logger: AgentEventLogger } {
  return {
    ...agent,
    logger,
    // Agent interface methods would be instrumented here
    // This is a placeholder as the Agent interface may vary
  };
}

/**
 * Instrument a task delegation decision
 */
export function logTaskDelegation(
  logger: AgentEventLogger,
  task: Task,
  selectedAgent: Agent,
  reasoning: string,
  confidence?: number,
): void {
  logger.logDecision({
    timestamp: Date.now(),
    agentId: selectedAgent.id,
    sessionId: task.sessionId,
    taskId: task.id,
    reasoning,
    chosenTool: selectedAgent.name,
    confidence,
    context: {
      taskType: task.type,
      taskDescription: task.description,
    },
  });
}

/**
 * Instrument task execution
 */
export async function instrumentTaskExecution<T extends AgentResult>(
  logger: AgentEventLogger,
  task: Task,
  agentId: string,
  executor: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await executor();
    const durationMs = Date.now() - startTime;

    // Log as a tool call (task execution is essentially a tool)
    logger.logToolCall({
      timestamp: Date.now(),
      agentId,
      sessionId: task.sessionId,
      taskId: task.id,
      toolName: `task:${task.type}`,
      params: task.input as Record<string, unknown>,
      result: result.output,
      durationMs,
      success: result.success,
      errorMessage: result.error,
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    logger.logError({
      timestamp: Date.now(),
      agentId,
      sessionId: task.sessionId,
      taskId: task.id,
      message: `Task execution failed: ${task.type}`,
      stack: error instanceof Error ? error.stack : undefined,
      recoverable: false,
      errorCode: 'TASK_EXECUTION_ERROR',
      context: {
        taskType: task.type,
        durationMs,
      },
    });

    throw error;
  }
}

/**
 * Instrument LLM call with token counting
 */
export interface LLMCallOptions {
  provider: string;
  model: string;
  agentId: string;
  sessionId: string;
  taskId?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cacheHit?: boolean;
}

export async function instrumentLLMCall<T extends LLMResponse>(
  logger: AgentEventLogger,
  options: LLMCallOptions,
  executor: () => Promise<T>,
  costCalculator?: (usage: T['usage']) => number,
): Promise<T> {
  const startTime = Date.now();

  try {
    const response = await executor();
    const durationMs = Date.now() - startTime;
    const cost = costCalculator ? costCalculator(response.usage) : undefined;

    logger.logLLMCall({
      timestamp: Date.now(),
      agentId: options.agentId,
      sessionId: options.sessionId,
      taskId: options.taskId,
      provider: options.provider,
      model: options.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      durationMs,
      cost,
      cacheHit: response.cacheHit,
    });

    return response;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    logger.logError({
      timestamp: Date.now(),
      agentId: options.agentId,
      sessionId: options.sessionId,
      taskId: options.taskId,
      message: `LLM call failed: ${options.provider}/${options.model}`,
      stack: error instanceof Error ? error.stack : undefined,
      recoverable: true,
      errorCode: 'LLM_CALL_ERROR',
      context: {
        provider: options.provider,
        model: options.model,
        durationMs,
      },
    });

    throw error;
  }
}

/**
 * Cost calculators for popular LLM providers
 */
export const LLMCostCalculators = {
  /**
   * OpenAI cost calculator
   * Prices as of 2024 (per 1M tokens)
   */
  openai: (model: string, usage: { promptTokens: number; completionTokens: number }) => {
    const prices: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo': { input: 10, output: 30 },
      'gpt-4': { input: 30, output: 60 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    };

    const price = prices[model] || prices['gpt-3.5-turbo'];
    return (
      (usage.promptTokens / 1_000_000) * price.input +
      (usage.completionTokens / 1_000_000) * price.output
    );
  },

  /**
   * Anthropic cost calculator
   * Prices as of 2024 (per 1M tokens)
   */
  anthropic: (model: string, usage: { promptTokens: number; completionTokens: number }) => {
    const prices: Record<string, { input: number; output: number }> = {
      'claude-3-opus': { input: 15, output: 75 },
      'claude-3-sonnet': { input: 3, output: 15 },
      'claude-3-haiku': { input: 0.25, output: 1.25 },
    };

    const price = prices[model] || prices['claude-3-sonnet'];
    return (
      (usage.promptTokens / 1_000_000) * price.input +
      (usage.completionTokens / 1_000_000) * price.output
    );
  },
};
