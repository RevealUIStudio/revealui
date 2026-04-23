/**
 * Agent Runtime
 *
 * Executes agent tasks with tool execution, memory management, and error handling
 */

import { registerCleanupHandler } from '@revealui/core/monitoring';
import { z } from 'zod/v4';
import type { LLMClient } from '../llm/client.js';
import type { Message } from '../llm/providers/base.js';
import { estimateCost } from '../llm/token-counter.js';
import type { AgentSkillProvider } from '../skills/integration/agent-skill-provider.js';
import type { ApprovalCallback, Tool, ToolResult } from '../tools/base.js';
import { ToolCallDeduplicator } from '../tools/deduplicator.js';
import type { MCPToolSource, McpClientLike } from '../tools/mcp-adapter.js';
import { createToolsFromMcpClient, discoverMCPTools } from '../tools/mcp-adapter.js';
import { createWebSearchTool } from '../tools/web/duck-duck-go.js';
import type { Agent, AgentResult, Task } from './agent.js';

/**
 * Controls how much of the model's token budget is allocated to internal reasoning.
 * Applies to Anthropic Claude only  -  ignored by other providers.
 *
 * | Level   | Budget (tokens) | Use case                          |
 * |---------|-----------------|-----------------------------------|
 * | off     | 0               | Disabled (default)                |
 * | minimal | 512             | Simple tasks, cost-sensitive      |
 * | low     | 2 048           | Moderate complexity               |
 * | medium  | 8 000           | Multi-step reasoning              |
 * | high    | 16 000          | Complex planning                  |
 * | xhigh   | 31 999          | Maximum depth (expensive)         |
 */
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

const THINKING_BUDGETS: Record<ThinkingLevel, number> = {
  off: 0,
  minimal: 512,
  low: 2048,
  medium: 8000,
  high: 16000,
  xhigh: 31999,
};

export interface RuntimeConfig {
  maxIterations?: number;
  timeout?: number;
  retryOnError?: boolean;
  maxRetries?: number;
  /** Enable prompt caching for Anthropic (90% cost reduction on cache hits) */
  enableCache?: boolean;
  /**
   * Extended thinking depth (Anthropic only).
   * Allocates token budget for internal reasoning before each response.
   * Defaults to 'off'. Trade cost for quality on complex tasks.
   */
  thinkingLevel?: ThinkingLevel;
  /**
   * Optional MCP Hypervisor (or any MCPToolSource). When provided, tools from
   * all healthy MCP servers are merged into the agent's tool set before each
   * task execution. Pass an MCPHypervisor from @revealui/mcp.
   *
   * @deprecated Prefer `mcpClients` (Stage 5.1a). The hypervisor path doesn't
   *   expose the full MCP protocol surface (resources, prompts, sampling,
   *   elicitation). Standard `McpClient` instances do. This field stays for
   *   backwards compatibility and will keep working until a future major.
   */
  mcpToolSource?: MCPToolSource;
  /**
   * Optional set of standard MCP clients (Stage 5.1a). When provided, each
   * client's tools are listed and merged into the agent's tool set before
   * each task. Tool names are namespaced as `mcp_<name>__<toolName>` so
   * multiple clients can coexist without collisions. Consumers construct the
   * client (stdio / Streamable HTTP + OAuth) and pre-connect it before
   * passing it here. The runtime does NOT own client lifecycle.
   *
   * @example
   * ```typescript
   * import { McpClient } from '@revealui/mcp/client';
   *
   * const contentClient = new McpClient({ ... });
   * await contentClient.connect();
   *
   * const runtime = new AgentRuntime({
   *   mcpClients: [{ name: 'content', client: contentClient }],
   * });
   * ```
   */
  mcpClients?: ReadonlyArray<{ name: string; client: McpClientLike }>;
  /**
   * Optional skill provider. When set, activated skills are injected into the
   * system prompt before the first LLM call, giving the agent contextual
   * instructions from the matching skill packages.
   */
  skillProvider?: AgentSkillProvider;
  /**
   * Model tier for context-aware tool result compression.
   * When set, tool results are compressed before entering the message history.
   * Defaults to undefined (no compression).
   */
  modelTier?: import('../inference/context-budget.js').ModelTier;
  /**
   * Model identifier for cost estimation.
   * Must match a key in token-counter MODEL_PRICING (e.g., 'claude-sonnet-4-6').
   * When unset, cost is estimated as $0.
   */
  model?: string;
  /**
   * Callback invoked when a tool with `requiresApproval: true` is called.
   * If not set, tools requiring approval are auto-denied with an error message.
   */
  approvalCallback?: ApprovalCallback;
  /**
   * Additional tool names that always require approval, regardless of the
   * tool's own `requiresApproval` flag. Use to enforce agent-level security
   * policy (e.g., from AgentSecuritySchema.requiresHumanApproval).
   */
  alwaysRequireApproval?: string[];
}

export class AgentRuntime {
  protected config: RuntimeConfig;
  private taskQueue: Task[] = [];
  private executingTasks: Map<string, Promise<AgentResult>> = new Map();
  private isShuttingDown = false;

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      maxIterations: config.maxIterations ?? 10,
      timeout: config.timeout ?? 60000, // 60 seconds
      retryOnError: config.retryOnError ?? true,
      maxRetries: config.maxRetries ?? 3,
      enableCache: config.enableCache ?? true, // Enable by default for cost savings
      mcpToolSource: config.mcpToolSource,
      mcpClients: config.mcpClients,
      skillProvider: config.skillProvider,
      thinkingLevel: config.thinkingLevel,
      modelTier: config.modelTier,
      model: config.model,
      approvalCallback: config.approvalCallback,
      alwaysRequireApproval: config.alwaysRequireApproval,
    };

    // Register cleanup handler
    registerCleanupHandler(
      `ai-runtime-${Date.now()}`,
      () => this.cleanup(),
      'Cleanup AI agent runtime tasks',
      80,
    );
  }

  /**
   * Execute a task with an agent
   */
  async executeTask(agent: Agent, task: Task, llmClient: LLMClient): Promise<AgentResult> {
    const startTime = Date.now();

    // Check if task is already executing
    const existingExecution = this.executingTasks.get(task.id);
    if (existingExecution) {
      return existingExecution;
    }

    // Create execution promise
    const execution = this.runTask(agent, task, llmClient, startTime);
    this.executingTasks.set(task.id, execution);

    try {
      const result = await execution;
      return result;
    } finally {
      this.executingTasks.delete(task.id);
    }
  }

  private async runTask(
    agent: Agent,
    task: Task,
    llmClient: LLMClient,
    startTime: number,
  ): Promise<AgentResult> {
    const toolResults: ToolResult[] = [];
    const deduplicator = new ToolCallDeduplicator();
    let iterations = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    // Merge MCP-discovered tools into the agent's tool set. Two paths:
    //   - Standard `McpClient` instances (Stage 5.1a, preferred)
    //   - `MCPToolSource` / hypervisor (legacy, deprecated but supported)
    const mcpTools: Tool[] = [];
    if (this.config.mcpToolSource) {
      mcpTools.push(...discoverMCPTools(this.config.mcpToolSource));
    }
    if (this.config.mcpClients && this.config.mcpClients.length > 0) {
      for (const { name, client } of this.config.mcpClients) {
        try {
          const fromClient = await createToolsFromMcpClient(client, { namespace: name });
          mcpTools.push(...fromClient);
        } catch {
          // empty-catch-ok: an unhealthy MCP client shouldn't fail the whole task — other clients + base tools still apply
        }
      }
    }

    // Swap in a custom WebSearchProvider if the agent config specifies one (P4-3)
    const customProvider = agent.config?.webSearchProvider;
    let baseTools: Tool[];
    if (customProvider) {
      const customSearchTool = createWebSearchTool(customProvider);
      baseTools = agent.tools.map((t) => (t.name === 'web_search' ? customSearchTool : t));
    } else {
      baseTools = agent.tools;
    }

    const allTools = mcpTools.length > 0 ? [...baseTools, ...mcpTools] : baseTools;

    let messages: Message[] = [
      {
        role: 'system',
        content: agent.instructions,
        // Cache agent instructions for cost savings (Anthropic only)
        cacheControl: this.config.enableCache ? { type: 'ephemeral' } : undefined,
      },
      {
        role: 'user',
        content: task.description,
      },
    ];

    // Inject activated skill instructions into the system prompt.
    if (this.config.skillProvider) {
      const { messages: augmented } = await this.config.skillProvider.injectSkillInstructions(
        messages as Parameters<typeof this.config.skillProvider.injectSkillInstructions>[0],
        { taskDescription: task.description },
      );
      messages = augmented as Message[];
    }

    try {
      while (iterations < (this.config.maxIterations || 10)) {
        iterations++;

        // Check timeout
        if (Date.now() - startTime > (this.config.timeout || 60000)) {
          return {
            success: false,
            error: 'Task execution timeout',
            toolResults,
            metadata: {
              executionTime: Date.now() - startTime,
              tokensUsed: totalTokens,
              cost: totalCostUsd,
            },
          };
        }

        // Resolve thinking budget if a level is configured
        const thinkingBudget =
          this.config.thinkingLevel && this.config.thinkingLevel !== 'off'
            ? THINKING_BUDGETS[this.config.thinkingLevel]
            : undefined;

        // Get LLM response (with caching for agent instructions and tools)
        const response = await llmClient.chat(messages, {
          tools: allTools.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: z.toJSONSchema(tool.parameters) as Record<string, unknown>,
            },
          })),
          enableCache: this.config.enableCache,
          thinkingBudget,
        });

        // Accumulate token usage and cost
        const iterationTokens = response.usage?.totalTokens ?? 0;
        totalTokens += iterationTokens;
        const model = this.config.model;
        if (model && iterationTokens > 0) {
          const inputTokens = response.usage?.promptTokens ?? Math.floor(iterationTokens * 0.7);
          const outputTokens = response.usage?.completionTokens ?? iterationTokens - inputTokens;
          totalCostUsd +=
            estimateCost(inputTokens, model, 'input').estimatedCostUsd +
            estimateCost(outputTokens, model, 'output').estimatedCostUsd;
        }

        // Add assistant response to messages
        messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls || [],
        });

        // If no tool calls, task is complete
        if (!response.toolCalls || response.toolCalls.length === 0) {
          return {
            success: true,
            output: response.content,
            toolResults,
            metadata: {
              executionTime: Date.now() - startTime,
              tokensUsed: totalTokens,
              cost: totalCostUsd,
            },
          };
        }

        // Execute tool calls
        for (const toolCall of response.toolCalls) {
          const tool = allTools.find((t) => t.name === toolCall.function.name);

          if (!tool) {
            toolResults.push({
              success: false,
              error: `Tool "${toolCall.function.name}" not found`,
            });
            continue;
          }

          try {
            const params = JSON.parse(toolCall.function.arguments) as unknown;

            // Check if this tool requires human approval
            const needsApproval =
              tool.requiresApproval || this.config.alwaysRequireApproval?.includes(tool.name);

            if (needsApproval) {
              if (!this.config.approvalCallback) {
                // No approval callback  -  deny by default
                const denied: ToolResult = {
                  success: false,
                  error: `Tool "${tool.label ?? tool.name}" requires human approval but no approval handler is configured.`,
                };
                toolResults.push(denied);
                messages.push({
                  role: 'tool',
                  content: denied.error ?? '',
                  toolCallId: toolCall.id,
                });
                continue;
              }

              const approval = await this.config.approvalCallback({
                toolName: tool.name,
                toolLabel: tool.label,
                params,
                description: `${tool.label ?? tool.name}: ${tool.description}`,
              });

              if (!approval.approved) {
                const denied: ToolResult = {
                  success: false,
                  error: approval.reason
                    ? `Tool "${tool.label ?? tool.name}" denied: ${approval.reason}`
                    : `Tool "${tool.label ?? tool.name}" was denied by the user.`,
                };
                toolResults.push(denied);
                messages.push({
                  role: 'tool',
                  content: denied.error ?? '',
                  toolCallId: toolCall.id,
                });
                continue;
              }
            }

            // Return cached result for duplicate tool calls within this run
            const cached = deduplicator.isDuplicate(tool.name, params)
              ? deduplicator.getResult(tool.name, params)
              : undefined;
            const result = cached ?? (await tool.execute(params));
            if (!cached) deduplicator.record(tool.name, params, result);

            toolResults.push(result);

            // Add tool result to messages.
            // Use result.content (LLM-optimized summary) when available;
            // otherwise serialize the full result so the model has context.
            messages.push({
              role: 'tool',
              content: result.content ?? JSON.stringify(result.data ?? result),
              toolCallId: toolCall.id,
            });
          } catch (error) {
            toolResults.push({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      return {
        success: false,
        error: 'Maximum iterations reached',
        toolResults,
        metadata: {
          executionTime: Date.now() - startTime,
          tokensUsed: totalTokens,
          cost: totalCostUsd,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolResults,
        metadata: {
          executionTime: Date.now() - startTime,
          tokensUsed: totalTokens,
          cost: totalCostUsd,
        },
      };
    }
  }

  /**
   * Add task to queue
   */
  enqueueTask(task: Task): void {
    this.taskQueue.push(task);
  }

  /**
   * Process task queue
   */
  async processQueue(agent: Agent, llmClient: LLMClient): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        const result = await this.executeTask(agent, task, llmClient);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Cleanup runtime resources - cancel executing tasks and clear queue
   */
  async cleanup(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;

    // Clear task queue
    this.taskQueue = [];

    // Wait for executing tasks to complete (with timeout)
    if (this.executingTasks.size > 0) {
      const timeout = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 10_000); // 10 second timeout
      });

      const allTasks = Promise.all(
        Array.from(this.executingTasks.values()).map((task) =>
          task.catch(() => {
            /* Ignore errors during cleanup */
          }),
        ),
      ).then(() => {
        // All tasks completed
      });

      await Promise.race([allTasks, timeout]);
    }

    // Clear executing tasks map
    this.executingTasks.clear();
  }

  /**
   * Get runtime status
   */
  getStatus(): {
    isShuttingDown: boolean;
    queuedTasks: number;
    executingTasks: number;
  } {
    return {
      isShuttingDown: this.isShuttingDown,
      queuedTasks: this.taskQueue.length,
      executingTasks: this.executingTasks.size,
    };
  }
}
