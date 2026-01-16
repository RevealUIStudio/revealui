/**
 * Tool Registry
 *
 * Manages registration and lookup of tools for agents
 */

import { z } from 'zod'
import type { ToolDefinition } from '../llm/providers/base.js'
import type { Tool, ToolResult } from './base.js'

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered`)
    }

    this.tools.set(tool.name, tool)
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): void {
    this.tools.delete(name)
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * Get tool definitions for LLM (OpenAI/Anthropic format)
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.schemaToJSONSchema(tool.parameters),
      },
    }))
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, params: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name)

    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
      }
    }

    // Validate parameters
    try {
      const validatedParams = tool.parameters.parse(params)
      return await tool.execute(validatedParams)
    } catch (error) {
      return {
        success: false,
        error: `Parameter validation failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Convert Zod schema to JSON Schema (simplified)
   */
  private schemaToJSONSchema(schema: z.ZodSchema): Record<string, unknown> {
    // This is a simplified conversion
    // For production, use zod-to-json-schema library
    try {
      // Try to get shape if it's an object schema
      if (schema instanceof z.ZodObject) {
        const shape = schema.shape
        const properties: Record<string, unknown> = {}
        const required: string[] = []

        for (const [key, value] of Object.entries(shape)) {
          properties[key] = this.zodTypeToJSONSchema(value as z.ZodTypeAny)
          if (value instanceof z.ZodType && !value.isOptional()) {
            required.push(key)
          }
        }

        return {
          type: 'object',
          properties,
          ...(required.length > 0 && { required }),
        }
      }

      // Fallback for non-object schemas
      return {
        type: 'object',
        properties: {},
      }
    } catch {
      // Fallback if conversion fails
      return {
        type: 'object',
        properties: {},
      }
    }
  }

  /**
   * Convert Zod type to JSON Schema type
   */
  private zodTypeToJSONSchema(type: z.ZodTypeAny): Record<string, unknown> {
    if (type instanceof z.ZodString) {
      return { type: 'string' }
    }
    if (type instanceof z.ZodNumber) {
      return { type: 'number' }
    }
    if (type instanceof z.ZodBoolean) {
      return { type: 'boolean' }
    }
    if (type instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodTypeToJSONSchema(type.element),
      }
    }
    if (type instanceof z.ZodObject) {
      const shape = type.shape
      const properties: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodTypeToJSONSchema(value as z.ZodTypeAny)
      }
      return {
        type: 'object',
        properties,
      }
    }
    if (type instanceof z.ZodOptional) {
      return this.zodTypeToJSONSchema(type.unwrap())
    }
    if (type instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: type.options,
      }
    }

    // Default fallback
    return { type: 'string' }
  }
}

/**
 * Global tool registry instance
 */
export const globalToolRegistry = new ToolRegistry()
