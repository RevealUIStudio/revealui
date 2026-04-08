/**
 * MCP Tool Adapter
 *
 * Bridges MCP (Model Context Protocol) servers to the tool system
 */

import { z } from 'zod/v4';
import type { Tool, ToolResult } from './base.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPClient {
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, args: unknown): Promise<unknown>;
}

/**
 * Interface for an MCP tool source (e.g. MCPHypervisor from @revealui/mcp).
 * Using an interface here keeps @revealui/ai decoupled from @revealui/mcp.
 */
export interface MCPToolSource {
  getAllTools(): Array<{ namespacedName: string; serverName: string; tool: MCPTool }>;
  callTool(serverName: string, toolName: string, args: unknown): Promise<unknown>;
}

/**
 * Create a Tool from an MCP tool definition
 */
export function createToolFromMCP(mcpTool: MCPTool, mcpClient: MCPClient): Tool {
  // Convert JSON Schema to Zod schema (simplified)
  const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);

  return {
    name: mcpTool.name,
    description: mcpTool.description,
    parameters: zodSchema,
    execute: async (params: unknown): Promise<ToolResult> => {
      try {
        const result = await mcpClient.callTool(mcpTool.name, params);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Register all MCP tools in the registry
 */
export async function registerMCPTools(
  mcpClient: MCPClient,
  registry: { register(tool: Tool): void },
): Promise<void> {
  const tools = await mcpClient.listTools();

  for (const mcpTool of tools) {
    const tool = createToolFromMCP(mcpTool, mcpClient);
    registry.register(tool);
  }
}

/**
 * Serialize an MCP tool result safely:
 * - bigint values → string (JSON.stringify fails on bigint)
 * - Circular references → replaced with "[Circular]"
 */
export function serializeMCPResult(value: unknown): unknown {
  const seen = new WeakSet();

  function replacer(_key: string, val: unknown): unknown {
    if (typeof val === 'bigint') return val.toString();
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  }

  return JSON.parse(JSON.stringify(value, replacer));
}

/**
 * Discover all tools from a running MCPHypervisor (or any MCPToolSource)
 * and return them as RevealUI Tool instances.
 *
 * Tool names use the hypervisor's namespacing (@@mcp_{server}_{tool}) so
 * collisions across servers are impossible.
 *
 * @example
 * ```typescript
 * import { MCPHypervisor } from '@revealui/mcp'
 * import { discoverMCPTools } from '@revealui/ai'
 *
 * const hypervisor = MCPHypervisor.getInstance()
 * const tools = discoverMCPTools(hypervisor)
 * agent.tools.push(...tools)
 * ```
 */
export function discoverMCPTools(source: MCPToolSource): Tool[] {
  return source.getAllTools().map(({ namespacedName, serverName, tool }) => {
    const zodSchema = jsonSchemaToZod(tool.inputSchema);

    const agentTool: Tool = {
      name: namespacedName,
      description: tool.description,
      parameters: zodSchema,

      async execute(params: unknown): Promise<ToolResult> {
        // Validate params against the schema
        const validated = zodSchema.parse(params);

        try {
          const callResult = await source.callTool(serverName, tool.name, validated);
          return {
            success: true,
            data: serializeMCPResult(callResult),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },

      getMetadata() {
        return { category: 'mcp', version: '1.0.0' };
      },
    };

    return agentTool;
  });
}

/**
 * Convert JSON Schema to Zod schema (simplified version)
 * For production, use a proper library like json-schema-to-zod
 */
function jsonSchemaToZod(schema: {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}): z.ZodSchema {
  if (schema.type !== 'object') {
    return z.unknown();
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      const propSchema = prop as { type: string; [key: string]: unknown };
      let zodType: z.ZodTypeAny;

      switch (propSchema.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.unknown());
          break;
        case 'object':
          zodType = z.record(z.string(), z.unknown());
          break;
        default:
          zodType = z.unknown();
      }

      // Make optional if not in required array
      if (!schema.required?.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }
  }

  return z.object(shape);
}
