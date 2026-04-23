/**
 * MCP hypervisor usage metering — consumer-wired sink for tool-call boundary.
 *
 * Stage 6.2 of the MCP v1 plan. The hypervisor fires a structured
 * `McpMeterEvent` once per tool call (success or failure) to a sink the
 * consumer supplies. Consumers translate the event into whatever their
 * downstream billing / audit layer expects — typically a row in
 * `usage_meters` (see `@revealui/db` schema).
 *
 * Only the `mcp.tool.call` boundary is metered here: that's the single
 * MCP primitive the hypervisor actually owns today (JSON-RPC
 * `tools/call`). The other four boundaries (resource reads, prompt
 * lookups, sampling, elicitation) live in `@revealui/ai`'s MCP adapter
 * and are metered there via `createUsageMeterSink()` over Stage 6.1's
 * `McpEventSink`. Both paths converge on the same `usage_meters`
 * table.
 *
 * Why a sink instead of a direct db write? `@revealui/mcp` has no
 * `@revealui/db` runtime dependency — the same structural-decoupling
 * discipline Stage 5 held between `@revealui/ai` and `@revealui/mcp`.
 * Consumers (admin app, agent runtime) wire the sink with their own
 * db handle + tenant-to-account mapping at construction time.
 */

/**
 * Event payload fired once per hypervisor tool-call boundary.
 */
export interface McpMeterEvent {
  /**
   * Boundary discriminator. Stage 6.2 only emits `'mcp.tool.call'`
   * from the hypervisor; the union is reserved for future additions
   * if/when the hypervisor migration to `McpClient` lands and it
   * starts owning more boundaries.
   */
  kind: 'mcp.tool.call';
  /** Registered server name (unprefixed). */
  serverName: string;
  /** Tool name (no `@@mcp_<server>__` prefix). */
  toolName: string;
  /**
   * Tenant identifier when the call went through
   * `callToolForTenant`; `undefined` for non-tenant `callTool` calls
   * (local / singleton registry path).
   */
  tenantId?: string;
  /** Wall-clock duration from entry to exit in milliseconds. */
  duration_ms: number;
  /** `true` when the JSON-RPC call resolved; `false` on throw / timeout. */
  success: boolean;
  /** Server-reported error message on failure. Omitted on success. */
  error?: string;
}

/**
 * Consumer-wired metering sink. Called exactly once per metered
 * boundary. Either synchronous or async — the hypervisor does not
 * await; sink errors are swallowed so observability cannot break the
 * underlying call.
 */
export type McpMeterSink = (event: McpMeterEvent) => void | Promise<void>;
