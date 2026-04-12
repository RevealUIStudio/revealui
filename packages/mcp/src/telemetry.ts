/**
 * MCP Telemetry
 *
 * Structured event emitter for MCP operations. Supports multiple
 * subscribers and provides convenience methods for common event types.
 *
 * @example
 * ```typescript
 * const telemetry = McpTelemetry.getInstance();
 *
 * // Register a JSON-lines handler
 * telemetry.on(McpTelemetry.createJsonLogHandler());
 *
 * // Emit events
 * telemetry.toolInvoke('stripe', 'create_customer', 'tenant-1', 'pro');
 * telemetry.toolComplete('stripe', 'create_customer', true, 42, {
 *   tenant: 'tenant-1',
 * });
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export type McpEventType =
  | 'tool.invoke'
  | 'tool.complete'
  | 'tool.error'
  | 'pipeline.start'
  | 'pipeline.complete'
  | 'server.start'
  | 'server.stop'
  | 'server.health'
  | 'auth.validate'
  | 'cache.hit'
  | 'cache.miss';

export interface McpEvent {
  type: McpEventType;
  timestamp: number;
  server?: string;
  tool?: string;
  tenant?: string;
  tier?: string;
  durationMs?: number;
  success?: boolean;
  cached?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type McpEventHandler = (event: McpEvent) => void;

// =============================================================================
// Telemetry emitter
// =============================================================================

/**
 * Simple event emitter for MCP telemetry.
 * Supports multiple subscribers and structured event types.
 * Default handler logs to structured JSON on stderr.
 */
export class McpTelemetry {
  private handlers: McpEventHandler[] = [];
  private static instance: McpTelemetry | null = null;

  static getInstance(): McpTelemetry {
    if (!McpTelemetry.instance) {
      McpTelemetry.instance = new McpTelemetry();
    }
    return McpTelemetry.instance;
  }

  /** Register an event handler. Returns an unsubscribe function. */
  on(handler: McpEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /** Emit an event to all registered handlers. */
  emit(event: McpEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Telemetry must never throw
      }
    }
  }

  /** Convenience: emit a tool invocation event. */
  toolInvoke(server: string, tool: string, tenant?: string, tier?: string): void {
    this.emit({
      type: 'tool.invoke',
      timestamp: Date.now(),
      server,
      tool,
      tenant,
      tier,
    });
  }

  /** Convenience: emit a tool completion event. */
  toolComplete(
    server: string,
    tool: string,
    success: boolean,
    durationMs: number,
    opts?: { tenant?: string; cached?: boolean; error?: string },
  ): void {
    this.emit({
      type: success ? 'tool.complete' : 'tool.error',
      timestamp: Date.now(),
      server,
      tool,
      success,
      durationMs,
      ...opts,
    });
  }

  /** Create a JSON-lines log handler (writes to stderr). */
  static createJsonLogHandler(): McpEventHandler {
    return (event) => {
      process.stderr.write(`${JSON.stringify(event)}\n`);
    };
  }

  /**
   * Create an OpenTelemetry-compatible span handler stub.
   * Pass your own tracer instance to wire real OTel export.
   */
  static createOtelHandler(tracer?: OtelTracerLike): McpEventHandler {
    return (event) => {
      if (!tracer) return;
      const span = tracer.startSpan(`mcp.${event.type}`);
      if (event.server) span.setAttribute('mcp.server', event.server);
      if (event.tool) span.setAttribute('mcp.tool', event.tool);
      if (event.durationMs !== undefined) span.setAttribute('mcp.duration_ms', event.durationMs);
      if (event.success !== undefined) span.setAttribute('mcp.success', event.success);
      span.end();
    };
  }

  /** Reset singleton (for testing). */
  static reset(): void {
    McpTelemetry.instance = null;
  }
}

// =============================================================================
// OTel tracer interface (minimal, avoids hard dependency)
// =============================================================================

/** Minimal OTel tracer shape  -  avoids requiring @opentelemetry/api as a dependency. */
interface OtelTracerLike {
  startSpan(name: string): {
    end(): void;
    setAttribute(key: string, value: unknown): void;
  };
}
