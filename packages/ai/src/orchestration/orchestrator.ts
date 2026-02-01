/**
 * Agent Orchestrator
 *
 * Coordinates multiple agents for complex tasks
 */

import type { Agent, AgentResult, Task } from './agent.js'
import { AgentRuntime } from './runtime.js'

export interface OrchestrationConfig {
  maxConcurrentAgents?: number
  taskTimeout?: number
  retryOnFailure?: boolean
}

export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map()
  private config: OrchestrationConfig

  constructor(config: OrchestrationConfig = {}) {
    this.config = {
      maxConcurrentAgents: config.maxConcurrentAgents ?? 5,
      taskTimeout: config.taskTimeout ?? 60000,
      retryOnFailure: config.retryOnFailure ?? true,
    }
    this.runtime = new AgentRuntime({
      timeout: this.config.taskTimeout || 60000,
    })
  }

  /**
   * Register an agent
   */
  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID "${agent.id}" is already registered`)
    }
    this.agents.set(agent.id, agent)
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId)
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Delegate a task to the most appropriate agent
   */
  delegateTask(task: Task, preferredAgentId?: string): Promise<AgentResult> {
    let agent: Agent | undefined

    if (preferredAgentId) {
      agent = this.agents.get(preferredAgentId)
      if (!agent) {
        return Promise.reject(new Error(`Agent "${preferredAgentId}" not found`))
      }
    } else {
      // Find best agent for task type
      agent = this.findBestAgent(task)
      if (!agent) {
        return Promise.reject(new Error(`No suitable agent found for task type "${task.type}"`))
      }
    }

    // Execute task (would need LLM client - simplified for now)
    // In practice, this would use the runtime
    return Promise.resolve({
      success: false,
      error: 'Task execution not fully implemented - requires LLM client',
    })
  }

  /**
   * Find the best agent for a task
   */
  private findBestAgent(task: Task): Agent | undefined {
    // Simple implementation: find first agent with matching tool
    // In practice, this would use more sophisticated matching
    for (const agent of this.agents.values()) {
      // Check if agent has tools relevant to task type
      const hasRelevantTool = agent.tools.some((tool) =>
        tool.name.toLowerCase().includes(task.type.toLowerCase()),
      )

      if (hasRelevantTool) {
        return agent
      }
    }

    // Fallback: return first agent
    return this.agents.values().next().value
  }

  /**
   * Coordinate multiple agents for a complex task
   */
  async coordinateAgents(_task: Task, agentIds: string[]): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>()

    // Execute tasks in parallel (up to max concurrent)
    const maxConcurrent = this.config.maxConcurrentAgents || 5
    const agentPromises: Promise<[string, AgentResult]>[] = []

    for (let i = 0; i < agentIds.length; i += maxConcurrent) {
      const batch = agentIds.slice(i, i + maxConcurrent)

      for (const agentId of batch) {
        const agent = this.agents.get(agentId)
        if (!agent) {
          results.set(agentId, {
            success: false,
            error: `Agent "${agentId}" not found`,
          })
          continue
        }

        // Execute (simplified - would need LLM client)
        agentPromises.push(
          Promise.resolve([
            agentId,
            {
              success: false,
              error: 'Coordination not fully implemented - requires LLM client',
            },
          ]),
        )
      }

      const batchResults = await Promise.all(agentPromises)
      for (const [agentId, result] of batchResults) {
        results.set(agentId, result)
      }
    }

    return results
  }
}
