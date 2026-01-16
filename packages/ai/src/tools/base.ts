/**
 * Tool Base Interface
 *
 * Defines the structure for tools that agents can use
 */

import type { z } from 'zod'

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  metadata?: {
    executionTime?: number
    cost?: number
    tokensUsed?: number
  }
}

export interface Tool {
  /**
   * Unique tool name
   */
  name: string

  /**
   * Tool description (used for LLM tool selection)
   */
  description: string

  /**
   * Zod schema for tool parameters
   */
  parameters: z.ZodSchema

  /**
   * Execute the tool with given parameters
   */
  execute(params: unknown): Promise<ToolResult>

  /**
   * Optional: Validate parameters before execution
   */
  validate?(params: unknown): boolean

  /**
   * Optional: Get tool metadata
   */
  getMetadata?(): {
    category?: string
    version?: string
    author?: string
    [key: string]: unknown
  }
}

/**
 * Tool execution context
 */
export interface ToolContext {
  agentId?: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

/**
 * Tool with context
 */
export interface ContextualTool extends Tool {
  executeWithContext(params: unknown, context: ToolContext): Promise<ToolResult>
}
