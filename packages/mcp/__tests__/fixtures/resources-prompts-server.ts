/**
 * Test fixture: an in-process MCP server exposing resources + prompts.
 *
 * Consumed only by McpClient tests. Intentionally minimal — just enough shape
 * to exercise every code path in the client's resources + prompts surface
 * (including subscribe / unsubscribe, list-changed notifications, resource
 * updates, and prompt argument passthrough).
 *
 * Usage:
 *   const fixture = createResourcesPromptsFixture();
 *   const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
 *   await fixture.server.connect(serverTransport);
 *   // ... point McpClient at clientTransport via { kind: 'custom', transport: clientTransport }
 *
 * The returned handle exposes helpers to trigger server-initiated notifications
 * (resource updates, list-changed) so tests can assert client-side fan-out.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const RESOURCES = [
  { uri: 'mem://doc/alpha', name: 'Alpha', description: 'Alpha doc', mimeType: 'text/plain' },
  { uri: 'mem://doc/beta', name: 'Beta', description: 'Beta doc', mimeType: 'text/plain' },
] as const;

const RESOURCE_CONTENTS: Record<string, string> = {
  'mem://doc/alpha': 'Contents of alpha',
  'mem://doc/beta': 'Contents of beta',
};

const PROMPTS = [
  {
    name: 'greet',
    description: 'Generate a greeting',
    arguments: [{ name: 'who', description: 'Who to greet', required: true }],
  },
  {
    name: 'summarize',
    description: 'Summarize a passage',
    arguments: [{ name: 'text', description: 'Text to summarize', required: true }],
  },
] as const;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type FixtureServer = {
  server: Server;
  /** Emit `notifications/resources/updated` for a URI. */
  triggerResourceUpdate(uri: string): Promise<void>;
  /** Emit `notifications/resources/list_changed`. */
  triggerResourcesListChanged(): Promise<void>;
  /** Emit `notifications/prompts/list_changed`. */
  triggerPromptsListChanged(): Promise<void>;
};

export function createResourcesPromptsFixture(): FixtureServer {
  const server = new Server(
    { name: 'revealui-mcp-test-fixture', version: '0.0.1' },
    {
      capabilities: {
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
      },
    },
  );

  // -----------------------------------------------------------------
  // Resource handlers
  // -----------------------------------------------------------------

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES.map((r) => ({ ...r })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const text = RESOURCE_CONTENTS[uri];
    if (text === undefined) {
      throw new Error(`Resource not found: ${uri}`);
    }
    return { contents: [{ uri, mimeType: 'text/plain', text }] };
  });

  // Subscribe / unsubscribe are acknowledged but track nothing — tests trigger
  // updates explicitly via `triggerResourceUpdate()`.
  server.setRequestHandler(SubscribeRequestSchema, async () => ({}));
  server.setRequestHandler(UnsubscribeRequestSchema, async () => ({}));

  // -----------------------------------------------------------------
  // Prompt handlers
  // -----------------------------------------------------------------

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS.map((p) => ({
      ...p,
      arguments: p.arguments.map((a) => ({ ...a })),
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments ?? {};

    if (name === 'greet') {
      const who = args.who ?? 'world';
      return {
        description: 'Generate a greeting',
        messages: [{ role: 'user', content: { type: 'text', text: `Greet ${who}.` } }],
      };
    }
    if (name === 'summarize') {
      const text = args.text ?? '';
      return {
        description: 'Summarize a passage',
        messages: [{ role: 'user', content: { type: 'text', text: `Summarize: ${text}` } }],
      };
    }
    throw new Error(`Prompt not found: ${name}`);
  });

  return {
    server,
    async triggerResourceUpdate(uri: string) {
      await server.notification({
        method: 'notifications/resources/updated',
        params: { uri },
      });
    },
    async triggerResourcesListChanged() {
      await server.notification({ method: 'notifications/resources/list_changed' });
    },
    async triggerPromptsListChanged() {
      await server.notification({ method: 'notifications/prompts/list_changed' });
    },
  };
}
