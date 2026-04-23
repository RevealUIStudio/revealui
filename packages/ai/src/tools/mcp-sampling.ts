/**
 * MCP Sampling — route server `sampling/createMessage` requests through
 * the agent's configured LLM provider (Stage 5.2 of the MCP v1 plan).
 *
 * The MCP spec defines `sampling/createMessage` as a server-to-client
 * request: an MCP server asks the client to invoke an LLM on its behalf.
 * The client decides which model runs, keeps full control over costs +
 * context, and the server gets LLM capabilities without bundling a
 * provider. On RevealUI's Ubuntu reference stack, the target is a local
 * Canonical Inference Snap — so sampling traffic stays on-device.
 *
 * This module exposes `createSamplingHandler()` — a factory that wraps
 * the agent's `LLMProvider` (or `LLMClient`) into a handler of the
 * structural shape `McpSamplingHandler`. Consumers pass the resulting
 * handler to `McpClient` at construction time:
 *
 * @example
 * ```typescript
 * import { McpClient } from '@revealui/mcp/client';
 * import { InferenceSnapsProvider, createSamplingHandler } from '@revealui/ai';
 *
 * const llm = new InferenceSnapsProvider({
 *   baseURL: 'http://localhost:9090/v1',
 *   model: 'gemma3',
 * });
 *
 * const client = new McpClient({
 *   clientInfo: { name: 'my-agent', version: '1.0.0' },
 *   transport: { kind: 'streamable-http', url: 'https://example.com/mcp' },
 *   samplingHandler: createSamplingHandler({
 *     llm,
 *     defaultModel: 'gemma3',
 *     allowedModels: ['gemma3', 'deepseek-r1'],
 *   }),
 * });
 * await client.connect();
 * ```
 *
 * As with the rest of the MCP-adapter surface, this module uses
 * structural typing to stay decoupled from `@revealui/mcp` at the
 * package level — no runtime import of the SDK. The real
 * `SamplingHandler` from `@revealui/mcp/client` structurally satisfies
 * the `McpSamplingHandler` shape exported here.
 */

import type { LLMChatOptions, LLMResponse, Message } from '../llm/providers/base.js';
import { emitMcpEvent, type McpEventSink } from './mcp-events.js';

// ---------------------------------------------------------------------------
// Structural LLM shape
// ---------------------------------------------------------------------------

/**
 * Minimal shape needed from an LLM to serve sampling requests. Both
 * `@revealui/ai`'s `LLMProvider` and `LLMClient` structurally satisfy this
 * — consumers pass whichever they have. Decoupled via structural typing
 * so test code can pass an even smaller stub.
 */
export interface SamplingLLM {
  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse>;
}

// ---------------------------------------------------------------------------
// Structural MCP spec types (subset)
// ---------------------------------------------------------------------------

/** One message in a `sampling/createMessage` request. */
export interface McpSamplingMessage {
  role: 'user' | 'assistant';
  content: {
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  };
}

/** Model preference hint (spec: `ModelHint`). */
export interface McpModelHint {
  name?: string;
}

/** Parameters of a `sampling/createMessage` request (spec-shaped subset). */
export interface McpSamplingRequestParams {
  messages: ReadonlyArray<McpSamplingMessage>;
  modelPreferences?: {
    hints?: ReadonlyArray<McpModelHint>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens: number;
  stopSequences?: ReadonlyArray<string>;
  metadata?: Record<string, unknown>;
}

/** Result of a `sampling/createMessage` request (spec-shaped subset). */
export interface McpSamplingResult {
  model: string;
  stopReason?: 'maxTokens' | 'endTurn' | 'stopSequence' | string;
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

/** Structural shape of the handler — matches `SamplingHandler` from `@revealui/mcp/client`. */
export type McpSamplingHandler = (params: McpSamplingRequestParams) => Promise<McpSamplingResult>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateSamplingHandlerOptions {
  /** LLM to route sampling requests through. */
  llm: SamplingLLM;
  /**
   * Allowlist of models that servers may request via `modelPreferences.hints`.
   * Hint names outside the allowlist are filtered out of selection. When
   * unset, every hint is accepted.
   *
   * **Advisory, not enforced.** `@revealui/ai`'s current `LLMProvider`
   * shape fixes the model at provider construction — this handler does
   * NOT re-route per-request to different providers. The resolved model
   * is reported back to the server in `result.model` (so the server
   * knows what actually ran) but the call always goes to `options.llm`.
   * For per-model routing, the consumer wires their own multiplexer
   * (e.g. via `selectModel` + an `LLMClient` that internally dispatches).
   */
  allowedModels?: ReadonlyArray<string>;
  /**
   * Label used for `result.model` when no hint matches (or no hints).
   * Purely for reporting. When omitted, `'unknown'` is reported.
   */
  defaultModel?: string;
  /**
   * Custom model selector. Overrides the default hint-matching logic.
   * Return `undefined` to fall back to `defaultModel`.
   */
  selectModel?: (
    hints: ReadonlyArray<McpModelHint>,
    options: { allowedModels?: ReadonlyArray<string>; defaultModel?: string },
  ) => string | undefined;
  /**
   * Observability hook invoked before each sampling call. Useful for
   * metering / audit trails / cost tracking.
   */
  onSamplingRequest?: (info: {
    model: string;
    messageCount: number;
    maxTokens: number;
    systemPrompt?: string;
  }) => void;
  /**
   * Protocol-level observability sink (Stage 6.1). Fires once per
   * `sampling/createMessage` call (after the LLM responds, or on
   * failure) with `{ kind: 'mcp.sampling.create', model, messageCount,
   * maxTokens, duration_ms, success, error? }`. Set `namespace` when
   * the handler is attached to a single-server `McpClient` so events
   * can be grouped in the aggregator.
   */
  onEvent?: McpEventSink;
  /**
   * Optional server identifier included in emitted events. Leave unset
   * when the handler is shared across multiple servers — consumer's
   * sink wrapper can fill in namespace from call-site context.
   */
  namespace?: string;
}

export function createSamplingHandler(options: CreateSamplingHandlerOptions): McpSamplingHandler {
  const { llm, allowedModels, defaultModel, selectModel, onSamplingRequest, onEvent, namespace } =
    options;

  return async (params: McpSamplingRequestParams): Promise<McpSamplingResult> => {
    const model = resolveModel(params.modelPreferences?.hints, {
      allowedModels,
      defaultModel,
      selectModel,
    });

    const messages = convertToLLMMessages(params);

    const reportedModel = model ?? 'unknown';
    onSamplingRequest?.({
      model: reportedModel,
      messageCount: params.messages.length,
      maxTokens: params.maxTokens,
      ...(params.systemPrompt !== undefined ? { systemPrompt: params.systemPrompt } : {}),
    });

    // `stopSequences` is NOT passed — the current `LLMChatOptions` doesn't
    // expose it (per-provider inconsistency). The MCP spec treats
    // stopSequences as advisory, so omitting is compliant. A future
    // provider-interface extension can wire this through.
    const chatOptions: LLMChatOptions = {
      maxTokens: params.maxTokens,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    };

    const started = Date.now();
    try {
      const response = await llm.chat(messages, chatOptions);

      emitMcpEvent(onEvent, {
        kind: 'mcp.sampling.create',
        ...(namespace !== undefined ? { namespace } : {}),
        model: reportedModel,
        messageCount: params.messages.length,
        maxTokens: params.maxTokens,
        duration_ms: Date.now() - started,
        success: true,
      });

      const stopReason = mapFinishReason(response.finishReason);
      const result: McpSamplingResult = {
        model: reportedModel,
        role: 'assistant',
        content: {
          type: 'text',
          text: response.content,
        },
      };
      if (stopReason !== undefined) {
        result.stopReason = stopReason;
      }
      return result;
    } catch (error) {
      emitMcpEvent(onEvent, {
        kind: 'mcp.sampling.create',
        ...(namespace !== undefined ? { namespace } : {}),
        model: reportedModel,
        messageCount: params.messages.length,
        maxTokens: params.maxTokens,
        duration_ms: Date.now() - started,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveModel(
  hints: ReadonlyArray<McpModelHint> | undefined,
  options: {
    allowedModels?: ReadonlyArray<string>;
    defaultModel?: string;
    selectModel?: CreateSamplingHandlerOptions['selectModel'];
  },
): string | undefined {
  // Custom selector, when present, is the final say — no hint-matching
  // fallback. Returning undefined means "I don't have a pick; use the
  // default model label."
  if (options.selectModel) {
    const chosen = options.selectModel(hints ?? [], {
      ...(options.allowedModels !== undefined ? { allowedModels: options.allowedModels } : {}),
      ...(options.defaultModel !== undefined ? { defaultModel: options.defaultModel } : {}),
    });
    return chosen ?? options.defaultModel;
  }

  // Default logic: first hint whose name is in the allowlist (or any hint if
  // no allowlist). Unknown / non-matching hints are ignored. The MCP spec
  // treats hints as advisory only, so rejecting all of them and falling
  // through to `defaultModel` is compliant.
  if (hints && hints.length > 0) {
    for (const hint of hints) {
      if (!hint.name) continue;
      if (options.allowedModels && !options.allowedModels.includes(hint.name)) continue;
      return hint.name;
    }
  }
  return options.defaultModel;
}

/**
 * Convert the MCP `sampling/createMessage` message array (and optional
 * `systemPrompt`) into the agent's `Message[]` shape. Text content is
 * passed through verbatim; non-text parts throw so the server gets a
 * clear protocol error rather than a silently-dropped payload.
 */
function convertToLLMMessages(params: McpSamplingRequestParams): Message[] {
  const out: Message[] = [];
  if (typeof params.systemPrompt === 'string' && params.systemPrompt.length > 0) {
    out.push({ role: 'system', content: params.systemPrompt });
  }
  for (const msg of params.messages) {
    if (msg.content.type !== 'text' || typeof msg.content.text !== 'string') {
      throw new Error(
        `sampling/createMessage: non-text message content is not yet supported (got type=${msg.content.type}). Stage 5.2 ships text-only sampling.`,
      );
    }
    out.push({ role: msg.role, content: msg.content.text });
  }
  return out;
}

function mapFinishReason(
  reason: LLMResponse['finishReason'] | undefined,
): McpSamplingResult['stopReason'] {
  switch (reason) {
    case 'stop':
      return 'endTurn';
    case 'length':
      return 'maxTokens';
    case 'tool_calls':
    case 'content_filter':
      return reason;
    default:
      return undefined;
  }
}
