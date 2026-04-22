/**
 * MCP Client wrapper for `@revealui/mcp`.
 *
 * Phase: Stage 0 of the MCP v1 plan (see `.jv/docs/mcp-productionization-scope.md`).
 *
 * Wraps `@modelcontextprotocol/sdk`'s `Client` with a RevealUI-shaped surface:
 * transport selection, capability enforcement (method throws a typed error if
 * the server doesn't advertise the feature), and per-URI resource
 * subscription fan-out with automatic protocol-level subscribe/unsubscribe.
 *
 * PR-0.1 (this PR) ships the resources + prompts surface. Subsequent Stage 0
 * PRs layer on sampling, elicitation, roots, completions, logging, progress,
 * cancellation, and generic notification handling using the same `McpClient`
 * instance.
 *
 * The hypervisor (`./hypervisor.ts`) continues to speak its custom JSON-RPC
 * for tool calls. Stage 1 migrates the hypervisor to route through this
 * client so transport abstraction (Streamable HTTP) lands cleanly.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type Prompt,
  type PromptMessage,
  type Resource,
  type ResourceContents,
  ResourceUpdatedNotificationSchema,
  type ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js';

// ---------------------------------------------------------------------------
// Transport options
// ---------------------------------------------------------------------------

/**
 * Spawn a local subprocess and talk MCP over its stdio.
 * Matches `StdioClientTransport` from the SDK; we surface the fields we use.
 */
export type StdioTransportOptions = {
  kind: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

/**
 * Inject a pre-built SDK `Transport`. Intended for tests (`InMemoryTransport`)
 * and for experimental transports not yet first-classed in this discriminator.
 * Stage 1 adds `{ kind: 'streamable-http'; ... }`.
 */
export type CustomTransportOptions = {
  kind: 'custom';
  transport: Transport;
};

export type TransportOptions = StdioTransportOptions | CustomTransportOptions;

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export type McpClientOptions = {
  /** Advertised to the server during `initialize`. Required by spec. */
  clientInfo: { name: string; version: string };
  /** Where and how to reach the server. */
  transport: TransportOptions;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a caller invokes a method that requires a server-side capability
 * the server did NOT advertise during initialize. Signals a misconfiguration
 * or a version mismatch — not a transient failure; do not retry.
 */
export class McpCapabilityError extends Error {
  public readonly capability: string;
  constructor(capability: string) {
    super(`MCP server does not advertise the '${capability}' capability`);
    this.name = 'McpCapabilityError';
    this.capability = capability;
  }
}

/**
 * Thrown when a method is called before `connect()` has resolved.
 */
export class McpNotConnectedError extends Error {
  constructor(method: string) {
    super(`McpClient.${method}() called before connect()`);
    this.name = 'McpNotConnectedError';
  }
}

// ---------------------------------------------------------------------------
// Public types re-exported for convenience
// ---------------------------------------------------------------------------

export type { Prompt, PromptMessage, Resource, ResourceContents, ServerCapabilities };

/** Parameters delivered to a `subscribeResource` handler. */
export type ResourceUpdatedParams = { uri: string };

/** Return shape of `getPrompt` — the spec's `GetPromptResult`, narrowed. */
export type GetPromptResult = {
  description?: string;
  messages: PromptMessage[];
};

// ---------------------------------------------------------------------------
// McpClient
// ---------------------------------------------------------------------------

type ListChangedChannel = 'resources' | 'prompts' | 'tools';

export class McpClient {
  private readonly sdk: Client;
  private readonly options: McpClientOptions;
  private connected = false;
  private readonly resourceSubscribers = new Map<
    string,
    Set<(params: ResourceUpdatedParams) => void>
  >();
  private readonly listChangedHandlers: Record<ListChangedChannel, Set<() => void>> = {
    resources: new Set(),
    prompts: new Set(),
    tools: new Set(),
  };

  constructor(options: McpClientOptions) {
    this.options = options;
    this.sdk = new Client(options.clientInfo, {
      capabilities: {},
      listChanged: {
        resources: { onChanged: () => this.fireListChanged('resources') },
        prompts: { onChanged: () => this.fireListChanged('prompts') },
        tools: { onChanged: () => this.fireListChanged('tools') },
      },
    });

    // Fan notifications/resources/updated out to per-URI subscribers. The SDK
    // calls this handler for every update; we dispatch to interested parties.
    this.sdk.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
      const uri = notification.params.uri;
      const subscribers = this.resourceSubscribers.get(uri);
      if (!subscribers) return;
      for (const handler of subscribers) {
        try {
          handler({ uri });
        } catch {
          // Swallow per-subscriber errors; one bad handler must not disrupt
          // the others, and the SDK doesn't care either way.
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Connect the underlying transport and run MCP `initialize`. Idempotent:
   * calling twice is a no-op on the second call.
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    const transport = this.createTransport();
    await this.sdk.connect(transport);
    this.connected = true;
  }

  /**
   * Close the underlying transport and invalidate the client. Idempotent.
   */
  async close(): Promise<void> {
    if (!this.connected) return;
    await this.sdk.close();
    this.connected = false;
    this.resourceSubscribers.clear();
  }

  /** Server capabilities returned by `initialize`. Undefined before connect. */
  getServerCapabilities(): ServerCapabilities | undefined {
    return this.sdk.getServerCapabilities();
  }

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------

  async listResources(): Promise<Resource[]> {
    this.assertConnected('listResources');
    this.requireCapability('resources');
    const result = await this.sdk.listResources();
    return result.resources;
  }

  async readResource(uri: string): Promise<ResourceContents[]> {
    this.assertConnected('readResource');
    this.requireCapability('resources');
    const result = await this.sdk.readResource({ uri });
    return result.contents;
  }

  /**
   * Subscribe to updates for a single resource URI. The returned function
   * removes this subscription (and unsubscribes on the wire once no
   * subscribers remain for the URI).
   *
   * Requires the server to advertise `resources.subscribe`; throws
   * `McpCapabilityError` otherwise.
   */
  async subscribeResource(
    uri: string,
    handler: (params: ResourceUpdatedParams) => void,
  ): Promise<() => Promise<void>> {
    this.assertConnected('subscribeResource');
    const caps = this.getServerCapabilities();
    if (!caps?.resources) throw new McpCapabilityError('resources');
    if (!caps.resources.subscribe) throw new McpCapabilityError('resources.subscribe');

    let subscribers = this.resourceSubscribers.get(uri);
    if (!subscribers) {
      subscribers = new Set();
      this.resourceSubscribers.set(uri, subscribers);
      await this.sdk.subscribeResource({ uri });
    }
    subscribers.add(handler);

    let disposed = false;
    return async () => {
      if (disposed) return;
      disposed = true;
      const current = this.resourceSubscribers.get(uri);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.resourceSubscribers.delete(uri);
        if (this.connected) {
          await this.sdk.unsubscribeResource({ uri });
        }
      }
    };
  }

  // -------------------------------------------------------------------------
  // Prompts
  // -------------------------------------------------------------------------

  async listPrompts(): Promise<Prompt[]> {
    this.assertConnected('listPrompts');
    this.requireCapability('prompts');
    const result = await this.sdk.listPrompts();
    return result.prompts;
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    this.assertConnected('getPrompt');
    this.requireCapability('prompts');
    const params = args === undefined ? { name } : { name, arguments: args };
    const result = await this.sdk.getPrompt(params);
    return {
      description: result.description,
      messages: result.messages,
    };
  }

  // -------------------------------------------------------------------------
  // List-changed subscriptions
  // -------------------------------------------------------------------------

  onResourcesListChanged(handler: () => void): () => void {
    return this.addListChanged('resources', handler);
  }

  onPromptsListChanged(handler: () => void): () => void {
    return this.addListChanged('prompts', handler);
  }

  onToolsListChanged(handler: () => void): () => void {
    return this.addListChanged('tools', handler);
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async ping(): Promise<void> {
    this.assertConnected('ping');
    await this.sdk.ping();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private createTransport(): Transport {
    const t = this.options.transport;
    switch (t.kind) {
      case 'stdio':
        return new StdioClientTransport({
          command: t.command,
          args: t.args,
          env: t.env,
          cwd: t.cwd,
        });
      case 'custom':
        return t.transport;
    }
  }

  private assertConnected(method: string): void {
    if (!this.connected) throw new McpNotConnectedError(method);
  }

  private requireCapability(capability: 'resources' | 'prompts' | 'tools' | 'logging'): void {
    const caps = this.getServerCapabilities();
    if (!caps?.[capability]) throw new McpCapabilityError(capability);
  }

  private addListChanged(channel: ListChangedChannel, handler: () => void): () => void {
    this.listChangedHandlers[channel].add(handler);
    return () => {
      this.listChangedHandlers[channel].delete(handler);
    };
  }

  private fireListChanged(channel: ListChangedChannel): void {
    for (const handler of this.listChangedHandlers[channel]) {
      try {
        handler();
      } catch {
        // Swallow per-subscriber errors.
      }
    }
  }
}
