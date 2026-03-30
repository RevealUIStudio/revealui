/**
 * MCP Contracts
 *
 * Zod schemas for MCP-specific types, built on top of @revealui/contracts.
 * These provide runtime validation for MCP request/response payloads
 * and bridge MCP SDK tool definitions to contracts ToolDefinition.
 */

import {
  type A2AAgentCard,
  type A2AAuth,
  type AgentDefinition,
  agentDefinitionToCard,
  type ToolDefinition,
  ToolDefinitionSchema,
  type ToolParameter,
  z,
} from '@revealui/contracts';

// =============================================================================
// MCP Request / Response Schemas
// =============================================================================

/**
 * Schema for MCP request options (idempotency, retry, dry-run)
 */
export const MCPRequestOptionsSchema = z.object({
  timeout: z.number().positive().optional(),
  retries: z.number().int().nonnegative().optional(),
  dryRun: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  idempotencyTTL: z.number().positive().optional(),
});

export type MCPRequestOptions = z.infer<typeof MCPRequestOptionsSchema>;

/**
 * Schema for an MCP request payload
 */
export const MCPRequestSchema = z.object({
  action: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
  options: MCPRequestOptionsSchema.optional(),
});

export type MCPRequest = z.infer<typeof MCPRequestSchema>;

/**
 * Schema for MCP response metadata
 */
export const MCPResponseMetadataSchema = z.object({
  duration: z.number().nonnegative(),
  retries: z.number().int().nonnegative(),
  service: z.string(),
  cached: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
});

export type MCPResponseMetadata = z.infer<typeof MCPResponseMetadataSchema>;

/**
 * Schema for an MCP response payload
 */
export const MCPResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  metadata: MCPResponseMetadataSchema.optional(),
});

export type MCPResponse = z.infer<typeof MCPResponseSchema>;

/**
 * Schema for MCP adapter configuration
 */
export const MCPAdapterConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().int().nonnegative().optional(),
  environment: z.enum(['development', 'production']).optional(),
});

export type MCPAdapterConfig = z.infer<typeof MCPAdapterConfigSchema>;

// =============================================================================
// Tool Definition Bridge
// =============================================================================

/**
 * Converts an MCP SDK tool definition (JSON Schema-based) to a contracts ToolDefinition.
 *
 * The MCP SDK uses JSON Schema for tool `inputSchema`, while contracts uses
 * a structured ToolParameter format. This bridge maps between them.
 */
export function mcpToolToContractsToolDefinition(mcpTool: {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<
      string,
      { type?: string; description?: string; default?: unknown; enum?: string[] }
    >;
    required?: string[];
  };
}): ToolDefinition {
  const parameters: Record<string, ToolParameter> = {};

  if (mcpTool.inputSchema?.properties) {
    const required = new Set(mcpTool.inputSchema.required ?? []);

    for (const [key, prop] of Object.entries(mcpTool.inputSchema.properties)) {
      parameters[key] = {
        type: (prop.type as ToolParameter['type']) ?? 'string',
        description: prop.description ?? '',
        required: required.has(key),
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.enum && { enum: prop.enum }),
      };
    }
  }

  return ToolDefinitionSchema.parse({
    name: mcpTool.name,
    description: mcpTool.description ?? `MCP tool: ${mcpTool.name}`,
    parameters,
    destructive: false,
  });
}

/**
 * Converts a contracts ToolDefinition back to an MCP SDK-compatible tool shape.
 * Useful for registering contracts-defined tools with MCP servers.
 */
export function contractsToolDefinitionToMcpTool(tool: ToolDefinition): {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      { type: string; description: string; default?: unknown; enum?: string[] }
    >;
    required: string[];
  };
} {
  const properties: Record<
    string,
    { type: string; description: string; default?: unknown; enum?: string[] }
  > = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(tool.parameters)) {
    properties[key] = {
      type: param.type,
      description: param.description,
      ...(param.default !== undefined && { default: param.default }),
      ...(param.enum && { enum: param.enum }),
    };

    if (param.required) {
      required.push(key);
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

// =============================================================================
// Agent Card Bridge
// =============================================================================

/**
 * Converts a RevealUI AgentDefinition to a Google A2A AgentCard.
 * Wraps the contracts-level `agentDefinitionToCard` with optional MCP-specific overrides.
 *
 * @param agent - The agent definition (source of truth)
 * @param baseUrl - The server base URL (e.g. https://api.revealui.com)
 * @param opts - Optional overrides for auth scheme and streaming capability
 */
export function agentDefinitionToAgentCard(
  agent: AgentDefinition,
  baseUrl: string,
  opts?: { authScheme?: A2AAuth; streaming?: boolean },
): A2AAgentCard {
  const card = agentDefinitionToCard(agent, baseUrl);
  if (!opts) return card;

  const { authScheme, streaming } = opts;
  return {
    ...card,
    ...(authScheme !== undefined && { authentication: authScheme }),
    capabilities: {
      ...(card.capabilities ?? {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      }),
      streaming: streaming ?? card.capabilities?.streaming ?? false,
    },
  };
}

/**
 * Converts all tools in a RevealUI AgentDefinition to MCP tool specs.
 * Uses `contractsToolDefinitionToMcpTool` for each tool.
 */
export function agentDefinitionToMcpTools(
  agent: AgentDefinition,
): ReturnType<typeof contractsToolDefinitionToMcpTool>[] {
  return agent.tools.map(contractsToolDefinitionToMcpTool);
}
