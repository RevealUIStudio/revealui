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

// ---------------------------------------------------------------------------
// Stage 6.2 — usage metering sink
// ---------------------------------------------------------------------------

/**
 * Row shape consumed by the sink's `write` callback. Structurally
 * matches `usage_meters` insert payload in `@revealui/db/schema/accounts`.
 * Kept as a plain interface here to avoid importing Drizzle's inferred
 * insert type and to let tests build rows without a db client.
 */
export interface McpUsageMeterRow {
  /** Synthetic primary key. Default: `crypto.randomUUID()`. */
  id: string;
  /** Tenant / account fk (NOT NULL on `usage_meters`). */
  accountId: string;
  /** Dot-notation meter name: mirrors `McpLogEvent.kind`. */
  meterName: string;
  /**
   * Event count. v1 uses `1` per call (row-per-call pattern); billing
   * aggregation rolls these up. A larger quantity makes sense only
   * when the meter represents a volume (tokens, bytes) rather than
   * a count of events.
   */
  quantity: number;
  /** Timestamp the metered event occurred. */
  periodStart: Date;
  /** Reserved for aggregation-mode rows; `null` for per-call rows. */
  periodEnd: Date | null;
  /**
   * Origin label. Per the `usage_meters` CHECK constraint one of
   * `'system' | 'user' | 'agent' | 'api'`. Defaults to `'agent'`
   * since this sink consumes agent-runtime protocol events.
   */
  source: 'system' | 'user' | 'agent' | 'api';
  /** Unique key. Backs `uniqueIndex` on `usage_meters`. */
  idempotencyKey: string;
}

/**
 * Consumer-supplied row writer. Typically:
 * `(row) => db.insert(usageMeters).values(row)`.
 * Can be sync (throws on error) or async. The sink awaits thenable
 * results and logs rejections at warn — write failures never propagate
 * back into the MCP call that produced the event.
 */
export type McpUsageMeterWriter = (row: McpUsageMeterRow) => void | Promise<void>;

export interface CreateUsageMeterSinkOptions {
  /**
   * Tenant / account id required by the `usage_meters.accountId NOT
   * NULL fk` constraint. Agent-side adapters are tenant-agnostic by
   * design — consumer binds the correct account when constructing
   * the sink, typically one sink per authenticated call path.
   */
  accountId: string;
  /**
   * Row persistence callback. Structural so consumers can plug in
   * raw Drizzle, a wrapped client, or a test double.
   */
  write: McpUsageMeterWriter;
  /**
   * Origin label per `usage_meters.source` check constraint. Default
   * `'agent'`.
   */
  source?: McpUsageMeterRow['source'];
  /**
   * Custom idempotency-key generator. Default: fresh
   * `crypto.randomUUID()` per event (safe; no retry coalescence).
   * Supply a deterministic generator (e.g. `${requestId}:${e.kind}`)
   * to collapse duplicate retries of one semantic call to a single
   * row.
   */
  idempotencyKey?: (event: McpLogEvent) => string;
  /**
   * Custom row-id generator. Default: fresh UUID. Provided as a hook
   * for consumers integrating with an existing id scheme.
   */
  id?: (event: McpLogEvent) => string;
}

/**
 * Map an `McpLogEvent.kind` to a `usage_meters.meterName` string.
 * One-to-one: the dot-notation kind IS the meter name.
 *
 * @internal
 */
const METER_NAMES: Readonly<Record<McpLogEvent['kind'], string>> = {
  'mcp.tool.call': 'mcp.tool.call',
  'mcp.resource.list': 'mcp.resource.list',
  'mcp.resource.read': 'mcp.resource.read',
  'mcp.prompt.list': 'mcp.prompt.list',
  'mcp.prompt.get': 'mcp.prompt.get',
  'mcp.sampling.create': 'mcp.sampling.create',
  'mcp.elicitation.create': 'mcp.elicitation.create',
};

/**
 * Build an `McpEventSink` that translates Stage 6.1 protocol log
 * events into `usage_meters` insert rows (Stage 6.2).
 *
 * This is the agent-adapter-lane counterpart to the hypervisor's
 * `setUsageMeterSink()` in `@revealui/mcp`. Both paths land rows in
 * the same `usage_meters` table. The agent-adapter path covers the
 * four boundaries the hypervisor doesn't own
 * (`resource.list/read`, `prompt.list/get`, `sampling.create`,
 * `elicitation.create`) plus the agent-side `tool.call` for
 * `McpClient`-using agents.
 *
 * @example
 * ```typescript
 * import { usageMeters } from '@revealui/db';
 * import {
 *   createToolsFromMcpClient,
 *   createUsageMeterSink,
 * } from '@revealui/ai';
 *
 * const tools = await createToolsFromMcpClient(client, {
 *   namespace: 'content',
 *   onEvent: createUsageMeterSink({
 *     accountId: session.accountId,
 *     write: (row) => db.insert(usageMeters).values(row),
 *   }),
 * });
 * ```
 */
export function createUsageMeterSink(options: CreateUsageMeterSinkOptions): McpEventSink {
  const source = options.source ?? 'agent';
  const genId = options.id ?? (() => crypto.randomUUID());
  const genKey = options.idempotencyKey ?? (() => crypto.randomUUID());

  return (event) => {
    const row: McpUsageMeterRow = {
      id: genId(event),
      accountId: options.accountId,
      meterName: METER_NAMES[event.kind],
      quantity: 1,
      periodStart: new Date(),
      periodEnd: null,
      source,
      idempotencyKey: genKey(event),
    };

    const result = options.write(row);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch((error) => {
        logger.warn('[mcp] usage meter write rejected; continuing', {
          event: event.kind,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  };
}
