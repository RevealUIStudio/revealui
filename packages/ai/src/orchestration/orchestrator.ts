/**
 * Agent Orchestrator
 *
 * Coordinates multiple agents for complex tasks.
 * Requires an LLM client to execute agent tasks via the runtime.
 */

import type { LLMClient } from '../llm/client.js';
import type { Agent, AgentResult, Task } from './agent.js';
import { AgentRuntime } from './runtime.js';

export interface OrchestrationConfig {
  maxConcurrentAgents?: number;
  taskTimeout?: number;
  retryOnFailure?: boolean;
}

export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private config: OrchestrationConfig;
  private runtime: AgentRuntime;
  private llmClient: LLMClient | null = null;

  constructor(config: OrchestrationConfig = {}) {
    this.config = {
      maxConcurrentAgents: config.maxConcurrentAgents ?? 5,
      taskTimeout: config.taskTimeout ?? 60000,
      retryOnFailure: config.retryOnFailure ?? true,
    };
    this.runtime = new AgentRuntime({
      timeout: this.config.taskTimeout || 60000,
    });
  }

  /**
   * Set the LLM client used for task execution.
   * Must be called before delegateTask() or coordinateAgents().
   */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }

  /**
   * Get the current LLM client (if configured)
   */
  getLLMClient(): LLMClient | null {
    return this.llmClient;
  }

  /**
   * Register an agent
   */
  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID "${agent.id}" is already registered`);
    }
    this.agents.set(agent.id, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Delegate a task to the most appropriate agent.
   * Uses the runtime's agentic loop (LLM chat → tool calls → repeat).
   */
  async delegateTask(task: Task, preferredAgentId?: string): Promise<AgentResult> {
    if (!this.llmClient) {
      throw new Error('LLM client not configured. Call setLLMClient() before delegating tasks.');
    }

    let agent: Agent | undefined;

    if (preferredAgentId) {
      agent = this.agents.get(preferredAgentId);
      if (!agent) {
        throw new Error(`Agent "${preferredAgentId}" not found`);
      }
    } else {
      agent = this.findBestAgent(task);
      if (!agent) {
        throw new Error(`No suitable agent found for task type "${task.type}"`);
      }
    }

    const result = await this.runtime.executeTask(agent, task, this.llmClient);

    // Retry once on failure if configured
    if (!result.success && this.config.retryOnFailure) {
      return this.runtime.executeTask(agent, task, this.llmClient);
    }

    return result;
  }

  /**
   * Find the best agent for a task.
   *
   * Routing priority:
   * 1. Capability intersection  -  agent whose AgentConfig.capabilities overlaps
   *    with task.requiredCapabilities (highest-overlap agent wins)
   * 2. Tool-name substring match  -  agent has a tool whose name includes the
   *    task type string (legacy fallback)
   * 3. First registered agent  -  last-resort fallback
   */
  private findBestAgent(task: Task): Agent | undefined {
    // 1. Capability-based routing
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      const required = new Set(task.requiredCapabilities);
      let bestAgent: Agent | undefined;
      let bestScore = 0;

      for (const agent of this.agents.values()) {
        const caps = agent.config?.capabilities ?? [];
        const score = caps.filter((c) => required.has(c)).length;
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }

      if (bestAgent) return bestAgent;
    }

    // 2. Tool-name substring fallback
    for (const agent of this.agents.values()) {
      const hasRelevantTool = agent.tools.some((tool) =>
        tool.name.toLowerCase().includes(task.type.toLowerCase()),
      );
      if (hasRelevantTool) return agent;
    }

    // 3. First agent
    return this.agents.values().next().value;
  }

  /**
   * Coordinate multiple agents for a complex task.
   * Executes in batches up to maxConcurrentAgents, each agent receiving a subtask.
   */
  async coordinateAgents(task: Task, agentIds: string[]): Promise<Map<string, AgentResult>> {
    if (!this.llmClient) {
      throw new Error('LLM client not configured. Call setLLMClient() before coordinating agents.');
    }

    const llmClient = this.llmClient;
    const results = new Map<string, AgentResult>();
    const maxConcurrent = this.config.maxConcurrentAgents || 5;

    for (let i = 0; i < agentIds.length; i += maxConcurrent) {
      const batch = agentIds.slice(i, i + maxConcurrent);
      const batchPromises: Promise<[string, AgentResult]>[] = [];

      for (const agentId of batch) {
        const agent = this.agents.get(agentId);
        if (!agent) {
          results.set(agentId, {
            success: false,
            error: `Agent "${agentId}" not found`,
          });
          continue;
        }

        // Create agent-specific subtask
        const subtask: Task = {
          ...task,
          id: `${task.id}-${agentId}`,
          description: `[Agent: ${agent.name}] ${task.description}`,
        };

        batchPromises.push(
          this.runtime
            .executeTask(agent, subtask, llmClient)
            .then((result): [string, AgentResult] => [agentId, result])
            .catch((error): [string, AgentResult] => [
              agentId,
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            ]),
        );
      }

      const batchResults = await Promise.all(batchPromises);
      for (const [agentId, result] of batchResults) {
        results.set(agentId, result);
      }
    }

    return results;
  }
}
