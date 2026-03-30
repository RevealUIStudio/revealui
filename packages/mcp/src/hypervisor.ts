/**
 * MCP Hypervisor
 *
 * Manages N running MCP server processes, pings them for liveness, and
 * dynamically exposes their tools at runtime. Inspired by the
 * MCPCompatibilityLayer/MCPHypervisor pattern from AnythingLLM.
 *
 * Architecture:
 *   - Singleton: one hypervisor per process manages all MCP servers
 *   - Each server is spawned with piped stdio for JSON-RPC communication
 *   - Tool names are namespaced: @@mcp_{serverName}_{toolName}
 *   - Health check loop: every 60s, process.exitCode check + tools/list probe
 *
 * Wire format: newline-delimited JSON-RPC 2.0 (stdin/stdout)
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { registerCleanupHandler } from '@revealui/core/monitoring';
import { logger } from '@revealui/core/observability/logger';

// =============================================================================
// Types
// =============================================================================

export interface MCPServerConfig {
  /** Unique name for this server (used in tool namespacing) */
  name: string;
  /** Executable to run (e.g. 'node', 'pnpm') */
  command: string;
  /** Arguments to the command */
  args: string[];
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Required tier to access this server's tools (default: 'free') */
  requiredTier?: 'free' | 'pro' | 'max' | 'enterprise';
}

/**
 * Resolves credentials for a specific tenant/workspace at server spawn time.
 * Implementations should fetch from the database (tenantProviderConfigs, userApiKeys)
 * and return env vars to inject into the MCP server process.
 */
export interface MCPCredentialResolver {
  /**
   * Resolve credentials for a tenant+server combination.
   * Returns env vars to merge into the server process environment.
   * Return null if the tenant has no credentials for this server.
   */
  resolve(tenantId: string, serverName: string): Promise<Record<string, string> | null>;
}

/**
 * Context for a tenant-scoped MCP operation.
 */
export interface MCPTenantContext {
  tenantId: string;
  userId?: string;
  tier: 'free' | 'pro' | 'max' | 'enterprise';
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
  /** Minimum tier required to invoke this tool (default: 'free') */
  requiredTier?: 'free' | 'pro' | 'max' | 'enterprise';
}

export interface NamespacedTool {
  /** Namespaced name: @@mcp_{serverName}_{toolName} */
  namespacedName: string;
  serverName: string;
  tool: MCPTool;
  /** Minimum tier required to invoke this tool (inherited from tool or server) */
  requiredTier?: 'free' | 'pro' | 'max' | 'enterprise';
}

interface ServerEntry {
  config: MCPServerConfig;
  process: ChildProcess | null;
  tools: MCPTool[];
  healthy: boolean;
  lastPingAt: number | null;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

// =============================================================================
// Constants
// =============================================================================

const HEALTH_CHECK_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MCP_TOOL_PREFIX = '@@mcp';

// =============================================================================
// MCPHypervisor
// =============================================================================

/**
 * Singleton that manages MCP server processes and their tool registries.
 *
 * @example
 * ```typescript
 * const hypervisor = MCPHypervisor.getInstance()
 *
 * hypervisor.registerServer({
 *   name: 'stripe',
 *   command: 'pnpm',
 *   args: ['dlx', '@stripe/mcp', '--tools=all', '--api-key=sk_...'],
 * })
 *
 * await hypervisor.startServer('stripe')
 * const tools = hypervisor.getAllTools()
 * // tools[0].namespacedName === '@@mcp_stripe_create_payment_intent'
 * ```
 */
export class MCPHypervisor {
  private static instance: MCPHypervisor | null = null;

  private servers: Map<string, ServerEntry> = new Map();
  /** Tenant-scoped server instances: key = `${tenantId}:${serverName}` */
  private tenantServers: Map<string, ServerEntry> = new Map();
  private credentialResolver: MCPCredentialResolver | null = null;
  private requestCounter = 0;
  private pendingRequests: Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  > = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private constructor() {
    registerCleanupHandler(
      'mcp-hypervisor',
      async () => this.stopAll(),
      'Stop all MCP server processes',
      85,
    );
    this.startHealthCheckLoop();
  }

  static getInstance(): MCPHypervisor {
    if (!MCPHypervisor.instance) {
      MCPHypervisor.instance = new MCPHypervisor();
    }
    return MCPHypervisor.instance;
  }

  // ---------------------------------------------------------------------------
  // Server registration
  // ---------------------------------------------------------------------------

  /**
   * Register an MCP server configuration without starting it.
   */
  registerServer(config: MCPServerConfig): void {
    if (this.servers.has(config.name)) {
      logger.warn(`[MCPHypervisor] Server "${config.name}" is already registered`);
      return;
    }
    this.servers.set(config.name, {
      config,
      process: null,
      tools: [],
      healthy: false,
      lastPingAt: null,
    });
    logger.info(`[MCPHypervisor] Registered server: ${config.name}`);
  }

  /**
   * Unregister a server (stops it first if running).
   */
  async unregisterServer(name: string): Promise<void> {
    const entry = this.servers.get(name);
    if (!entry) return;
    if (entry.process) await this.stopServer(name);
    this.servers.delete(name);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Spawn the MCP server process with piped stdio.
   * Tools are discovered via `listServerTools()` after startup.
   */
  async startServer(name: string): Promise<void> {
    const entry = this.servers.get(name);
    if (!entry) throw new Error(`[MCPHypervisor] Unknown server: "${name}"`);
    if (entry.process && entry.process.exitCode === null) {
      logger.info(`[MCPHypervisor] Server "${name}" is already running`);
      return;
    }

    const { config } = entry;
    const child = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
    });

    entry.process = child;
    entry.healthy = false;
    entry.tools = [];

    // Buffer incoming stdout for JSON-RPC response parsing
    let buffer = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep incomplete line in buffer
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed) as JsonRpcResponse;
          this.handleResponse(msg);
        } catch {
          // Non-JSON output from server — ignore
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      logger.warn(`[MCPHypervisor] ${name} stderr: ${chunk.toString().trim()}`);
    });

    child.on('exit', (code) => {
      logger.warn(`[MCPHypervisor] Server "${name}" exited with code ${code}`);
      entry.healthy = false;
      // Reject all pending requests for this server
      for (const [id, pending] of this.pendingRequests) {
        pending.reject(new Error(`Server "${name}" exited`));
        clearTimeout(pending.timer);
        this.pendingRequests.delete(id);
      }
    });

    // Allow a brief startup window, then probe tools
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    try {
      await this.listServerTools(name);
      entry.healthy = true;
      logger.info(`[MCPHypervisor] Server "${name}" started (${entry.tools.length} tools)`);
    } catch (error) {
      logger.warn(
        `[MCPHypervisor] Server "${name}" started but tool discovery failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Still mark healthy if the process is alive (tools may not be supported)
      entry.healthy = entry.process.exitCode === null;
    }
  }

  /**
   * Stop a running MCP server process.
   */
  async stopServer(name: string): Promise<void> {
    const entry = this.servers.get(name);
    if (!entry?.process) return;

    entry.process.kill('SIGTERM');
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    if (entry.process.exitCode === null) {
      entry.process.kill('SIGKILL');
    }

    entry.process = null;
    entry.healthy = false;
    entry.tools = [];
    logger.info(`[MCPHypervisor] Stopped server: ${name}`);
  }

  /**
   * Stop all running servers.
   */
  async stopAll(): Promise<void> {
    this.stopHealthCheckLoop();
    await Promise.all([
      Promise.all(Array.from(this.servers.keys()).map((name) => this.stopServer(name))),
      this.stopAllTenantServers(),
    ]);
  }

  // ---------------------------------------------------------------------------
  // JSON-RPC communication
  // ---------------------------------------------------------------------------

  /**
   * Send a JSON-RPC request to a running server and await the response.
   */
  private sendRequest(name: string, method: string, params?: unknown): Promise<unknown> {
    const entry = this.servers.get(name);
    if (!entry?.process || entry.process.exitCode !== null) {
      return Promise.reject(new Error(`Server "${name}" is not running`));
    }

    const id = ++this.requestCounter;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined && { params }),
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });

      try {
        entry.process?.stdin?.write(`${JSON.stringify(request)}\n`);
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  private handleResponse(msg: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(msg.id);

    if (msg.error) {
      pending.reject(new Error(`JSON-RPC error ${msg.error.code}: ${msg.error.message}`));
    } else {
      pending.resolve(msg.result);
    }
  }

  // ---------------------------------------------------------------------------
  // Health checks
  // ---------------------------------------------------------------------------

  /**
   * Ping a server — checks process liveness and sends a JSON-RPC `ping`.
   * Updates `entry.healthy`.
   */
  async pingServer(name: string): Promise<boolean> {
    const entry = this.servers.get(name);
    if (!entry) return false;

    // Process liveness check
    if (!entry.process || entry.process.exitCode !== null) {
      entry.healthy = false;
      return false;
    }

    entry.lastPingAt = Date.now();

    try {
      await this.sendRequest(name, 'ping');
      entry.healthy = true;
      return true;
    } catch {
      // ping not supported by all servers — still healthy if process is alive
      entry.healthy = entry.process.exitCode === null;
      return entry.healthy;
    }
  }

  // ---------------------------------------------------------------------------
  // Tool discovery
  // ---------------------------------------------------------------------------

  /**
   * Discover tools from a running server via JSON-RPC `tools/list`.
   * Caches the result in the server entry.
   */
  async listServerTools(name: string): Promise<MCPTool[]> {
    const entry = this.servers.get(name);
    if (!entry) throw new Error(`Unknown server: "${name}"`);

    const result = await this.sendRequest(name, 'tools/list');

    const tools = (result as { tools?: MCPTool[] })?.tools ?? [];
    entry.tools = tools;
    return tools;
  }

  /**
   * Return all tools from all healthy servers, namespaced as
   * `@@mcp_{serverName}_{toolName}` to avoid collisions.
   */
  getAllTools(): NamespacedTool[] {
    const tools: NamespacedTool[] = [];

    for (const [serverName, entry] of this.servers) {
      if (!entry.healthy) continue;
      const serverTier = entry.config.requiredTier ?? 'free';

      for (const tool of entry.tools) {
        const effectiveTier = this.higherTier(serverTier, tool.requiredTier ?? 'free');
        tools.push({
          namespacedName: `${MCP_TOOL_PREFIX}_${serverName}_${tool.name}`,
          serverName,
          tool,
          requiredTier: effectiveTier === 'free' ? undefined : effectiveTier,
        });
      }
    }

    return tools;
  }

  /**
   * Call a tool on a running MCP server via JSON-RPC `tools/call`.
   *
   * @param serverName - The registered server name
   * @param toolName - The tool name (without namespace prefix)
   * @param args - Arguments to pass to the tool
   */
  async callTool(serverName: string, toolName: string, args: unknown): Promise<unknown> {
    const startTime = Date.now();

    logger.info({
      event: 'mcp.tool.invoke' as const,
      server: serverName,
      tool: toolName,
      timestamp: startTime,
    });

    try {
      const result = await this.sendRequest(serverName, 'tools/call', {
        name: toolName,
        arguments: args,
      });

      logger.info({
        event: 'mcp.tool.complete' as const,
        server: serverName,
        tool: toolName,
        success: true,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.info({
        event: 'mcp.tool.complete' as const,
        server: serverName,
        tool: toolName,
        success: false,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Return the health status of all registered servers.
   */
  getStatus(): Record<string, { healthy: boolean; toolCount: number; pid: number | null }> {
    const status: Record<string, { healthy: boolean; toolCount: number; pid: number | null }> = {};
    for (const [name, entry] of this.servers) {
      status[name] = {
        healthy: entry.healthy,
        toolCount: entry.tools.length,
        pid: entry.process?.pid ?? null,
      };
    }
    return status;
  }

  // ---------------------------------------------------------------------------
  // Credential resolver
  // ---------------------------------------------------------------------------

  /**
   * Set the credential resolver for tenant-scoped server operations.
   * Must be set before calling any tenant-scoped methods.
   */
  setCredentialResolver(resolver: MCPCredentialResolver): void {
    this.credentialResolver = resolver;
  }

  // ---------------------------------------------------------------------------
  // Tenant-scoped operations
  // ---------------------------------------------------------------------------

  /**
   * Start an MCP server with tenant-specific credentials.
   * Each tenant gets its own isolated server process with credentials
   * resolved from the database (BYOK keys or platform defaults).
   *
   * Server instances are keyed by `${tenantId}:${serverName}`.
   */
  async startServerForTenant(serverName: string, ctx: MCPTenantContext): Promise<void> {
    const baseEntry = this.servers.get(serverName);
    if (!baseEntry) throw new Error(`[MCPHypervisor] Unknown server: "${serverName}"`);

    // Tier gating
    const requiredTier = baseEntry.config.requiredTier ?? 'free';
    if (!this.tierSatisfied(ctx.tier, requiredTier)) {
      throw new Error(
        `[MCPHypervisor] Server "${serverName}" requires tier "${requiredTier}", tenant has "${ctx.tier}"`,
      );
    }

    const tenantKey = `${ctx.tenantId}:${serverName}`;

    // Already running for this tenant?
    const existing = this.tenantServers.get(tenantKey);
    if (existing?.process && existing.process.exitCode === null) {
      return;
    }

    // Resolve tenant credentials
    let tenantEnv: Record<string, string> = {};
    if (this.credentialResolver) {
      const resolved = await this.credentialResolver.resolve(ctx.tenantId, serverName);
      if (resolved) tenantEnv = resolved;
    }

    // Create an isolated config with tenant credentials merged
    const config: MCPServerConfig = {
      ...baseEntry.config,
      env: { ...baseEntry.config.env, ...tenantEnv },
    };

    const entry: ServerEntry = {
      config,
      process: null,
      tools: [],
      healthy: false,
      lastPingAt: null,
    };

    // Spawn process
    const child = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
    });

    entry.process = child;
    this.tenantServers.set(tenantKey, entry);

    let buffer = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed) as JsonRpcResponse;
          this.handleResponse(msg);
        } catch {
          // Non-JSON output
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      logger.warn(`[MCPHypervisor] ${tenantKey} stderr: ${chunk.toString().trim()}`);
    });

    child.on('exit', (code) => {
      logger.warn(`[MCPHypervisor] Tenant server "${tenantKey}" exited with code ${code}`);
      entry.healthy = false;
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    try {
      // Discover tools via JSON-RPC
      const id = ++this.requestCounter;
      const request: JsonRpcRequest = { jsonrpc: '2.0', id, method: 'tools/list' };

      const toolsResult = await new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error('Tool discovery timed out'));
        }, REQUEST_TIMEOUT_MS);
        this.pendingRequests.set(id, { resolve, reject, timer });
        entry.process?.stdin?.write(`${JSON.stringify(request)}\n`);
      });

      entry.tools = (toolsResult as { tools?: MCPTool[] })?.tools ?? [];
      entry.healthy = true;
      logger.info(
        `[MCPHypervisor] Tenant server "${tenantKey}" started (${entry.tools.length} tools)`,
      );
    } catch {
      entry.healthy = entry.process.exitCode === null;
    }
  }

  /**
   * Stop a tenant-scoped server instance.
   */
  async stopServerForTenant(serverName: string, tenantId: string): Promise<void> {
    const tenantKey = `${tenantId}:${serverName}`;
    const entry = this.tenantServers.get(tenantKey);
    if (!entry?.process) return;

    entry.process.kill('SIGTERM');
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    if (entry.process.exitCode === null) entry.process.kill('SIGKILL');

    this.tenantServers.delete(tenantKey);
    logger.info(`[MCPHypervisor] Stopped tenant server: ${tenantKey}`);
  }

  /**
   * Call a tool on a tenant-scoped server instance.
   */
  async callToolForTenant(
    serverName: string,
    tenantId: string,
    toolName: string,
    args: unknown,
  ): Promise<unknown> {
    const startTime = Date.now();
    const tenantKey = `${tenantId}:${serverName}`;
    const entry = this.tenantServers.get(tenantKey);
    if (!entry?.process || entry.process.exitCode !== null) {
      throw new Error(`[MCPHypervisor] No running server for tenant "${tenantKey}"`);
    }

    logger.info({
      event: 'mcp.tool.invoke' as const,
      server: serverName,
      tool: toolName,
      tenant: tenantId,
      timestamp: startTime,
    });

    const id = ++this.requestCounter;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    };

    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
        }, REQUEST_TIMEOUT_MS);

        this.pendingRequests.set(id, { resolve, reject, timer });
        entry.process?.stdin?.write(`${JSON.stringify(request)}\n`);
      });

      logger.info({
        event: 'mcp.tool.complete' as const,
        server: serverName,
        tool: toolName,
        tenant: tenantId,
        success: true,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.info({
        event: 'mcp.tool.complete' as const,
        server: serverName,
        tool: toolName,
        tenant: tenantId,
        success: false,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Get all tools available to a tenant, filtered by tier.
   * Checks both server-level and tool-level requiredTier — the effective
   * requirement is the higher of the two.
   */
  getToolsForTenant(ctx: MCPTenantContext): NamespacedTool[] {
    const tools: NamespacedTool[] = [];

    // Shared (non-tenant) servers filtered by tier
    for (const [serverName, entry] of this.servers) {
      if (!entry.healthy) continue;
      const serverTier = entry.config.requiredTier ?? 'free';
      if (!this.tierSatisfied(ctx.tier, serverTier)) continue;

      for (const tool of entry.tools) {
        const toolTier = tool.requiredTier ?? 'free';
        const effectiveTier = this.higherTier(serverTier, toolTier);
        if (!this.tierSatisfied(ctx.tier, effectiveTier)) continue;

        tools.push({
          namespacedName: `${MCP_TOOL_PREFIX}_${serverName}_${tool.name}`,
          serverName,
          tool,
          requiredTier: effectiveTier === 'free' ? undefined : effectiveTier,
        });
      }
    }

    // Tenant-scoped servers
    for (const [tenantKey, entry] of this.tenantServers) {
      if (!tenantKey.startsWith(`${ctx.tenantId}:`)) continue;
      if (!entry.healthy) continue;
      const serverName = tenantKey.split(':')[1] ?? tenantKey;

      for (const tool of entry.tools) {
        const toolTier = tool.requiredTier ?? 'free';
        if (!this.tierSatisfied(ctx.tier, toolTier)) continue;

        tools.push({
          namespacedName: `${MCP_TOOL_PREFIX}_${serverName}_${tool.name}`,
          serverName,
          tool,
          requiredTier: toolTier === 'free' ? undefined : toolTier,
        });
      }
    }

    return tools;
  }

  /**
   * Stop all tenant-scoped servers (called during shutdown).
   */
  private async stopAllTenantServers(): Promise<void> {
    await Promise.all(
      Array.from(this.tenantServers.entries()).map(async ([key, entry]) => {
        if (entry.process) {
          entry.process.kill('SIGTERM');
          await new Promise<void>((resolve) => setTimeout(resolve, 200));
          if (entry.process.exitCode === null) entry.process.kill('SIGKILL');
        }
        this.tenantServers.delete(key);
      }),
    );
  }

  private tierSatisfied(
    actual: 'free' | 'pro' | 'max' | 'enterprise',
    required: 'free' | 'pro' | 'max' | 'enterprise',
  ): boolean {
    const order = { free: 0, pro: 1, max: 2, enterprise: 3 };
    return order[actual] >= order[required];
  }

  private higherTier(
    a: 'free' | 'pro' | 'max' | 'enterprise',
    b: 'free' | 'pro' | 'max' | 'enterprise',
  ): 'free' | 'pro' | 'max' | 'enterprise' {
    const order = { free: 0, pro: 1, max: 2, enterprise: 3 };
    return order[a] >= order[b] ? a : b;
  }

  // ---------------------------------------------------------------------------
  // Health check loop
  // ---------------------------------------------------------------------------

  private startHealthCheckLoop(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const [name] of this.servers) {
        try {
          await this.pingServer(name);
        } catch {
          // Already handled inside pingServer
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    // Don't prevent process exit
    this.healthCheckTimer.unref?.();
  }

  private stopHealthCheckLoop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Testing utilities
  // ---------------------------------------------------------------------------

  /**
   * Reset the singleton (for testing only).
   * @internal
   */
  static _resetForTests(): void {
    if (MCPHypervisor.instance) {
      MCPHypervisor.instance.stopHealthCheckLoop();
      MCPHypervisor.instance = null;
    }
  }
}
