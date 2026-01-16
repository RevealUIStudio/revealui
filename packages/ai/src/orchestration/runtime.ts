/**
 * Agent Runtime
 *
 * Executes agent tasks with tool execution, memory management, and error handling
 */

import type { LLMClient } from '../llm/client.js'
import type { Message } from '../llm/providers/base.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { Agent, AgentResult, Task, ToolResult } from './agent.js'

export interface RuntimeConfig {
  maxIterations?: number
  timeout?: number
  retryOnError?: boolean
  maxRetries?: number
}

export class AgentRuntime {
  private config: RuntimeConfig
  private taskQueue: Task[] = []
  private executingTasks: Map<string, Promise<AgentResult>> = new Map()

  constructor(config: RuntimeConfig = {}) {
    this.config = {
      maxIterations: config.maxIterations ?? 10,
      timeout: config.timeout ?? 60000, // 60 seconds
      retryOnError: config.retryOnError ?? true,
      maxRetries: config.maxRetries ?? 3,
    }
  }

  /**
   * Execute a task with an agent
   */
  async executeTask(agent: Agent, task: Task, llmClient: LLMClient): Promise<AgentResult> {
    const startTime = Date.now()

    // Check if task is already executing
    const existingExecution = this.executingTasks.get(task.id)
    if (existingExecution) {
      return existingExecution
    }

    // Create execution promise
    const execution = this.runTask(agent, task, llmClient, startTime)
    this.executingTasks.set(task.id, execution)

    try {
      const result = await execution
      return result
    } finally {
      this.executingTasks.delete(task.id)
    }
  }

  private async runTask(
    agent: Agent,
    task: Task,
    llmClient: LLMClient,
    startTime: number,
  ): Promise<AgentResult> {
    const toolResults: ToolResult[] = []
    let iterations = 0
    const messages: Message[] = [
      {
        role: 'system',
        content: agent.instructions,
      },
      {
        role: 'user',
        content: task.description,
      },
    ]

    try {
      while (iterations < (this.config.maxIterations || 10)) {
        iterations++

        // Check timeout
        if (Date.now() - startTime > (this.config.timeout || 60000)) {
          return {
            success: false,
            error: 'Task execution timeout',
            toolResults,
            metadata: {
              executionTime: Date.now() - startTime,
            },
          }
        }

        // Get LLM response
        const response = await llmClient.chat(messages, {
          tools: agent.tools.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: {} as Record<string, unknown>, // Would need proper conversion
            },
          })),
        })

        // Add assistant response to messages
        messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        })

        // If no tool calls, task is complete
        if (!response.toolCalls || response.toolCalls.length === 0) {
          return {
            success: true,
            output: response.content,
            toolResults,
            metadata: {
              executionTime: Date.now() - startTime,
              tokensUsed: response.usage?.totalTokens,
            },
          }
        }

        // Execute tool calls
        for (const toolCall of response.toolCalls) {
          const tool = agent.tools.find((t) => t.name === toolCall.function.name)

          if (!tool) {
            toolResults.push({
              success: false,
              error: `Tool "${toolCall.function.name}" not found`,
            })
            continue
          }

          try {
            const params = JSON.parse(toolCall.function.arguments)
            const result = await tool.execute(params)
            toolResults.push(result)

            // Add tool result to messages
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              toolCallId: toolCall.id,
            })
          } catch (error) {
            toolResults.push({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }

      return {
        success: false,
        error: 'Maximum iterations reached',
        toolResults,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolResults,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Add task to queue
   */
  enqueueTask(task: Task): void {
    this.taskQueue.push(task)
  }

  /**
   * Process task queue
   */
  async processQueue(agent: Agent, llmClient: LLMClient): Promise<AgentResult[]> {
    const results: AgentResult[] = []

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()
      if (task) {
        const result = await this.executeTask(agent, task, llmClient)
        results.push(result)
      }
    }

    return results
  }
}
