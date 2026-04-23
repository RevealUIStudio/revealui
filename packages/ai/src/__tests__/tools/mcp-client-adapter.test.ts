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
  type McpGetPromptResultLike,
  type McpPromptDescriptor,
  type McpResourceContentLike,
  type McpResourceDescriptor,
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

interface FullClientOptions {
  tools?: McpToolDescriptor[];
  resources?: McpResourceDescriptor[];
  resourceContents?: Record<string, ReadonlyArray<McpResourceContentLike>>;
  prompts?: McpPromptDescriptor[];
  promptResults?: Record<string, McpGetPromptResultLike>;
}

function makeFullClient(opts: FullClientOptions): McpClientLike {
  return {
    listTools: vi.fn().mockResolvedValue(opts.tools ?? []),
    callTool: vi.fn().mockResolvedValue({ content: [] }),
    listResources: vi.fn().mockResolvedValue(opts.resources ?? []),
    readResource: vi.fn(async (uri: string) => opts.resourceContents?.[uri] ?? []),
    listPrompts: vi.fn().mockResolvedValue(opts.prompts ?? []),
    getPrompt: vi.fn(async (name: string) => {
      const result = opts.promptResults?.[name];
      if (!result) throw new Error(`prompt not found: ${name}`);
      return result;
    }),
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

// ---------------------------------------------------------------------------
// Stage 5.1b — resource + prompt meta-tools
// ---------------------------------------------------------------------------

describe('createToolsFromMcpClient — resources (Stage 5.1b)', () => {
  it('emits list_resources + read_resource meta-tools when the client supports resources', async () => {
    const client = makeFullClient({
      resources: [
        { uri: 'revealui-content://posts/1', name: 'posts/Post 1', mimeType: 'application/json' },
      ],
    });

    const tools = await createToolsFromMcpClient(client, { namespace: 'content' });
    const names = tools.map((t) => t.name);
    expect(names).toContain('mcp_content__list_resources');
    expect(names).toContain('mcp_content__read_resource');
  });

  it('list_resources returns the descriptors verbatim', async () => {
    const descriptors: McpResourceDescriptor[] = [
      { uri: 'revealui-content://posts/1', name: 'Post 1' },
      { uri: 'revealui-content://pages/home', name: 'Home' },
    ];
    const client = makeFullClient({ resources: descriptors });

    const tools = await createToolsFromMcpClient(client, { namespace: 'content' });
    const listTool = tools.find((t) => t.name === 'mcp_content__list_resources');
    const result = await listTool?.execute({});

    expect(result?.success).toBe(true);
    expect(result?.data).toEqual(descriptors);
  });

  it('read_resource fetches contents by URI and joins text parts into `content`', async () => {
    const client = makeFullClient({
      resourceContents: {
        'revealui-content://posts/1': [
          { uri: 'revealui-content://posts/1', text: 'First paragraph.', mimeType: 'text/plain' },
          { uri: 'revealui-content://posts/1', text: 'Second paragraph.', mimeType: 'text/plain' },
        ],
      },
    });

    const tools = await createToolsFromMcpClient(client, { namespace: 'content' });
    const readTool = tools.find((t) => t.name === 'mcp_content__read_resource');
    const result = await readTool?.execute({ uri: 'revealui-content://posts/1' });

    expect(result?.success).toBe(true);
    expect(result?.content).toBe('First paragraph.\n\nSecond paragraph.');
    expect(Array.isArray(result?.data)).toBe(true);
  });

  it('read_resource omits `content` flattening when any part is binary (blob)', async () => {
    const client = makeFullClient({
      resourceContents: {
        'revealui-content://media/1': [
          { uri: 'revealui-content://media/1', blob: 'base64data==', mimeType: 'image/png' },
        ],
      },
    });

    const tools = await createToolsFromMcpClient(client, { namespace: 'content' });
    const readTool = tools.find((t) => t.name === 'mcp_content__read_resource');
    const result = await readTool?.execute({ uri: 'revealui-content://media/1' });

    expect(result?.success).toBe(true);
    expect(result?.content).toBeUndefined();
    expect(Array.isArray(result?.data)).toBe(true);
  });

  it('skips resource meta-tools when include.resources is false', async () => {
    const client = makeFullClient({ resources: [{ uri: 'x://y', name: 'y' }] });

    const tools = await createToolsFromMcpClient(client, {
      namespace: 'srv',
      include: { resources: false },
    });
    expect(tools.some((t) => t.name === 'mcp_srv__list_resources')).toBe(false);
    expect(tools.some((t) => t.name === 'mcp_srv__read_resource')).toBe(false);
  });

  it('skips resource meta-tools silently when the client does not implement them', async () => {
    const client: McpClientLike = {
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      // no listResources / readResource
    };

    const tools = await createToolsFromMcpClient(client, { namespace: 'minimal' });
    expect(tools.some((t) => t.name === 'mcp_minimal__list_resources')).toBe(false);
    expect(tools.some((t) => t.name === 'mcp_minimal__read_resource')).toBe(false);
  });

  it('surfaces read_resource transport errors as failed ToolResult', async () => {
    const client = makeFullClient({});
    client.readResource = vi.fn().mockRejectedValue(new Error('transport closed'));

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const readTool = tools.find((t) => t.name === 'mcp_srv__read_resource');
    const result = await readTool?.execute({ uri: 'x://y' });

    expect(result?.success).toBe(false);
    expect(result?.error).toBe('transport closed');
  });
});

describe('createToolsFromMcpClient — prompts (Stage 5.1b)', () => {
  it('emits list_prompts + get_prompt meta-tools when the client supports prompts', async () => {
    const client = makeFullClient({
      prompts: [{ name: 'rewrite', description: 'Rewrite input for clarity' }],
    });

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const names = tools.map((t) => t.name);
    expect(names).toContain('mcp_srv__list_prompts');
    expect(names).toContain('mcp_srv__get_prompt');
  });

  it('list_prompts returns the descriptors verbatim', async () => {
    const descriptors: McpPromptDescriptor[] = [
      {
        name: 'summarize',
        description: 'Summarize a long document',
        arguments: [{ name: 'text', required: true }],
      },
    ];
    const client = makeFullClient({ prompts: descriptors });

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const listTool = tools.find((t) => t.name === 'mcp_srv__list_prompts');
    const result = await listTool?.execute({});

    expect(result?.success).toBe(true);
    expect(result?.data).toEqual(descriptors);
  });

  it('get_prompt flattens text messages into `content`', async () => {
    const client = makeFullClient({
      promptResults: {
        rewrite: {
          description: 'Rewrite helper',
          messages: [
            { role: 'user', content: { type: 'text', text: 'Please rewrite:' } },
            { role: 'user', content: { type: 'text', text: 'Hello world.' } },
          ],
        },
      },
    });

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const getTool = tools.find((t) => t.name === 'mcp_srv__get_prompt');
    const result = await getTool?.execute({ name: 'rewrite' });

    expect(result?.success).toBe(true);
    expect(result?.content).toBe('user: Please rewrite:\n\nuser: Hello world.');
  });

  it('get_prompt handles string-content messages (not just typed-text)', async () => {
    const client = makeFullClient({
      promptResults: {
        greet: {
          messages: [{ role: 'assistant', content: 'Hi there' }],
        },
      },
    });

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const getTool = tools.find((t) => t.name === 'mcp_srv__get_prompt');
    const result = await getTool?.execute({ name: 'greet' });

    expect(result?.success).toBe(true);
    expect(result?.content).toBe('assistant: Hi there');
  });

  it('get_prompt forwards args to the client', async () => {
    const getPromptSpy = vi.fn(async () => ({ messages: [] }));
    const client: McpClientLike = {
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      listPrompts: vi.fn().mockResolvedValue([{ name: 'greet' }]),
      getPrompt: getPromptSpy,
    };

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const getTool = tools.find((t) => t.name === 'mcp_srv__get_prompt');
    await getTool?.execute({ name: 'greet', args: { user: 'alice', style: 'formal' } });

    // The adapter always passes a third `options` argument; it's `undefined` when
    // onProgress + signal are both absent (Stage 5.3 wiring).
    expect(getPromptSpy).toHaveBeenCalledWith(
      'greet',
      { user: 'alice', style: 'formal' },
      undefined,
    );
  });

  it('get_prompt rejects non-string argument values (per MCP spec)', async () => {
    const client = makeFullClient({ promptResults: { greet: { messages: [] } } });
    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const getTool = tools.find((t) => t.name === 'mcp_srv__get_prompt');

    // args.style is a number — zod validation should reject before the call
    await expect(
      getTool?.execute({ name: 'greet', args: { style: 42 as unknown as string } }),
    ).rejects.toThrow();
  });

  it('skips prompt meta-tools when include.prompts is false', async () => {
    const client = makeFullClient({ prompts: [{ name: 'greet' }] });
    const tools = await createToolsFromMcpClient(client, {
      namespace: 'srv',
      include: { prompts: false },
    });
    expect(tools.some((t) => t.name === 'mcp_srv__list_prompts')).toBe(false);
    expect(tools.some((t) => t.name === 'mcp_srv__get_prompt')).toBe(false);
  });

  it('skips prompt meta-tools silently when the client does not implement them', async () => {
    const client: McpClientLike = {
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      // no listPrompts / getPrompt
    };

    const tools = await createToolsFromMcpClient(client, { namespace: 'minimal' });
    expect(tools.some((t) => t.name === 'mcp_minimal__list_prompts')).toBe(false);
    expect(tools.some((t) => t.name === 'mcp_minimal__get_prompt')).toBe(false);
  });
});

describe('createToolsFromMcpClient — progress + signal (Stage 5.3)', () => {
  it('forwards onProgress to server tool calls with namespace + toolName context', async () => {
    const events: unknown[] = [];
    const client = makeClient(
      [{ name: 'long_op', inputSchema: { type: 'object', properties: {} } }],
      async (_name, _args) => ({ content: [] }),
    );
    // Simulate the SDK calling onProgress mid-request.
    client.callTool = vi.fn(async (_name, _args, options) => {
      const onProgress = (options as { onProgress?: (p: unknown) => void } | undefined)?.onProgress;
      onProgress?.({ progress: 25, total: 100, message: 'working' });
      onProgress?.({ progress: 75, total: 100 });
      return { content: [] };
    });

    const tools = await createToolsFromMcpClient(client, {
      namespace: 'srv',
      onProgress: (event) => events.push(event),
    });
    await tools[0]?.execute({});

    expect(events).toEqual([
      {
        namespace: 'srv',
        toolName: 'long_op',
        progress: { progress: 25, total: 100, message: 'working' },
      },
      {
        namespace: 'srv',
        toolName: 'long_op',
        progress: { progress: 75, total: 100 },
      },
    ]);
  });

  it('forwards signal to server tool calls', async () => {
    const captured: Array<unknown> = [];
    const client = makeClient(
      [{ name: 'op', inputSchema: { type: 'object', properties: {} } }],
      async () => ({ content: [] }),
    );
    client.callTool = vi.fn(async (_name, _args, options) => {
      captured.push(options);
      return { content: [] };
    });
    const controller = new AbortController();

    const tools = await createToolsFromMcpClient(client, {
      namespace: 'srv',
      signal: controller.signal,
    });
    await tools[0]?.execute({});

    const firstCall = captured[0] as { signal?: AbortSignal } | undefined;
    expect(firstCall?.signal).toBe(controller.signal);
  });

  it('passes undefined request options when neither onProgress nor signal is set', async () => {
    const captured: Array<unknown> = [];
    const client = makeClient(
      [{ name: 'op', inputSchema: { type: 'object', properties: {} } }],
      async () => ({ content: [] }),
    );
    client.callTool = vi.fn(async (_name, _args, options) => {
      captured.push(options);
      return { content: [] };
    });

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    await tools[0]?.execute({});

    // Undefined, not an empty object — keeps the RPC frame clean.
    expect(captured[0]).toBeUndefined();
  });

  it('forwards onProgress + signal to resource + prompt meta-tools as well', async () => {
    const events: unknown[] = [];
    const listResourceCalls: unknown[] = [];
    const readResourceCalls: unknown[] = [];
    const client: McpClientLike = {
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      listResources: vi.fn(async (options) => {
        listResourceCalls.push(options);
        return [];
      }),
      readResource: vi.fn(async (_uri, options) => {
        readResourceCalls.push(options);
        return [];
      }),
    };
    const controller = new AbortController();

    const tools = await createToolsFromMcpClient(client, {
      namespace: 'srv',
      signal: controller.signal,
      onProgress: (e) => events.push(e),
    });
    const listTool = tools.find((t) => t.name === 'mcp_srv__list_resources');
    const readTool = tools.find((t) => t.name === 'mcp_srv__read_resource');
    await listTool?.execute({});
    await readTool?.execute({ uri: 'x://y' });

    const listOpts = listResourceCalls[0] as { signal?: AbortSignal };
    const readOpts = readResourceCalls[0] as { signal?: AbortSignal };
    expect(listOpts.signal).toBe(controller.signal);
    expect(readOpts.signal).toBe(controller.signal);
  });
});

describe('createToolsFromMcpClient — include flag combinations', () => {
  it('include.tools: false skips server tools but keeps resources + prompts', async () => {
    const client = makeFullClient({
      tools: [{ name: 'list_sites', inputSchema: { type: 'object', properties: {} } }],
      resources: [{ uri: 'x://y', name: 'y' }],
      prompts: [{ name: 'greet' }],
    });

    const tools = await createToolsFromMcpClient(client, {
      namespace: 'srv',
      include: { tools: false },
    });
    expect(tools.some((t) => t.name === 'mcp_srv__list_sites')).toBe(false);
    expect(tools.some((t) => t.name === 'mcp_srv__list_resources')).toBe(true);
    expect(tools.some((t) => t.name === 'mcp_srv__list_prompts')).toBe(true);
  });

  it('emits all three surfaces by default (tools + resources + prompts)', async () => {
    const client = makeFullClient({
      tools: [{ name: 'echo', inputSchema: { type: 'object', properties: {} } }],
      resources: [{ uri: 'x://y', name: 'y' }],
      prompts: [{ name: 'greet' }],
    });

    const tools = await createToolsFromMcpClient(client, { namespace: 'srv' });
    const names = tools.map((t) => t.name);
    expect(names).toContain('mcp_srv__echo');
    expect(names).toContain('mcp_srv__list_resources');
    expect(names).toContain('mcp_srv__read_resource');
    expect(names).toContain('mcp_srv__list_prompts');
    expect(names).toContain('mcp_srv__get_prompt');
  });
});
