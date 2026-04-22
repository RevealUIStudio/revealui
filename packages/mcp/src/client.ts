/**
 * MCP Client wrapper for `@revealui/mcp`.
 *
 * Phase: Stage 0 of the MCP v1 plan (see `.jv/docs/mcp-productionization-scope.md`).
 *
 * Wraps `@modelcontextprotocol/sdk`'s `Client` with a RevealUI-shaped surface:
 * transport selection, capability enforcement (method throws a typed error if
 * the server doesn't advertise the feature), per-URI resource subscription
 * fan-out, and application-layer handlers for the server-initiated primitives
 * (sampling, elicitation, roots).
 *
 * Stage 0 completion as of PR-0.3:
 *   PR-0.1 — resources + prompts.
 *   PR-0.2 — sampling + elicitation + roots + completions.
 *   PR-0.3 — logging, progress, cancellation, generic notification routing,
 *            per-request options (signal + onProgress + timeout) threaded
 *            through every client-initiated call.
 *
 * The hypervisor (`./hypervisor.ts`) continues to speak its custom JSON-RPC
 * for tool calls. Stage 1 migrates the hypervisor to route through this
 * client so transport abstraction (Streamable HTTP) lands cleanly.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
  type StreamableHTTPReconnectionOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AnyObjectSchema, SchemaOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type ClientCapabilities,
  type CompleteRequest,
  type CompleteResult,
  type CreateMessageRequest,
  CreateMessageRequestSchema,
  type CreateMessageResult,
  type ElicitRequest,
  ElicitRequestSchema,
  type ElicitResult,
  ListRootsRequestSchema,
  type LoggingLevel,
  type LoggingMessageNotification,
  LoggingMessageNotificationSchema,
  type Progress,
  type Prompt,
  type PromptMessage,
  type PromptReference,
  type Resource,
  type ResourceContents,
  type ResourceTemplateReference,
  ResourceUpdatedNotificationSchema,
  type Root,
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
 */
export type CustomTransportOptions = {
  kind: 'custom';
  transport: Transport;
};

/**
 * Talk MCP over the spec's Streamable HTTP transport. The preferred remote
 * transport as of the 2025 spec revision — supports request/response JSON,
 * SSE streaming for progress/notifications, and OAuth 2.1 for authenticated
 * deployments.
 *
 * OAuth wiring lands in Stage 2; this PR (Stage 1) exposes the transport
 * without an `authProvider`. Callers who need auth before Stage 2 can pass
 * their own bearer token via `requestInit.headers`.
 */
export type StreamableHttpTransportOptions = {
  kind: 'streamable-http';
  /** MCP endpoint URL (e.g. `https://example.com/mcp`). */
  url: string | URL;
  /** Fetch `RequestInit` applied to every outgoing request. Use this for
   *  headers, credentials, custom signals, etc. */
  requestInit?: RequestInit;
  /** Override `fetch`. Defaults to global `fetch`. */
  fetch?: typeof fetch;
  /** Reuse a server-issued session ID (e.g. for reconnection). */
  sessionId?: string;
  /** SSE reconnection tuning (delays, retry ceiling). */
  reconnectionOptions?: StreamableHTTPReconnectionOptions;
};

export type TransportOptions =
  | StdioTransportOptions
  | CustomTransportOptions
  | StreamableHttpTransportOptions;

export type { StreamableHTTPClientTransportOptions, StreamableHTTPReconnectionOptions };

// ---------------------------------------------------------------------------
// Application-layer handlers for server-initiated requests
// ---------------------------------------------------------------------------

/**
 * Handle a `sampling/createMessage` request FROM the server. The server is
 * asking the client to run an LLM completion on its behalf — typically the
 * client delegates to the application's configured LLM provider.
 *
 * Providing this handler causes the client to advertise the `sampling`
 * capability during initialize; omitting it leaves the capability absent and
 * the server will treat sampling as unsupported.
 */
export type SamplingHandler = (
  params: CreateMessageRequest['params'],
) => Promise<CreateMessageResult>;

/**
 * Handle an `elicitation/create` request FROM the server. The server is
 * asking the client to elicit structured input from the user (form mode) or
 * direct them to a URL (URL mode). The handler is responsible for rendering
 * UI and returning the user's response.
 */
export type ElicitationHandler = (params: ElicitRequest['params']) => Promise<ElicitResult>;

/**
 * Return the client's current roots (directories or URI namespaces it
 * exposes to the server). Called each time the server issues `roots/list`,
 * so the provider SHOULD return current state rather than a cached snapshot.
 *
 * Providing this advertises the `roots` capability (with `listChanged: true`
 * — the client can notify via `notifyRootsListChanged()`).
 */
export type RootsProvider = () => Root[] | Promise<Root[]>;

// ---------------------------------------------------------------------------
// Per-request options
// ---------------------------------------------------------------------------

/**
 * Per-request options applied to every client-initiated call. Mirrors the
 * SDK's `RequestOptions` but exposes only the fields we expect consumers to
 * use (we may add more as Stage 0 / 1 evolve).
 *
 * - `signal` — pass an `AbortSignal` to cancel the request mid-flight. When
 *   aborted the SDK emits `notifications/cancelled` to the server and the
 *   pending promise rejects with an AbortError.
 * - `onProgress` — subscribe to per-request progress notifications. The SDK
 *   automatically correlates `notifications/progress` by the progress token
 *   and invokes this callback.
 * - `timeout` — request-level timeout in ms. If exceeded the SDK raises a
 *   `RequestTimeout` error. Absent = SDK default.
 * - `resetTimeoutOnProgress` — if true, receiving a progress notification
 *   resets the timeout clock. Useful for long-running operations.
 */
export type McpRequestOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  timeout?: number;
  resetTimeoutOnProgress?: boolean;
};

/** Internal: translate our options to the SDK's native shape. */
function toSdkRequestOptions(options?: McpRequestOptions): RequestOptions | undefined {
  if (!options) return undefined;
  const sdkOptions: RequestOptions = {};
  if (options.signal) sdkOptions.signal = options.signal;
  if (options.onProgress) sdkOptions.onprogress = options.onProgress;
  if (options.timeout !== undefined) sdkOptions.timeout = options.timeout;
  if (options.resetTimeoutOnProgress !== undefined) {
    sdkOptions.resetTimeoutOnProgress = options.resetTimeoutOnProgress;
  }
  return sdkOptions;
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export type McpClientOptions = {
  /** Advertised to the server during `initialize`. Required by spec. */
  clientInfo: { name: string; version: string };
  /** Where and how to reach the server. */
  transport: TransportOptions;
  /** Handle `sampling/createMessage` requests from the server. */
  samplingHandler?: SamplingHandler;
  /** Handle `elicitation/create` requests from the server. */
  elicitationHandler?: ElicitationHandler;
  /** Provide the client's current roots in response to `roots/list`. */
  rootsProvider?: RootsProvider;
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

export type {
  ClientCapabilities,
  CompleteRequest,
  CompleteResult,
  CreateMessageRequest,
  CreateMessageResult,
  ElicitRequest,
  ElicitResult,
  LoggingLevel,
  LoggingMessageNotification,
  Progress,
  Prompt,
  PromptMessage,
  PromptReference,
  Resource,
  ResourceContents,
  ResourceTemplateReference,
  Root,
  ServerCapabilities,
};

/** Parameters delivered to a `subscribeResource` handler. */
export type ResourceUpdatedParams = { uri: string };

/** Return shape of `getPrompt` — the spec's `GetPromptResult`, narrowed. */
export type GetPromptResult = {
  description?: string;
  messages: PromptMessage[];
};

/** Either a prompt or a resource-template reference — the two valid targets
 *  for `completions/complete`. */
export type CompletionReference = PromptReference | ResourceTemplateReference;

/** The completion result returned by `complete()`. */
export type Completion = CompleteResult['completion'];

/** Parameters delivered to an `onLog` subscriber. */
export type LogMessageParams = LoggingMessageNotification['params'];

// ---------------------------------------------------------------------------
// Capability auto-advertisement
// ---------------------------------------------------------------------------

/**
 * Derive the client capability declaration from which handlers/providers the
 * caller supplied. Only features we can actually service get advertised.
 *
 * Form-mode elicitation is advertised as the default when an elicitation
 * handler is provided (matches the SDK's interpretation of `elicitation: {}`).
 * URL-mode callers who want that surface explicitly can add it — future
 * enhancement; today the handler is a single entry point.
 */
function buildCapabilities(options: McpClientOptions): ClientCapabilities {
  const caps: ClientCapabilities = {};
  if (options.samplingHandler) caps.sampling = {};
  if (options.elicitationHandler) caps.elicitation = {};
  if (options.rootsProvider) caps.roots = { listChanged: true };
  return caps;
}

// ---------------------------------------------------------------------------
// McpClient
// ---------------------------------------------------------------------------

type ListChangedChannel = 'resources' | 'prompts' | 'tools';

// biome-ignore lint/suspicious/noExplicitAny: handler payload type is recovered from the schema
type NotificationHandler = (notification: any) => void;

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
  /**
   * Subscribers per notification schema. First `on(schema, handler)` call for
   * a schema registers a single fan-out handler with the SDK; subsequent
   * calls just add to the Set. Removing the last subscriber keeps the SDK
   * handler registered (no public API to unregister by schema) — empty
   * fan-out is a cheap no-op.
   */
  private readonly notificationSubscribers = new Map<AnyObjectSchema, Set<NotificationHandler>>();

  constructor(options: McpClientOptions) {
    this.options = options;
    this.sdk = new Client(options.clientInfo, {
      capabilities: buildCapabilities(options),
      listChanged: {
        resources: { onChanged: () => this.fireListChanged('resources') },
        prompts: { onChanged: () => this.fireListChanged('prompts') },
        tools: { onChanged: () => this.fireListChanged('tools') },
      },
    });

    // Route resource-updated notifications through the generic fan-out so the
    // same `on(ResourceUpdatedNotificationSchema, ...)` subscription API
    // remains available without overwriting our per-URI subscriber dispatch.
    this.on(ResourceUpdatedNotificationSchema, (notification) => {
      const uri = notification.params.uri;
      const subscribers = this.resourceSubscribers.get(uri);
      if (!subscribers) return;
      for (const handler of subscribers) {
        try {
          handler({ uri });
        } catch {
          // Swallow per-subscriber errors.
        }
      }
    });

    // Register server-initiated request handlers. Each is only wired when the
    // caller supplied the corresponding handler/provider — that way the
    // declared capability set matches what we can actually service.
    if (options.samplingHandler) {
      const handler = options.samplingHandler;
      this.sdk.setRequestHandler(CreateMessageRequestSchema, (request) => handler(request.params));
    }
    if (options.elicitationHandler) {
      const handler = options.elicitationHandler;
      this.sdk.setRequestHandler(ElicitRequestSchema, (request) => handler(request.params));
    }
    if (options.rootsProvider) {
      const provider = options.rootsProvider;
      this.sdk.setRequestHandler(ListRootsRequestSchema, async () => ({
        roots: await provider(),
      }));
    }
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

  async listResources(options?: McpRequestOptions): Promise<Resource[]> {
    this.assertConnected('listResources');
    this.requireCapability('resources');
    const result = await this.sdk.listResources(undefined, toSdkRequestOptions(options));
    return result.resources;
  }

  async readResource(uri: string, options?: McpRequestOptions): Promise<ResourceContents[]> {
    this.assertConnected('readResource');
    this.requireCapability('resources');
    const result = await this.sdk.readResource({ uri }, toSdkRequestOptions(options));
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
    options?: McpRequestOptions,
  ): Promise<() => Promise<void>> {
    this.assertConnected('subscribeResource');
    const caps = this.getServerCapabilities();
    if (!caps?.resources) throw new McpCapabilityError('resources');
    if (!caps.resources.subscribe) throw new McpCapabilityError('resources.subscribe');

    let subscribers = this.resourceSubscribers.get(uri);
    if (!subscribers) {
      subscribers = new Set();
      this.resourceSubscribers.set(uri, subscribers);
      await this.sdk.subscribeResource({ uri }, toSdkRequestOptions(options));
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

  async listPrompts(options?: McpRequestOptions): Promise<Prompt[]> {
    this.assertConnected('listPrompts');
    this.requireCapability('prompts');
    const result = await this.sdk.listPrompts(undefined, toSdkRequestOptions(options));
    return result.prompts;
  }

  async getPrompt(
    name: string,
    args?: Record<string, string>,
    options?: McpRequestOptions,
  ): Promise<GetPromptResult> {
    this.assertConnected('getPrompt');
    this.requireCapability('prompts');
    const params = args === undefined ? { name } : { name, arguments: args };
    const result = await this.sdk.getPrompt(params, toSdkRequestOptions(options));
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
  // Roots
  // -------------------------------------------------------------------------

  /**
   * Notify the server that the client's roots have changed. The server will
   * typically re-fetch via `roots/list`, which routes to the `rootsProvider`
   * passed at construction. No-op if the client wasn't constructed with a
   * `rootsProvider` — advertising list-changed without a provider is
   * nonsensical, so we fail fast.
   */
  async notifyRootsListChanged(): Promise<void> {
    this.assertConnected('notifyRootsListChanged');
    if (!this.options.rootsProvider) {
      throw new Error(
        'McpClient.notifyRootsListChanged() requires a rootsProvider at construction',
      );
    }
    await this.sdk.sendRootsListChanged();
  }

  // -------------------------------------------------------------------------
  // Completions
  // -------------------------------------------------------------------------

  /**
   * Request argument completions from the server. The reference points at a
   * prompt or resource-template; the server returns suggestion values for
   * the named argument given the current partial value.
   */
  async complete(
    reference: CompletionReference,
    argument: { name: string; value: string },
    options?: McpRequestOptions,
  ): Promise<Completion> {
    this.assertConnected('complete');
    this.requireCapability('completions');
    const params: CompleteRequest['params'] = { ref: reference, argument };
    const result = await this.sdk.complete(params, toSdkRequestOptions(options));
    return result.completion;
  }

  // -------------------------------------------------------------------------
  // Logging (PR-0.3)
  // -------------------------------------------------------------------------

  /**
   * Set the minimum log level the server should emit. Requires the server to
   * advertise the `logging` capability.
   */
  async setLoggingLevel(level: LoggingLevel, options?: McpRequestOptions): Promise<void> {
    this.assertConnected('setLoggingLevel');
    this.requireCapability('logging');
    await this.sdk.setLoggingLevel(level, toSdkRequestOptions(options));
  }

  /**
   * Subscribe to server-emitted log messages. Returns an unregister function.
   *
   * Implemented on top of the generic `on()` fan-out, so multiple subscribers
   * coexist cleanly (admin UI, CLI logger, telemetry exporter, …).
   */
  onLog(handler: (params: LogMessageParams) => void): () => void {
    return this.on(LoggingMessageNotificationSchema, (notification) => {
      handler(notification.params);
    });
  }

  // -------------------------------------------------------------------------
  // Generic notification subscription (PR-0.3)
  // -------------------------------------------------------------------------

  /**
   * Subscribe to arbitrary server notifications by zod schema. First
   * subscription per schema installs a single SDK handler that fans out to
   * every registered subscriber; later subscriptions join the existing fan.
   * Returns an unregister function.
   *
   * Typically callers use the purpose-built subscribers (`onLog`,
   * `onResourcesListChanged`, `subscribeResource`) rather than this. Use
   * `on()` for schemas the client doesn't yet expose a named subscriber for.
   */
  on<T extends AnyObjectSchema>(
    schema: T,
    handler: (notification: SchemaOutput<T>) => void,
  ): () => void {
    let subscribers = this.notificationSubscribers.get(schema);
    if (!subscribers) {
      subscribers = new Set<NotificationHandler>();
      this.notificationSubscribers.set(schema, subscribers);
      const fanOut: NotificationHandler = (notification) => {
        for (const h of subscribers ?? []) {
          try {
            h(notification);
          } catch {
            // Swallow per-subscriber errors.
          }
        }
      };
      this.sdk.setNotificationHandler(schema, fanOut);
    }
    subscribers.add(handler as NotificationHandler);
    return () => {
      subscribers?.delete(handler as NotificationHandler);
    };
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async ping(options?: McpRequestOptions): Promise<void> {
    this.assertConnected('ping');
    await this.sdk.ping(toSdkRequestOptions(options));
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
      case 'streamable-http': {
        const url = t.url instanceof URL ? t.url : new URL(t.url);
        const sdkOptions: StreamableHTTPClientTransportOptions = {};
        if (t.requestInit) sdkOptions.requestInit = t.requestInit;
        if (t.fetch) sdkOptions.fetch = t.fetch;
        if (t.sessionId) sdkOptions.sessionId = t.sessionId;
        if (t.reconnectionOptions) sdkOptions.reconnectionOptions = t.reconnectionOptions;
        return new StreamableHTTPClientTransport(url, sdkOptions);
      }
    }
  }

  private assertConnected(method: string): void {
    if (!this.connected) throw new McpNotConnectedError(method);
  }

  private requireCapability(
    capability: 'resources' | 'prompts' | 'tools' | 'logging' | 'completions',
  ): void {
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
