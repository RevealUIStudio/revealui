/**
 * MCP Tool Adapter
 *
 * Bridges MCP (Model Context Protocol) servers to the tool system.
 *
 * Two paths:
 *
 *   1. **Standard MCP client** (Stage 5.1a, preferred) — consumers construct an
 *      `McpClient` from `@revealui/mcp/client` against stdio or Streamable HTTP,
 *      and pass it to `createToolsFromMcpClient()` (or to `AgentRuntime` via
 *      `mcpClients`). This is the full-protocol path: future stages will extend
 *      this to resources, prompts, sampling, elicitation, etc.
 *
 *   2. **Hypervisor** (legacy, pre-5.1a) — consumers pass an `MCPHypervisor` (or
 *      any `MCPToolSource`) to `discoverMCPTools()`. Kept for backwards compat;
 *      deprecated in favor of path (1). The hypervisor still owns server-side
 *      subprocess + tenant-scoping concerns and isn't going away.
 *
 * Both paths are deliberately **structurally typed** — `@revealui/ai` has no
 * runtime dependency on `@revealui/mcp`. Consumers satisfy the shapes
 * `McpClientLike` / `MCPToolSource` with whichever client they construct.
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
 *
 * @deprecated Prefer `McpClientLike` + `createToolsFromMcpClient()` (Stage 5.1a).
 *   The hypervisor path doesn't expose the full MCP protocol surface (resources,
 *   prompts, sampling, elicitation). The typed-client path does.
 */
export interface MCPToolSource {
  getAllTools(): Array<{ namespacedName: string; serverName: string; tool: MCPTool }>;
  callTool(serverName: string, toolName: string, args: unknown): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Stage 5.1a — standard MCP client path
// ---------------------------------------------------------------------------

/**
 * Structural shape of an `McpClient` from `@revealui/mcp/client`. Declared
 * here (rather than imported) to keep `@revealui/ai` decoupled from
 * `@revealui/mcp` at the type level. Consumers pass any object whose
 * `listTools()` + `callTool()` methods match — the real `McpClient`
 * structurally satisfies this shape.
 *
 * Returns / options are loose-typed to the spec-relevant bits; the real
 * `McpClient` returns richer SDK types which we don't need for tool dispatch.
 */
export interface McpClientLike {
  listTools(options?: unknown): Promise<ReadonlyArray<McpToolDescriptor>>;
  callTool(
    name: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ): Promise<McpCallToolResultLike>;
}

/** Subset of the spec `Tool` shape needed for agent-side discovery. */
export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: unknown;
}

/** Subset of the spec `CallToolResult` shape. */
export interface McpCallToolResultLike {
  content: ReadonlyArray<unknown>;
  isError?: boolean;
  structuredContent?: unknown;
}

export interface CreateToolsFromMcpClientOptions {
  /**
   * Namespace (typically the server's identifier) prepended to each tool
   * name so collisions across multiple MCP clients are impossible.
   * Output tool name: `mcp_<namespace>__<toolName>`.
   */
  namespace: string;
  /**
   * Optional category tag used for tool-level telemetry + UI grouping.
   * Defaults to `'mcp'`.
   */
  category?: string;
}

/**
 * Connect the agent's tool registry to a standard MCP client. Lists tools
 * from the MCP server and returns agent-side `Tool` instances that dispatch
 * calls back through the client. Safe to call multiple times per server —
 * each invocation re-reads the current tool list.
 *
 * @example
 * ```typescript
 * import { McpClient } from '@revealui/mcp/client';
 * import { createToolsFromMcpClient } from '@revealui/ai';
 *
 * const client = new McpClient({
 *   clientInfo: { name: 'my-agent', version: '1.0.0' },
 *   transport: { kind: 'streamable-http', url: 'https://example.com/mcp' },
 * });
 * await client.connect();
 *
 * const tools = await createToolsFromMcpClient(client, {
 *   namespace: 'example-server',
 * });
 *
 * agent.tools.push(...tools);
 * ```
 */
export async function createToolsFromMcpClient(
  client: McpClientLike,
  options: CreateToolsFromMcpClientOptions,
): Promise<Tool[]> {
  if (!(options.namespace && /^[a-zA-Z0-9_-]+$/.test(options.namespace))) {
    throw new Error(
      `createToolsFromMcpClient: namespace must be a non-empty string of [a-zA-Z0-9_-], got ${JSON.stringify(options.namespace)}`,
    );
  }

  const descriptors = await client.listTools();
  const category = options.category ?? 'mcp';

  return descriptors.map((descriptor): Tool => {
    const zodSchema = jsonSchemaObjectToZod(descriptor.inputSchema);
    const namespacedName = `mcp_${options.namespace}__${descriptor.name}`;

    return {
      name: namespacedName,
      label: descriptor.name,
      description: descriptor.description ?? `${options.namespace}: ${descriptor.name}`,
      parameters: zodSchema,

      async execute(params: unknown): Promise<ToolResult> {
        const validated = zodSchema.parse(params);
        try {
          const result = await client.callTool(
            descriptor.name,
            validated as Record<string, unknown>,
          );
          if (result.isError) {
            return {
              success: false,
              error: extractErrorText(result),
            };
          }
          const payload = result.structuredContent ?? result.content;
          return {
            success: true,
            data: serializeMCPResult(payload),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },

      getMetadata() {
        return { category, version: '1.0.0', mcpNamespace: options.namespace };
      },
    };
  });
}

/**
 * Extract a human-readable error string from an MCP `CallToolResult` that
 * came back with `isError: true`. Servers put the error detail in `content`
 * per spec; we concatenate any text parts.
 */
function extractErrorText(result: McpCallToolResultLike): string {
  const texts: string[] = [];
  for (const part of result.content) {
    if (part && typeof part === 'object') {
      const p = part as { type?: string; text?: string };
      if (p.type === 'text' && typeof p.text === 'string') {
        texts.push(p.text);
      }
    }
  }
  return texts.length > 0 ? texts.join('\n') : 'Tool reported error (no detail)';
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
 * Narrow an untyped `inputSchema` from a spec `Tool` into the shape
 * `jsonSchemaToZod` understands, then delegate. Falls back to a permissive
 * `z.object({})` when the input is malformed so tool discovery never hard-fails
 * on a misbehaving server.
 */
function jsonSchemaObjectToZod(raw: unknown): z.ZodSchema {
  if (!(raw && typeof raw === 'object')) return z.object({});
  const s = raw as {
    type?: unknown;
    properties?: unknown;
    required?: unknown;
  };
  if (s.type !== 'object') return z.object({});
  const properties =
    s.properties && typeof s.properties === 'object'
      ? (s.properties as Record<string, unknown>)
      : undefined;
  const required = Array.isArray(s.required)
    ? (s.required.filter((r) => typeof r === 'string') as string[])
    : undefined;
  return jsonSchemaToZod({
    type: 'object',
    ...(properties !== undefined ? { properties } : {}),
    ...(required !== undefined ? { required } : {}),
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
