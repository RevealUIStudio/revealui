/**
 * Stage 5.1a — tests for `createToolsFromMcpClient`.
 *
 * Uses a structural stub that matches the `McpClientLike` shape, so these
 * tests run without importing `@revealui/mcp` (preserving the package-level
 * decoupling decision).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createToolsFromMcpClient,
  type McpCallToolResultLike,
  type McpClientLike,
  type McpToolDescriptor,
} from '../../tools/mcp-adapter.js';

function makeClient(
  descriptors: McpToolDescriptor[],
  callHandler: (name: string, args?: Record<string, unknown>) => Promise<McpCallToolResultLike>,
): McpClientLike {
  return {
    listTools: vi.fn().mockResolvedValue(descriptors),
    callTool: vi.fn(async (name, args) => callHandler(name, args)),
  };
}

describe('createToolsFromMcpClient', () => {
  it('rejects empty namespace', async () => {
    const client = makeClient([], async () => ({ content: [] }));
    await expect(createToolsFromMcpClient(client, { namespace: '' })).rejects.toThrow(/namespace/);
  });

  it('rejects namespace with disallowed characters', async () => {
    const client = makeClient([], async () => ({ content: [] }));
    await expect(createToolsFromMcpClient(client, { namespace: 'bad.chars' })).rejects.toThrow(
      /namespace/,
    );
    await expect(createToolsFromMcpClient(client, { namespace: '../etc' })).rejects.toThrow(
      /namespace/,
    );
  });

  it('wraps every MCP tool descriptor into a Tool with namespaced name', async () => {
    const client = makeClient(
      [
        {
          name: 'list_items',
          description: 'List items in a collection',
          inputSchema: {
            type: 'object',
            properties: { collection: { type: 'string' } },
            required: ['collection'],
          },
        },
        {
          name: 'get_item',
          inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      ],
      async () => ({ content: [] }),
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'content' });

    expect(tools).toHaveLength(2);
    expect(tools[0]?.name).toBe('mcp_content__list_items');
    expect(tools[0]?.label).toBe('list_items');
    expect(tools[0]?.description).toBe('List items in a collection');
    expect(tools[1]?.name).toBe('mcp_content__get_item');
    // Description falls back to "<namespace>: <toolName>" when server omits one.
    expect(tools[1]?.description).toBe('content: get_item');
  });

  it('dispatches a successful call through the MCP client', async () => {
    const callHandler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: { status: 'done' },
    });
    const client = makeClient(
      [{ name: 'noop', inputSchema: { type: 'object', properties: {} } }],
      callHandler,
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const result = await tools[0]?.execute({});

    expect(callHandler).toHaveBeenCalledWith('noop', {});
    expect(result).toEqual({
      success: true,
      data: { status: 'done' },
    });
  });

  it('falls back to content array when structuredContent is absent', async () => {
    const client = makeClient(
      [{ name: 'noop', inputSchema: { type: 'object', properties: {} } }],
      async () => ({
        content: [{ type: 'text', text: 'hello' }],
      }),
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const result = await tools[0]?.execute({});

    expect(result?.success).toBe(true);
    expect(Array.isArray(result?.data)).toBe(true);
  });

  it('maps isError: true to a failed ToolResult with the text content', async () => {
    const client = makeClient(
      [{ name: 'broken', inputSchema: { type: 'object', properties: {} } }],
      async () => ({
        isError: true,
        content: [
          { type: 'text', text: 'Collection not found: foo' },
          { type: 'text', text: 'Retry with a valid slug' },
        ],
      }),
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const result = await tools[0]?.execute({});

    expect(result?.success).toBe(false);
    expect(result?.error).toBe('Collection not found: foo\nRetry with a valid slug');
  });

  it('surfaces a default message when isError: true but content has no text parts', async () => {
    const client = makeClient(
      [{ name: 'broken', inputSchema: { type: 'object', properties: {} } }],
      async () => ({ isError: true, content: [] }),
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const result = await tools[0]?.execute({});

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/no detail/i);
  });

  it('maps thrown exceptions into a failed ToolResult', async () => {
    const client = makeClient(
      [{ name: 'noop', inputSchema: { type: 'object', properties: {} } }],
      async () => {
        throw new Error('transport closed');
      },
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const result = await tools[0]?.execute({});

    expect(result?.success).toBe(false);
    expect(result?.error).toBe('transport closed');
  });

  it('validates parameters against the zod schema derived from inputSchema', async () => {
    const client = makeClient(
      [
        {
          name: 'greet',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      ],
      async () => ({ content: [{ type: 'text', text: 'hi' }] }),
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });

    // Missing required parameter — zod throws inside execute, which we don't catch there.
    await expect(tools[0]?.execute({})).rejects.toThrow();
  });

  it('tolerates malformed inputSchema by defaulting to a permissive object schema', async () => {
    const client = makeClient(
      [
        // inputSchema is not an object — real-world servers occasionally send junk
        { name: 'weird', inputSchema: null as unknown as object },
      ],
      async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const result = await tools[0]?.execute({});

    expect(result?.success).toBe(true);
  });

  it('sets metadata with the namespace and default category', async () => {
    const client = makeClient(
      [{ name: 'noop', inputSchema: { type: 'object', properties: {} } }],
      async () => ({ content: [] }),
    );

    const tools = await createToolsFromMcpClient(client, { namespace: 'content' });
    const meta = tools[0]?.getMetadata?.();
    expect(meta?.category).toBe('mcp');
    expect(meta?.mcpNamespace).toBe('content');
  });

  it('honors a custom category', async () => {
    const client = makeClient(
      [{ name: 'noop', inputSchema: { type: 'object', properties: {} } }],
      async () => ({ content: [] }),
    );

    const tools = await createToolsFromMcpClient(client, {
      namespace: 'content',
      category: 'content-mcp',
    });
    expect(tools[0]?.getMetadata?.().category).toBe('content-mcp');
  });
});
