/**
 * Agent Runtime
 *
 * Interactive tool loop (`executeTask`). Intentionally separate from
 * `runGovernedTask` (governed receipts in `@revealui/apify-actor-governed-run`):
 * receipts need an ordered action log and hard step caps; this runtime stays
 * an open loop. Do not merge them.
 *
 * When the RevDev harness socket is reachable, each task arms Studio LoopGuard
 * and ticks once per model iteration. No daemon means no tick and no throw.
 */

import { registerCleanupHandler } from '@revealui/core/monitoring';
import type { LLMClient } from '../llm/client.js';
import type { LLMResponse, Message, ReasoningEffort } from '../llm/providers/base.js';
import { estimateCost } from '../llm/token-counter.js';
import { toolParametersToJsonSchema } from '../llm/tool-json-schema.js';
import type { AgentSkillProvider } from '../skills/integration/agent-skill-provider.js';
import type { ApprovalCallback, Tool, ToolResult } from '../tools/base.js';
import { ToolCallDeduplicator } from '../tools/deduplicator.js';
import { createToolsFromMcpClient, type McpClientLike } from '../tools/mcp-adapter.js';
import type { McpToolCallEvent } from '../tools/mcp-events.js';
import { createWebSearchTool } from '../tools/web/duck-duck-go.js';
import type { Agent, AgentResult, Task } from './agent.js';
import {
  createDaemonLoopGuard,
  iterationAdvanced,
  type LoopGuardPort,
  type LoopGuardTickInput,
  studioLoopId,
} from './loop-guard.js';

export type { LoopGuardPort, LoopGuardSignal, LoopGuardTickInput } from './loop-guard.js';
export {
  createDaemonLoopGuard,
  DAEMON_LOOP_INTERVAL_MS,
  DAEMON_LOOP_NOOP_LIMIT,
  DAEMON_LOOP_TIMEOUT_MS,
  iterationAdvanced,
  PRODUCT_RUNTIME_ACTOR_ID,
  studioLoopId,
} from './loop-guard.js';

/**
 * Reasoning-depth hint for a task. Alias of the neutral `ReasoningEffort` — the agnostic
 * Reasoner port's control vocabulary. Mapping a level to a provider's native control
 * (e.g. a thinking-token budget) is the adapter's job; a provider that advertises
 * `reasoningEffort: false` treats it as a no-op.
 */
export type ThinkingLevel = ReasoningEffort;

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
   * GAP-355 integrity audit for MCP tools discovered at run time.
   * Passed into `createToolsFromMcpClient` so library consumers (not only
   * agent-stream) fail closed when a receipt cannot land.
   */
  onToolAudit?: (event: McpToolCallEvent) => void | Promise<void>;
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
  /**
   * Studio LoopGuard (GAP-362). Default: `loop.arm` / `loop.tick` / `loop.stop`
   * on the RevDev harness socket when it is reachable. Missing socket, connect
   * failure, and RPC timeout leave the task on the unwired path (no throw).
   * Pass `false` to skip the daemon even when Studio is attached.
   * `runGovernedTask` does not use this port; receipts stay a separate loop.
   */
  loopGuard?: LoopGuardPort | false;
}

export class AgentRuntime {
  protected config: RuntimeConfig;
  private readonly loopGuard: LoopGuardPort | null;
  private taskQueue: Task[] = [];
  private executingTasks: Map<string, Promise<AgentResult>> = new Map();
  private isShuttingDown = false;

  constructor(config: RuntimeConfig = {}) {
    this.loopGuard =
      config.loopGuard === false ? null : (config.loopGuard ?? createDaemonLoopGuard());
    this.config = {
      maxIterations: config.maxIterations ?? 10,
      timeout: config.timeout ?? 60000, // 60 seconds
      retryOnError: config.retryOnError ?? true,
      maxRetries: config.maxRetries ?? 3,
      enableCache: config.enableCache ?? true, // Enable by default for cost savings
      mcpClients: config.mcpClients,
      onToolAudit: config.onToolAudit,
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
    const loopId = await this.openStudioLoop(task.id);
    try {
      // Merge MCP-discovered tools into the agent's tool set via `McpClient`.
      const mcpTools: Tool[] = [];
      const onToolAudit = this.config.onToolAudit;
      if (this.config.mcpClients && this.config.mcpClients.length > 0) {
        for (const { name, client } of this.config.mcpClients) {
          try {
            const fromClient = await createToolsFromMcpClient(client, {
              namespace: name,
              ...(onToolAudit !== undefined ? { onToolAudit } : {}),
            });
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
          // Cache agent instructions for cost savings (effective where promptCache is supported)
          cache: this.config.enableCache || undefined,
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

          // Get LLM response (with caching for agent instructions and tools)
          const response = await llmClient.chat(messages, {
            tools: allTools.map((tool) => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: toolParametersToJsonSchema(tool.parameters),
              },
            })),
            cacheHint: this.config.enableCache,
            effort: this.config.thinkingLevel,
          });

          // Accumulate token usage and cost
          const iterationTokens = response.usage?.totalTokens ?? 0;
          totalTokens += iterationTokens;
          const model = this.config.model;
          const spend = iterationSpend(response, model, iterationTokens);
          if (spend.costUsd > 0) {
            totalCostUsd += spend.costUsd;
          }

          // Add assistant response to messages
          messages.push({
            role: 'assistant',
            content: response.content,
            toolCalls: response.toolCalls || [],
          });

          // If no tool calls, task is complete
          if (!response.toolCalls || response.toolCalls.length === 0) {
            const stopReason = await this.tickStudioLoop(loopId, {
              advanced: iterationAdvanced({ completed: true, newToolExecutions: 0 }),
              ...spend.tick,
            });
            if (stopReason) {
              return {
                success: false,
                error: stopReason,
                toolResults,
                metadata: {
                  executionTime: Date.now() - startTime,
                  tokensUsed: totalTokens,
                  cost: totalCostUsd,
                },
              };
            }
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
          let newToolExecutions = 0;
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
                  newToolExecutions += 1;
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
              if (!cached) {
                deduplicator.record(tool.name, params, result);
                newToolExecutions += 1;
              }

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
              newToolExecutions += 1;
              toolResults.push({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          const stopReason = await this.tickStudioLoop(loopId, {
            advanced: iterationAdvanced({ completed: false, newToolExecutions }),
            ...spend.tick,
          });
          if (stopReason) {
            return {
              success: false,
              error: stopReason,
              toolResults,
              metadata: {
                executionTime: Date.now() - startTime,
                tokensUsed: totalTokens,
                cost: totalCostUsd,
              },
            };
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
    } finally {
      await this.closeStudioLoop(loopId);
    }
  }

  /**
   * Arm LoopGuard for this task when Studio's daemon answers.
   * Returns null when the daemon is absent or the call fails open.
   */
  protected async openStudioLoop(taskId: string): Promise<string | null> {
    if (!this.loopGuard) return null;
    const loopId = studioLoopId(taskId);
    try {
      const signal = await this.loopGuard.arm({ loopId });
      return signal.attached ? loopId : null;
    } catch {
      return null;
    }
  }

  /**
   * Report one model iteration. A non-null return is the daemon stop signal
   * (`not_advancing` after the daemon no-op limit, default 3).
   */
  protected async tickStudioLoop(
    loopId: string | null,
    tick: LoopGuardTickInput,
  ): Promise<string | null> {
    if (!(loopId && this.loopGuard)) return null;
    try {
      const signal = await this.loopGuard.tick({ loopId, ...tick });
      if (!signal.attached) return null;
      if (signal.status === 'not_advancing' || signal.status === 'stopped') {
        return signal.signal ?? 'loop not advancing';
      }
      return null;
    } catch {
      return null;
    }
  }

  protected async closeStudioLoop(loopId: string | null): Promise<void> {
    if (!(loopId && this.loopGuard)) return;
    try {
      await this.loopGuard.stop(loopId);
    } catch {
      /* fail-open: ending the task must not throw when the daemon drops */
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

interface IterationSpend {
  readonly costUsd: number;
  readonly tick: Pick<LoopGuardTickInput, 'tokensIn' | 'tokensOut' | 'costMicros'>;
}

function iterationSpend(
  response: LLMResponse,
  model: string | undefined,
  iterationTokens: number,
): IterationSpend {
  const tokensIn =
    response.usage?.promptTokens ?? (iterationTokens > 0 ? Math.floor(iterationTokens * 0.7) : 0);
  const tokensOut =
    response.usage?.completionTokens ??
    (iterationTokens > 0 ? Math.max(0, iterationTokens - tokensIn) : 0);
  let costUsd = 0;
  if (model && iterationTokens > 0) {
    costUsd =
      estimateCost(tokensIn, model, 'input').estimatedCostUsd +
      estimateCost(tokensOut, model, 'output').estimatedCostUsd;
  }
  const costMicros = costUsd > 0 ? Math.round(costUsd * 1_000_000) : 0;
  return {
    costUsd,
    tick: {
      ...(tokensIn > 0 ? { tokensIn } : {}),
      ...(tokensOut > 0 ? { tokensOut } : {}),
      ...(costMicros > 0 ? { costMicros } : {}),
    },
  };
}
