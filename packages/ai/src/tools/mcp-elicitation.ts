/**
 * MCP Elicitation — route server `elicitation/create` requests through
 * a consumer-provided UI callback (Stage 5.3 of the MCP v1 plan).
 *
 * The MCP spec defines `elicitation/create` as a server-to-client
 * request: a server asks the client to collect structured input from
 * the user mid-flow (form inputs, confirmations, auth prompts). The
 * agent runtime is NOT the right place to decide what UI to show —
 * each consumer (admin inspector, agent execution panel, CLI tool,
 * Slack bot, …) renders in its own idiom. This module exposes
 * `createElicitationHandler({ onElicit })` — a thin factory that
 * wraps the consumer's async UI callback into the structural handler
 * shape that `McpClient` from `@revealui/mcp/client` expects.
 *
 * Safety defaults
 * ---------------
 * - Servers that request **URL mode** (out-of-band consent via a
 *   separate browser tab) are auto-declined unless `allowUrlMode: true`
 *   is passed. URL mode is a phishing vector when the user can't
 *   easily verify what domain they're on — admin inspector (Stage 3.4)
 *   takes the same posture; agent runtime matches for consistency.
 * - Optional `timeoutMs` auto-declines after the deadline. Useful in
 *   headless automation where no human is at the keyboard.
 * - Thrown errors inside `onElicit` are converted to `{ action:
 *   'cancel' }` rather than propagating — servers should see a clean
 *   decline, not a protocol error the UI crashed on.
 *
 * As with the rest of the MCP-adapter surface, this module uses
 * structural typing to stay decoupled from `@revealui/mcp` — the real
 * `ElicitationHandler` from `@revealui/mcp/client` structurally
 * satisfies the `McpElicitationHandler` shape exported here.
 *
 * @example
 * ```typescript
 * import { McpClient } from '@revealui/mcp/client';
 * import { createElicitationHandler } from '@revealui/ai';
 *
 * const client = new McpClient({
 *   clientInfo: { name: 'my-agent', version: '1.0.0' },
 *   transport: { kind: 'streamable-http', url: '…' },
 *   elicitationHandler: createElicitationHandler({
 *     onElicit: async ({ message, requestedSchema }) => {
 *       const form = await showFormDialog({ title: message, schema: requestedSchema });
 *       if (!form) return { action: 'cancel' };
 *       return { action: 'accept', content: form.values };
 *     },
 *     timeoutMs: 60_000,
 *   }),
 * });
 * ```
 */

import { logger } from '@revealui/core/observability/logger';
import { emitMcpEvent, type McpEventSink } from './mcp-events.js';

// ---------------------------------------------------------------------------
// Structural MCP spec types (subset)
// ---------------------------------------------------------------------------

/** Parameters of an `elicitation/create` request (spec-shaped subset). */
export interface McpElicitRequestParams {
  /**
   * Elicitation mode. Currently the spec defines `'form'` (inline form
   * fields) as the only named value; future modes (e.g. `'url'` for
   * out-of-band consent) may appear. Undefined = `'form'`.
   */
  mode?: string;
  /** User-facing prompt message. */
  message: string;
  /** JSON Schema describing the fields to collect. */
  requestedSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: ReadonlyArray<string>;
  };
}

/** Allowed values for `ElicitResult.content` per the MCP spec. */
export type McpElicitContentValue = string | number | boolean | ReadonlyArray<string>;

/** Result of an `elicitation/create` request (spec-shaped subset). */
export interface McpElicitResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: Record<string, McpElicitContentValue>;
}

/** Structural shape of the handler — matches `ElicitationHandler` from `@revealui/mcp/client`. */
export type McpElicitationHandler = (params: McpElicitRequestParams) => Promise<McpElicitResult>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateElicitationHandlerOptions {
  /**
   * Consumer-supplied async callback that renders UI and collects the
   * response. Receives the spec-shaped request params; returns a
   * spec-shaped result. The factory handles URL-mode auto-decline,
   * timeouts, and error-to-cancel mapping around this callback.
   */
  onElicit: (params: McpElicitRequestParams) => Promise<McpElicitResult>;
  /**
   * Auto-decline deadline in milliseconds. When set and no response
   * arrives within the window, the handler returns `{ action: 'cancel' }`
   * (not `'decline'` — the timeout wasn't a user decision). Set to
   * `undefined` / omit to wait indefinitely.
   */
  timeoutMs?: number;
  /**
   * Accept `mode: 'url'` elicitation requests (out-of-band consent via
   * a separate browser tab). Default `false` — URL-mode requests are
   * auto-declined for safety. Flip to `true` only if the consumer's
   * UI renders a verifiable domain-check + explicit user approval.
   */
  allowUrlMode?: boolean;
  /**
   * Observability hook. Fires before `onElicit` is invoked with the
   * message + field count. Useful for audit trails.
   */
  onElicitationRequest?: (info: { message: string; fieldCount: number; mode?: string }) => void;
  /**
   * Protocol-level observability sink (Stage 6.1). Fires once per
   * `elicitation/create` call (after the handler decides — whether
   * the user accepted, declined, cancelled, url-mode auto-declined,
   * or the timeout fired) with `{ kind: 'mcp.elicitation.create',
   * action, fieldCount, mode?, duration_ms, success }`. URL-mode
   * auto-decline + timeout-cancel both emit `success: true` — they
   * are legitimate handler outcomes, not failures. Only thrown errors
   * report `success: false`.
   */
  onEvent?: McpEventSink;
  /**
   * Optional server identifier included in emitted events. Leave unset
   * when the handler is shared across multiple servers.
   */
  namespace?: string;
}

export function createElicitationHandler(
  options: CreateElicitationHandlerOptions,
): McpElicitationHandler {
  const { onElicit, timeoutMs, allowUrlMode, onElicitationRequest, onEvent, namespace } = options;

  return async (params: McpElicitRequestParams): Promise<McpElicitResult> => {
    const fieldCount = countSchemaFields(params.requestedSchema);
    const started = Date.now();

    if (params.mode === 'url' && !allowUrlMode) {
      emitMcpEvent(onEvent, {
        kind: 'mcp.elicitation.create',
        ...(namespace !== undefined ? { namespace } : {}),
        action: 'decline',
        fieldCount,
        ...(params.mode !== undefined ? { mode: params.mode } : {}),
        duration_ms: Date.now() - started,
        success: true,
      });
      return { action: 'decline' };
    }

    onElicitationRequest?.({
      message: params.message,
      fieldCount,
      ...(params.mode !== undefined ? { mode: params.mode } : {}),
    });

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let result: McpElicitResult;
    try {
      const userResponse = onElicit(params).catch((error) => {
        // Errors inside the consumer's UI callback → cancel (not decline —
        // the server should see a clean "didn't happen", not a
        // misrepresented "user said no").
        logger.warn('[createElicitationHandler] onElicit threw; returning cancel', {
          error: error instanceof Error ? error.message : String(error),
        });
        return { action: 'cancel' } as McpElicitResult;
      });

      if (timeoutMs === undefined || timeoutMs <= 0) {
        result = await userResponse;
      } else {
        const timeoutPromise = new Promise<McpElicitResult>((resolve) => {
          timeoutHandle = setTimeout(() => {
            resolve({ action: 'cancel' });
          }, timeoutMs);
        });
        result = await Promise.race([userResponse, timeoutPromise]);
      }
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }

    emitMcpEvent(onEvent, {
      kind: 'mcp.elicitation.create',
      ...(namespace !== undefined ? { namespace } : {}),
      action: result.action,
      fieldCount,
      ...(params.mode !== undefined ? { mode: params.mode } : {}),
      duration_ms: Date.now() - started,
      success: true,
    });

    return result;
  };
}

/** Count the declared fields on a `requestedSchema.properties` record. */
function countSchemaFields(schema: McpElicitRequestParams['requestedSchema']): number {
  if (!(schema?.properties && typeof schema.properties === 'object')) return 0;
  return Object.keys(schema.properties).length;
}
