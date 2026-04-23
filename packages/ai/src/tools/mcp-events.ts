/**
 * MCP protocol log channel — structured events per server-to-client call
 * (Stage 6.1 of the MCP v1 plan).
 *
 * Stage 5 shipped the full agent-side MCP protocol surface
 * (tools + resources + prompts + sampling + elicitation + progress +
 * cancellation). Stage 6.1 adds observability: every adapter in
 * `@revealui/ai/tools/mcp-*` grows an `onEvent?: McpEventSink` hook that
 * fires once per protocol call with a structured summary. Consumers wire
 * the sink to whatever aggregator they run — typically
 * `@revealui/core/observability/logger` via `createCoreLoggerSink()`.
 *
 * Instrumentation lives at the agent-adapter layer by design. The
 * hypervisor is a separate lane (Stage 6.2 lands `usage_meters` rows
 * there, where `accountId` is in scope). Agent adapters are intentionally
 * tenant-agnostic, so events carry no `accountId` field — the consumer
 * adds tenant context in their sink wrapper if they need it for routing.
 *
 * PII note
 * --------
 * Errors surfaced by the server can legitimately contain user-identifying
 * strings (e.g. "user 'alice@example.com' not found"). `error` is passed
 * through to the sink verbatim. If your deployment's observability layer
 * is subject to PII constraints, wrap the sink with a redactor
 * (`redactLogContext` from `@revealui/security`) before passing it in.
 *
 * Params / args / content bodies are **not** included in events —
 * observability is summary-grained by default to avoid accidentally
 * logging credentials, prompts, or document contents.
 */

import { logger } from '@revealui/core/observability/logger';

// ---------------------------------------------------------------------------
// Event shapes
// ---------------------------------------------------------------------------

/** Common fields every MCP protocol-log event carries. */
interface McpEventBase {
  /**
   * Wall-clock duration of the call in milliseconds, measured from
   * handler entry to handler exit (success or failure). Includes the
   * full round-trip across the transport plus any zod validation.
   */
  duration_ms: number;
  /** `true` when the call completed without throwing and without `isError`. */
  success: boolean;
  /**
   * Server-reported error text on failure (from `CallToolResult.content`
   * when `isError: true`, or from `error.message` when the call threw).
   * Omitted when `success: true`. May contain PII — see module docs.
   */
  error?: string;
}

export interface McpToolCallEvent extends McpEventBase {
  kind: 'mcp.tool.call';
  /** Server identifier the tool belongs to. */
  namespace: string;
  /** Tool name WITHOUT the `mcp_<namespace>__` adapter prefix. */
  toolName: string;
}

export interface McpResourceListEvent extends McpEventBase {
  kind: 'mcp.resource.list';
  namespace: string;
  /** Number of resources returned (omitted on failure). */
  resourceCount?: number;
}

export interface McpResourceReadEvent extends McpEventBase {
  kind: 'mcp.resource.read';
  namespace: string;
  /** Resource URI that was read. May be sensitive — see module docs. */
  uri: string;
}

export interface McpPromptListEvent extends McpEventBase {
  kind: 'mcp.prompt.list';
  namespace: string;
  /** Number of prompts returned (omitted on failure). */
  promptCount?: number;
}

export interface McpPromptGetEvent extends McpEventBase {
  kind: 'mcp.prompt.get';
  namespace: string;
  /** Prompt name that was requested. */
  promptName: string;
}

export interface McpSamplingCreateEvent extends McpEventBase {
  kind: 'mcp.sampling.create';
  /**
   * Server identifier when the consumer attached one at handler
   * construction via `createSamplingHandler({ namespace })`. Absent
   * when the handler is wired to a shared `McpClient` that fans out
   * to multiple servers — in that case the consumer's sink wrapper
   * can fill it in from call-site context.
   */
  namespace?: string;
  /** Model label reported back to the server in `result.model`. */
  model: string;
  messageCount: number;
  maxTokens: number;
}

export interface McpElicitationCreateEvent extends McpEventBase {
  kind: 'mcp.elicitation.create';
  /** Server identifier when provided to `createElicitationHandler`. */
  namespace?: string;
  /** User's decision — `'accept' | 'decline' | 'cancel'`. */
  action: 'accept' | 'decline' | 'cancel';
  /** Number of fields in the requested schema. */
  fieldCount: number;
  /** Elicitation mode as declared by the server (`'form'`, `'url'`, …). */
  mode?: string;
}

export type McpLogEvent =
  | McpToolCallEvent
  | McpResourceListEvent
  | McpResourceReadEvent
  | McpPromptListEvent
  | McpPromptGetEvent
  | McpSamplingCreateEvent
  | McpElicitationCreateEvent;

/**
 * Consumer-wired observability sink. Called exactly once per protocol
 * call. Must not throw — the adapter swallows sink-thrown errors
 * internally, but a well-behaved sink returns quickly and cleanly.
 */
export type McpEventSink = (event: McpLogEvent) => void;

// ---------------------------------------------------------------------------
// Default sink — routes events to @revealui/core/observability/logger
// ---------------------------------------------------------------------------

export interface CreateCoreLoggerSinkOptions {
  /**
   * Minimum level for successful events. Default `'info'`. Set to
   * `'debug'` to drop successful-call volume from info-level ingestion.
   * Failed calls are always emitted at `'warn'` regardless.
   */
  successLevel?: 'debug' | 'info';
}

/**
 * Build an `McpEventSink` that fans events into the central log
 * aggregator via `@revealui/core/observability/logger`. This is the
 * recommended default for in-process consumers (admin app, API, agent
 * orchestration). Out-of-process consumers (CLI, remote inspector)
 * typically construct a custom sink that forwards to their own transport.
 *
 * @example
 * ```typescript
 * import {
 *   createToolsFromMcpClient,
 *   createCoreLoggerSink,
 * } from '@revealui/ai';
 *
 * const onEvent = createCoreLoggerSink();
 *
 * const tools = await createToolsFromMcpClient(client, {
 *   namespace: 'my-server',
 *   onEvent,
 * });
 * ```
 */
export function createCoreLoggerSink(options: CreateCoreLoggerSinkOptions = {}): McpEventSink {
  const successLevel = options.successLevel ?? 'info';
  return (event) => {
    const { kind, ...rest } = event;
    const payload = { event: kind, ...rest };
    if (!event.success) {
      logger.warn(`[mcp] ${kind}`, payload);
      return;
    }
    if (successLevel === 'debug') {
      logger.debug(`[mcp] ${kind}`, payload);
    } else {
      logger.info(`[mcp] ${kind}`, payload);
    }
  };
}

// ---------------------------------------------------------------------------
// Internal helper — shared across mcp-adapter / mcp-sampling / mcp-elicitation
// ---------------------------------------------------------------------------

/**
 * Invoke a sink, swallowing any thrown error. A misbehaving sink must
 * never break the underlying MCP call — observability is best-effort.
 * Logs the sink failure at warn so the regression is still visible.
 *
 * @internal
 */
export function emitMcpEvent(sink: McpEventSink | undefined, event: McpLogEvent): void {
  if (!sink) return;
  try {
    sink(event);
  } catch (error) {
    logger.warn('[mcp] event sink threw; continuing', {
      event: event.kind,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
