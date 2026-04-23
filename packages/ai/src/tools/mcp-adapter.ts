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
  /**
   * Resources (Stage 5.1b). Optional: when absent on the client, the
   * adapter skips emitting resource meta-tools for the server regardless
   * of `include.resources`.
   */
  listResources?(options?: unknown): Promise<ReadonlyArray<McpResourceDescriptor>>;
  readResource?(uri: string, options?: unknown): Promise<ReadonlyArray<McpResourceContentLike>>;
  /**
   * Prompts (Stage 5.1b). Optional: when absent, prompt meta-tools are
   * skipped for the server.
   */
  listPrompts?(options?: unknown): Promise<ReadonlyArray<McpPromptDescriptor>>;
  getPrompt?(
    name: string,
    args?: Record<string, string>,
    options?: unknown,
  ): Promise<McpGetPromptResultLike>;
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

/** Subset of the spec `Resource` shape needed for listing. */
export interface McpResourceDescriptor {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/** One element of `readResource`'s response — either a text or a blob content part. */
export interface McpResourceContentLike {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/** Subset of the spec `Prompt` shape needed for listing. */
export interface McpPromptDescriptor {
  name: string;
  description?: string;
  arguments?: ReadonlyArray<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/** Subset of the spec `GetPromptResult` shape. */
export interface McpGetPromptResultLike {
  description?: string;
  messages: ReadonlyArray<{
    role: 'user' | 'assistant' | string;
    content: unknown;
  }>;
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
  /**
   * Which MCP primitives to expose to the agent as tools (Stage 5.1b).
   *
   * - `tools` (default `true`): wrap every server tool.
   * - `resources` (default `true`): emit two meta-tools per namespace —
   *   `mcp_<ns>__list_resources` and `mcp_<ns>__read_resource({ uri })`.
   *   Skipped silently when the client doesn't expose `listResources` /
   *   `readResource`.
   * - `prompts` (default `true`): emit two meta-tools per namespace —
   *   `mcp_<ns>__list_prompts` and `mcp_<ns>__get_prompt({ name, args? })`.
   *   Skipped silently when the client doesn't expose `listPrompts` /
   *   `getPrompt`.
   */
  include?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  /**
   * Progress observability hook (Stage 5.3). Every server tool call made
   * through the wrapped `Tool.execute()` forwards per-request progress
   * notifications here. Resource + prompt meta-tools don't emit
   * progress (they're single-shot lookups).
   */
  onProgress?: (event: McpProgressEvent) => void;
  /**
   * Optional `AbortSignal` forwarded to every server tool call (Stage
   * 5.3). When the signal aborts, in-flight MCP RPC calls are
   * cancelled via `notifications/cancelled` per the MCP spec. Useful
   * for wiring a consumer-facing cancel button into an active
   * agent run. Resource/prompt meta-tools also receive the signal.
   */
  signal?: AbortSignal;
}

/** Spec-shaped `Progress` notification subset. */
export interface McpProgressLike {
  /** Monotonically increasing progress token value. */
  progress: number;
  /** Total expected units of work, when the server knows it. */
  total?: number;
  /** Human-readable status message. */
  message?: string;
}

/** Event payload forwarded to `onProgress`. */
export interface McpProgressEvent {
  /** Namespace the tool belongs to (for multi-client agents). */
  namespace: string;
  /** Wrapped tool name that emitted the event (without the `mcp_<ns>__` prefix). */
  toolName: string;
  /** Progress payload as reported by the server. */
  progress: McpProgressLike;
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

  const category = options.category ?? 'mcp';
  const includeTools = options.include?.tools !== false;
  const includeResources = options.include?.resources !== false;
  const includePrompts = options.include?.prompts !== false;
  const ctx: BuildToolContext = {
    namespace: options.namespace,
    category,
    ...(options.onProgress !== undefined ? { onProgress: options.onProgress } : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  };

  const tools: Tool[] = [];

  // --- Server tools (Stage 5.1a) -----------------------------------------
  if (includeTools) {
    const descriptors = await client.listTools();
    for (const descriptor of descriptors) {
      tools.push(buildServerTool(client, descriptor, ctx));
    }
  }

  // --- Resource meta-tools (Stage 5.1b) ----------------------------------
  if (includeResources && client.listResources && client.readResource) {
    tools.push(buildListResourcesTool(client, ctx));
    tools.push(buildReadResourceTool(client, ctx));
  }

  // --- Prompt meta-tools (Stage 5.1b) ------------------------------------
  if (includePrompts && client.listPrompts && client.getPrompt) {
    tools.push(buildListPromptsTool(client, ctx));
    tools.push(buildGetPromptTool(client, ctx));
  }

  return tools;
}

/**
 * Internal context bundled per-`createToolsFromMcpClient` call and
 * handed to every `build*Tool` helper. Keeps the signature manageable
 * once options grow beyond name + category (Stage 5.3 added progress +
 * signal threading).
 */
interface BuildToolContext {
  namespace: string;
  category: string;
  onProgress?: (event: McpProgressEvent) => void;
  signal?: AbortSignal;
}

/**
 * Build the request-options object passed to `client.callTool()` /
 * `readResource()` / etc. Wraps the ctx's `onProgress` with the
 * specific tool name + namespace so every emitted event is attributable.
 */
function buildRequestOptions(
  ctx: BuildToolContext,
  toolName: string,
): { onProgress?: (progress: McpProgressLike) => void; signal?: AbortSignal } | undefined {
  const opts: { onProgress?: (progress: McpProgressLike) => void; signal?: AbortSignal } = {};
  if (ctx.onProgress) {
    const emit = ctx.onProgress;
    opts.onProgress = (progress) => emit({ namespace: ctx.namespace, toolName, progress });
  }
  if (ctx.signal) opts.signal = ctx.signal;
  return opts.onProgress || opts.signal ? opts : undefined;
}

function buildServerTool(
  client: McpClientLike,
  descriptor: McpToolDescriptor,
  ctx: BuildToolContext,
): Tool {
  const zodSchema = jsonSchemaObjectToZod(descriptor.inputSchema);
  const namespacedName = `mcp_${ctx.namespace}__${descriptor.name}`;
  return {
    name: namespacedName,
    label: descriptor.name,
    description: descriptor.description ?? `${ctx.namespace}: ${descriptor.name}`,
    parameters: zodSchema,

    async execute(params: unknown): Promise<ToolResult> {
      const validated = zodSchema.parse(params);
      try {
        const result = await client.callTool(
          descriptor.name,
          validated as Record<string, unknown>,
          buildRequestOptions(ctx, descriptor.name),
        );
        if (result.isError) {
          return { success: false, error: extractErrorText(result) };
        }
        const payload = result.structuredContent ?? result.content;
        return { success: true, data: serializeMCPResult(payload) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    getMetadata() {
      return { category: ctx.category, version: '1.0.0', mcpNamespace: ctx.namespace };
    },
  };
}

function buildListResourcesTool(client: McpClientLike, ctx: BuildToolContext): Tool {
  return {
    name: `mcp_${ctx.namespace}__list_resources`,
    label: 'list_resources',
    description: `List resources exposed by the ${ctx.namespace} MCP server. Returns an array of { uri, name, description?, mimeType? }.`,
    parameters: z.object({}),

    async execute(): Promise<ToolResult> {
      try {
        const resources =
          (await client.listResources?.(buildRequestOptions(ctx, 'list_resources'))) ?? [];
        return { success: true, data: serializeMCPResult(resources) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    getMetadata() {
      return {
        category: ctx.category,
        version: '1.0.0',
        mcpNamespace: ctx.namespace,
        kind: 'resources',
      };
    },
  };
}

function buildReadResourceTool(client: McpClientLike, ctx: BuildToolContext): Tool {
  const paramsSchema = z.object({
    uri: z.string().min(1).describe('Resource URI to read (e.g. revealui-content://posts/abc)'),
  });
  return {
    name: `mcp_${ctx.namespace}__read_resource`,
    label: 'read_resource',
    description: `Read a resource by URI from the ${ctx.namespace} MCP server. Returns the resource contents (text parts flattened to a joined string when possible).`,
    parameters: paramsSchema,

    async execute(params: unknown): Promise<ToolResult> {
      const { uri } = paramsSchema.parse(params);
      try {
        const contents =
          (await client.readResource?.(uri, buildRequestOptions(ctx, 'read_resource'))) ?? [];
        const joinedText = flattenResourceText(contents);
        const base: ToolResult = {
          success: true,
          data: serializeMCPResult(contents),
        };
        return joinedText !== undefined ? { ...base, content: joinedText } : base;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    getMetadata() {
      return {
        category: ctx.category,
        version: '1.0.0',
        mcpNamespace: ctx.namespace,
        kind: 'resources',
      };
    },
  };
}

function buildListPromptsTool(client: McpClientLike, ctx: BuildToolContext): Tool {
  return {
    name: `mcp_${ctx.namespace}__list_prompts`,
    label: 'list_prompts',
    description: `List prompts exposed by the ${ctx.namespace} MCP server. Returns an array of { name, description?, arguments? }.`,
    parameters: z.object({}),

    async execute(): Promise<ToolResult> {
      try {
        const prompts =
          (await client.listPrompts?.(buildRequestOptions(ctx, 'list_prompts'))) ?? [];
        return { success: true, data: serializeMCPResult(prompts) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    getMetadata() {
      return {
        category: ctx.category,
        version: '1.0.0',
        mcpNamespace: ctx.namespace,
        kind: 'prompts',
      };
    },
  };
}

function buildGetPromptTool(client: McpClientLike, ctx: BuildToolContext): Tool {
  const paramsSchema = z.object({
    name: z.string().min(1).describe('Prompt name to retrieve'),
    args: z
      .record(z.string(), z.string())
      .optional()
      .describe('Prompt arguments as a string-valued map (per MCP spec)'),
  });
  return {
    name: `mcp_${ctx.namespace}__get_prompt`,
    label: 'get_prompt',
    description: `Get a resolved prompt from the ${ctx.namespace} MCP server. Returns { description?, messages } — messages is an array of { role, content }.`,
    parameters: paramsSchema,

    async execute(params: unknown): Promise<ToolResult> {
      const { name, args } = paramsSchema.parse(params);
      try {
        const result = await client.getPrompt?.(name, args, buildRequestOptions(ctx, 'get_prompt'));
        if (!result) {
          return { success: false, error: 'client does not implement getPrompt' };
        }
        const joinedText = flattenPromptMessages(result.messages);
        const base: ToolResult = {
          success: true,
          data: serializeMCPResult(result),
        };
        return joinedText !== undefined ? { ...base, content: joinedText } : base;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    getMetadata() {
      return {
        category: ctx.category,
        version: '1.0.0',
        mcpNamespace: ctx.namespace,
        kind: 'prompts',
      };
    },
  };
}

/**
 * Collapse an array of resource contents to a single text string when every
 * part carries text. Returns `undefined` if any part is binary (blob) or has
 * no text, signaling the caller that a token-efficient summary isn't
 * available — in which case the full `data` array still carries everything.
 */
function flattenResourceText(contents: ReadonlyArray<McpResourceContentLike>): string | undefined {
  if (contents.length === 0) return undefined;
  const parts: string[] = [];
  for (const part of contents) {
    if (typeof part.text === 'string') {
      parts.push(part.text);
    } else {
      return undefined;
    }
  }
  return parts.join('\n\n');
}

/**
 * Collapse a prompt's message array to a single text summary in
 * `<role>: <text>` format. Returns `undefined` when any message has a
 * non-text content shape (image, resource reference, …).
 */
function flattenPromptMessages(
  messages: ReadonlyArray<{ role: string; content: unknown }>,
): string | undefined {
  if (messages.length === 0) return undefined;
  const lines: string[] = [];
  for (const msg of messages) {
    const text = extractMessageText(msg.content);
    if (text === undefined) return undefined;
    lines.push(`${msg.role}: ${text}`);
  }
  return lines.join('\n\n');
}

function extractMessageText(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const c = content as { type?: string; text?: string };
    if (c.type === 'text' && typeof c.text === 'string') return c.text;
  }
  return undefined;
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
