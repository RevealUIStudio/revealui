/* console-allowed */

/**
 * @revealui/ai - Observability Examples
 *
 * Complete examples showing how to integrate observability into agent operations.
 */

import { z } from 'zod';
import type { Agent, Task } from '../orchestration/agent.js';
import { AgentOrchestrator } from '../orchestration/orchestrator.js';
import type { Tool, ToolResult } from '../tools/base.js';
import { ToolRegistry } from '../tools/registry.js';
import { AgentEventLogger, AgentMetricsCollector, FileSystemEventStorage } from './index.js';
import {
  instrumentLLMCall,
  instrumentTaskExecution,
  instrumentTool,
  LLMCostCalculators,
  type LLMResponse,
  logTaskDelegation,
} from './instrumentation.js';

// ============================================================================
// Example 1: Observable Tool Registry
// ============================================================================

export class ObservableToolRegistry extends ToolRegistry {
  private logger: AgentEventLogger;
  private agentId: string;
  private sessionId: string;

  constructor(logger: AgentEventLogger, agentId: string, sessionId: string) {
    super();
    this.logger = logger;
    this.agentId = agentId;
    this.sessionId = sessionId;
  }

  /**
   * Register a tool with automatic instrumentation
   */
  override register(tool: Tool): void {
    const instrumentedTool = instrumentTool(tool, this.logger, this.agentId, this.sessionId);
    super.register(instrumentedTool);
  }

  /**
   * Execute tool with automatic logging
   */
  override async execute(name: string, params: unknown): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const result = await super.execute(name, params);
      const durationMs = Date.now() - startTime;

      this.logger.logToolCall({
        timestamp: Date.now(),
        agentId: this.agentId,
        sessionId: this.sessionId,
        toolName: name,
        params: params as Record<string, unknown>,
        result: result.data,
        durationMs,
        success: result.success,
        errorMessage: result.error,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.logger.logToolCall({
        timestamp: Date.now(),
        agentId: this.agentId,
        sessionId: this.sessionId,
        toolName: name,
        params: params as Record<string, unknown>,
        durationMs,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}

// ============================================================================
// Example 2: Observable Orchestrator
// ============================================================================

export class ObservableOrchestrator extends AgentOrchestrator {
  private logger: AgentEventLogger;

  constructor(logger: AgentEventLogger, metrics: AgentMetricsCollector) {
    super();
    this.logger = logger;
    this.metrics = metrics;
  }

  /**
   * Delegate task with decision logging
   */
  override async delegateTask(task: Task, preferredAgentId?: string): Promise<unknown> {
    const _startTime = Date.now();

    // Find agent
    let agent: Agent | undefined;
    let reasoning: string;

    if (preferredAgentId) {
      agent = this.getAgent(preferredAgentId);
      reasoning = `User requested agent: ${preferredAgentId}`;
    } else {
      agent = this.getAllAgents()[0]; // Simplified selection
      reasoning = 'Selected first available agent';
    }

    if (!agent) {
      this.logger.logError({
        timestamp: Date.now(),
        agentId: 'orchestrator',
        sessionId: task.sessionId,
        taskId: task.id,
        message: `No agent found for task`,
        recoverable: false,
        errorCode: 'NO_AGENT_FOUND',
      });
      throw new Error('No agent found');
    }

    // Log delegation decision
    logTaskDelegation(this.logger, task, agent, reasoning, 0.95);

    // Execute with instrumentation
    try {
      const result = await instrumentTaskExecution(this.logger, task, agent.id, () =>
        super.delegateTask(task, agent?.id),
      );

      return result;
    } catch (error) {
      this.logger.logError({
        timestamp: Date.now(),
        agentId: agent.id,
        sessionId: task.sessionId,
        taskId: task.id,
        message: 'Task delegation failed',
        stack: error instanceof Error ? error.stack : undefined,
        recoverable: true,
        errorCode: 'DELEGATION_FAILED',
      });
      throw error;
    }
  }
}

// ============================================================================
// Example 3: Observable LLM Client
// ============================================================================

export class ObservableLLMClient {
  private logger: AgentEventLogger;
  private provider: string;
  private model: string;
  private agentId: string;
  private sessionId: string;

  constructor(
    logger: AgentEventLogger,
    provider: string,
    model: string,
    agentId: string,
    sessionId: string,
  ) {
    this.logger = logger;
    this.provider = provider;
    this.model = model;
    this.agentId = agentId;
    this.sessionId = sessionId;
  }

  /**
   * Chat with LLM with automatic logging
   */
  async chat(_messages: Array<{ role: string; content: string }>): Promise<LLMResponse> {
    const costCalc =
      this.provider === 'openai'
        ? (usage: { promptTokens: number; completionTokens: number }) =>
            LLMCostCalculators.openai(this.model, usage)
        : (usage: { promptTokens: number; completionTokens: number }) =>
            LLMCostCalculators.anthropic(this.model, usage);

    return instrumentLLMCall(
      this.logger,
      {
        provider: this.provider,
        model: this.model,
        agentId: this.agentId,
        sessionId: this.sessionId,
      },
      async () => {
        // Simulate LLM call
        // In practice, this would call the actual LLM API
        return {
          content: 'This is a simulated response',
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
          cacheHit: false,
        };
      },
      costCalc,
    );
  }

  /**
   * Stream chat with automatic logging
   */
  async *streamChat(_messages: Array<{ role: string; content: string }>): AsyncGenerator<string> {
    const startTime = Date.now();
    let promptTokens = 0;
    let completionTokens = 0;
    let _content = '';

    try {
      // Simulate streaming
      const chunks = ['This ', 'is ', 'a ', 'streamed ', 'response'];
      for (const chunk of chunks) {
        _content += chunk;
        completionTokens += 10;
        yield chunk;
      }

      // Log after streaming completes
      const durationMs = Date.now() - startTime;
      promptTokens = 100; // Estimated

      const costCalc =
        this.provider === 'openai'
          ? LLMCostCalculators.openai(this.model, { promptTokens, completionTokens })
          : LLMCostCalculators.anthropic(this.model, { promptTokens, completionTokens });

      this.logger.logLLMCall({
        timestamp: Date.now(),
        agentId: this.agentId,
        sessionId: this.sessionId,
        provider: this.provider,
        model: this.model,
        promptTokens,
        completionTokens,
        durationMs,
        cost: costCalc,
        cacheHit: false,
      });
    } catch (error) {
      this.logger.logError({
        timestamp: Date.now(),
        agentId: this.agentId,
        sessionId: this.sessionId,
        message: 'LLM streaming failed',
        stack: error instanceof Error ? error.stack : undefined,
        recoverable: true,
        errorCode: 'LLM_STREAM_ERROR',
      });
      throw error;
    }
  }
}

// ============================================================================
// Example 4: Complete Usage Example
// ============================================================================

export async function completeExample() {
  // Setup observability
  const logger = new AgentEventLogger({
    maxEvents: 5000,
    storage: new FileSystemEventStorage('./logs/agent-events.json'),
    autoFlush: true,
    flushIntervalMs: 300000, // 5 minutes
  });

  const metrics = new AgentMetricsCollector(logger);

  // Create observable components
  const toolRegistry = new ObservableToolRegistry(logger, 'research-agent', 'session-123');

  // Register tools
  toolRegistry.register({
    name: 'search',
    description: 'Search the web',
    parameters: z.object({
      query: z.string(),
    }),
    execute: async (_params: { query: string }) => {
      // Simulate search
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        success: true,
        data: { results: ['Result 1', 'Result 2'] },
      };
    },
  });

  // Create LLM client
  const llmClient = new ObservableLLMClient(
    logger,
    'anthropic',
    'claude-3-sonnet',
    'research-agent',
    'session-123',
  );

  // Execute workflow
  try {
    // 1. Tool call
    const searchResult = await toolRegistry.execute('search', {
      query: 'AI agents',
    });
    console.log('Search result:', searchResult);

    // 2. LLM call
    const llmResponse = await llmClient.chat([
      {
        role: 'user',
        content: 'Summarize these search results',
      },
    ]);
    console.log('LLM response:', llmResponse.content);

    // 3. Get metrics
    const agentMetrics = metrics.getMetrics('research-agent');
    console.log('\nAgent Metrics:');
    console.log(`- Tool calls: ${agentMetrics.totalToolCalls}`);
    console.log(`- LLM calls: ${agentMetrics.totalLLMCalls}`);
    console.log(`- Success rate: ${agentMetrics.successRate.toFixed(2)}%`);
    console.log(`- Total cost: $${agentMetrics.llmMetrics.totalCost.toFixed(4)}`);

    // 4. Get summary
    const summary = metrics.getMetricsSummary();
    console.log('\nSystem Summary:');
    console.log(`- Total events: ${summary.totalEvents}`);
    console.log(`- Active agents: ${summary.activeAgents}`);
    console.log(`- Total tokens: ${summary.totalTokensUsed}`);
  } finally {
    // Cleanup
    await logger.flush();
    logger.destroy();
  }
}

// ============================================================================
// Example 5: Real-time Monitoring
// ============================================================================

export function setupMonitoring(_logger: AgentEventLogger, metrics: AgentMetricsCollector) {
  // Monitor every minute
  const interval = setInterval(() => {
    const summary = metrics.getMetricsSummary();

    // Check for issues
    if (summary.averageSuccessRate < 90) {
      console.warn(`⚠️  Low success rate: ${summary.averageSuccessRate.toFixed(2)}%`);
    }

    if (summary.totalCost > 10) {
      console.warn(`⚠️  High LLM costs: $${summary.totalCost.toFixed(2)}`);
    }

    // Log metrics
    console.log('\n📊 Real-time Metrics:');
    console.log(`- Events: ${summary.totalEvents}`);
    console.log(`- Agents: ${summary.activeAgents}`);
    console.log(`- Sessions: ${summary.activeSessions}`);
    console.log(`- Tokens: ${summary.totalTokensUsed}`);
    console.log(`- Cost: $${summary.totalCost.toFixed(4)}`);
    console.log(`- Success: ${summary.averageSuccessRate.toFixed(2)}%`);
  }, 60000);

  // Cleanup function
  return () => {
    clearInterval(interval);
  };
}

// ============================================================================
// Example 6: Error Recovery Pattern
// ============================================================================

export async function withRetryAndLogging<T>(
  logger: AgentEventLogger,
  agentId: string,
  sessionId: string,
  operation: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.logError({
        timestamp: Date.now(),
        agentId,
        sessionId,
        message: `Operation failed (attempt ${attempt}/${maxRetries})`,
        stack: lastError.stack,
        recoverable: attempt < maxRetries,
        errorCode: 'OPERATION_FAILED',
        context: {
          attempt,
          maxRetries,
        },
      });

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }

  throw lastError ?? new Error('Operation failed after all retries');
}
