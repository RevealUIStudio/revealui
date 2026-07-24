/**
 * MCP hypervisor audit sink (GAP-355 Stage 5).
 *
 * Consumer-wired integrity hook for tool-call boundaries. Unlike
 * `setUsageMeterSink` (fire-and-forget, never fails the call), the audit sink
 * is **awaited**. When installed, sink failures **fail the tool call** so an
 * action that cannot be recorded does not complete successfully.
 *
 * `@revealui/mcp` stays free of `@revealui/db`. Apps wire the sink to
 * `DrizzleAuditStore` / `recordMcpToolAudit` at process boot.
 */

/**
 * Event fired once per hypervisor tool-call boundary (success or failure).
 * Mirrors `McpMeterEvent` plus an optional args digest (never raw args).
 */
export interface McpAuditEvent {
  kind: 'mcp.tool.call';
  serverName: string;
  toolName: string;
  /** Set when the call went through `callToolForTenant`. */
  tenantId?: string;
  duration_ms: number;
  success: boolean;
  error?: string;
  /**
   * Optional sha256 hex of canonical args. Callers that can hash safely may
   * set this; the hypervisor leaves it unset (no raw arg capture).
   */
  argsDigest?: string;
}

/**
 * Integrity audit sink. Must resolve before the tool call is treated as
 * successfully audited. Throwing or rejecting fails the call path.
 */
export type McpAuditSink = (event: McpAuditEvent) => void | Promise<void>;
