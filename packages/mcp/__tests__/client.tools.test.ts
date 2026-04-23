/**
 * McpClient tools coverage (Stage 3.2).
 *
 * Tools were deliberately out of Stage 0 — the hypervisor handled stdio tool
 * calls through its custom JSON-RPC. Stage 3.2 adds `listTools` and
 * `callTool` to the full-protocol client so the admin tool browser works
 * against remote Streamable-HTTP servers.
 */

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { McpCapabilityError, McpClient } from '../src/client.js';

function makeToolsFixture() {
  const server = new Server(
    { name: 'tools-fixture', version: '0.0.1' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'echo',
        description: 'Echoes the input text',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to echo' },
          },
          required: ['text'],
        },
      },
      {
        name: 'fail',
        description: 'Always returns an error',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === 'echo') {
      const args = (req.params.arguments ?? {}) as { text?: string };
      return {
        content: [{ type: 'text', text: `echo: ${args.text ?? ''}` }],
      };
    }
    if (req.params.name === 'fail') {
      return {
        content: [{ type: 'text', text: 'tool failed on purpose' }],
        isError: true,
      };
    }
    throw new Error(`unknown tool: ${req.params.name}`);
  });

  return server;
}

async function connectedClient(): Promise<McpClient> {
  const server = makeToolsFixture();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new McpClient({
    clientInfo: { name: 'tools-test', version: '0.0.0' },
    transport: { kind: 'custom', transport: clientTransport },
  });
  await client.connect();
  return client;
}

describe('McpClient tools', () => {
  let client: McpClient | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  it('listTools returns the server-advertised tools', async () => {
    client = await connectedClient();
    const tools = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['echo', 'fail']);
    expect(tools.find((t) => t.name === 'echo')?.inputSchema?.required).toEqual(['text']);
  });

  it('callTool echoes structured arguments and returns a content array', async () => {
    client = await connectedClient();
    const result = await client.callTool('echo', { text: 'hello' });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'echo: hello' });
    expect(result.isError).toBeFalsy();
  });

  it('surfaces tool failures in-band via isError rather than throwing', async () => {
    client = await connectedClient();
    const result = await client.callTool('fail');
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });

  it('throws McpCapabilityError when the server does not advertise tools', async () => {
    const server = new Server(
      { name: 'no-tools', version: '0.0.1' },
      { capabilities: {} }, // no tools capability
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new McpClient({
      clientInfo: { name: 'tools-test', version: '0.0.0' },
      transport: { kind: 'custom', transport: clientTransport },
    });
    await client.connect();

    await expect(client.listTools()).rejects.toBeInstanceOf(McpCapabilityError);
    await expect(client.callTool('any')).rejects.toBeInstanceOf(McpCapabilityError);
  });
});
