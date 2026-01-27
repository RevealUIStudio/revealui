/**
 * MCP Tool Adapter
 *
 * Bridges MCP (Model Context Protocol) servers to the tool system
 */

import { z } from 'zod/v4'
import type { Tool, ToolResult } from './base.js'

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface MCPClient {
  listTools(): Promise<MCPTool[]>
  callTool(name: string, args: unknown): Promise<unknown>
}

/**
 * Create a Tool from an MCP tool definition
 */
export function createToolFromMCP(mcpTool: MCPTool, mcpClient: MCPClient): Tool {
  // Convert JSON Schema to Zod schema (simplified)
  const zodSchema = jsonSchemaToZod(mcpTool.inputSchema)

  return {
    name: mcpTool.name,
    description: mcpTool.description,
    parameters: zodSchema,
    execute: async (params: unknown): Promise<ToolResult> => {
      try {
        const result = await mcpClient.callTool(mcpTool.name, params)
        return {
          success: true,
          data: result,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

/**
 * Register all MCP tools in the registry
 */
export async function registerMCPTools(
  mcpClient: MCPClient,
  registry: { register(tool: Tool): void },
): Promise<void> {
  const tools = await mcpClient.listTools()

  for (const mcpTool of tools) {
    const tool = createToolFromMCP(mcpTool, mcpClient)
    registry.register(tool)
  }
}

/**
 * Convert JSON Schema to Zod schema (simplified version)
 * For production, use a proper library like json-schema-to-zod
 */
function jsonSchemaToZod(schema: {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
}): z.ZodSchema {
  if (schema.type !== 'object') {
    return z.any()
  }

  const shape: Record<string, z.ZodTypeAny> = {}

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      const propSchema = prop as { type: string; [key: string]: unknown }
      let zodType: z.ZodTypeAny

      switch (propSchema.type) {
        case 'string':
          zodType = z.string()
          break
        case 'number':
        case 'integer':
          zodType = z.number()
          break
        case 'boolean':
          zodType = z.boolean()
          break
        case 'array':
          zodType = z.array(z.any())
          break
        case 'object':
          zodType = z.record(z.string(), z.unknown())
          break
        default:
          zodType = z.any()
      }

      // Make optional if not in required array
      if (!schema.required?.includes(key)) {
        zodType = zodType.optional()
      }

      shape[key] = zodType
    }
  }

  return z.object(shape)
}
