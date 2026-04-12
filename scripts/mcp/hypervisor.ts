/**
 * MCP Hypervisor
 *
 * Manages the lifecycle of multiple MCP server instances:
 * - Dynamic server spawning and shutdown
 * - Tool discovery and capability registration
 * - Health checking and automatic recovery
 * - Connection pooling and request routing
 * - Graceful shutdown with pending request completion
 *
 * @dependencies
 * - node:child_process - Server process spawning
 * - node:events - EventEmitter for lifecycle events
 */

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

// =============================================================================
// Types
// =============================================================================

/** Server lifecycle states */
export type ServerState = 'init' | 'ready' | 'executing' | 'error' | 'stopped';

/** Server definition  -  describes how to spawn a server */
export interface ServerDefinition {
  /** Unique server identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Command to spawn the server */
  command: string;
  /** Command arguments */
  args: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Startup timeout in ms (default: 10_000) */
  startupTimeoutMs?: number;
  /** Health check interval in ms (default: 30_000) */
  healthCheckIntervalMs?: number;
  /** Maximum concurrent requests (default: 10) */
  maxConcurrent?: number;
}

/** Tool capability provided by a server */
export interface ToolCapability {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Server that provides this tool */
  serverId: string;
  /** JSON schema for tool parameters */
  inputSchema?: Record<string, unknown>;
}

/** Managed server instance */
export interface ManagedServer {
  /** Server definition */
  definition: ServerDefinition;
  /** Current state */
  state: ServerState;
  /** Child process (if running) */
  process: ChildProcess | null;
  /** Discovered tool capabilities */
  tools: ToolCapability[];
  /** Active request count */
  activeRequests: number;
  /** Start timestamp */
  startedAt: number | null;
  /** Last health check timestamp */
  lastHealthCheck: number | null;
  /** Health check interval handle */
  healthInterval: ReturnType<typeof setInterval> | null;
  /** Error message (if in error state) */
  error: string | null;
}

/** Hypervisor configuration */
export interface HypervisorConfig {
  /** Maximum total servers (default: 20) */
  maxServers?: number;
  /** Default startup timeout in ms (default: 10_000) */
  defaultStartupTimeoutMs?: number;
  /** Default health check interval in ms (default: 30_000) */
  defaultHealthCheckIntervalMs?: number;
  /** Graceful shutdown timeout in ms (default: 5_000) */
  shutdownTimeoutMs?: number;
  /** Default max concurrent requests per server (default: 10) */
  defaultMaxConcurrent?: number;
}

/** Hypervisor event types */
export interface HypervisorEvents {
  'server:started': (serverId: string) => void;
  'server:stopped': (serverId: string) => void;
  'server:error': (serverId: string, error: Error) => void;
  'server:health': (serverId: string, healthy: boolean) => void;
  'tool:discovered': (tool: ToolCapability) => void;
}

/** Server spawn result */
export interface SpawnResult {
  success: boolean;
  serverId: string;
  error?: string;
  tools?: ToolCapability[];
}

/** Hypervisor status */
export interface HypervisorStatus {
  running: boolean;
  serverCount: number;
  servers: Array<{
    id: string;
    name: string;
    state: ServerState;
    activeRequests: number;
    toolCount: number;
    uptime: number | null;
  }>;
  totalTools: number;
}

// =============================================================================
// Default Config
// =============================================================================

const DEFAULT_HYPERVISOR_CONFIG: Required<HypervisorConfig> = {
  maxServers: 20,
  defaultStartupTimeoutMs: 10_000,
  defaultHealthCheckIntervalMs: 30_000,
  shutdownTimeoutMs: 5_000,
  defaultMaxConcurrent: 10,
};

// =============================================================================
// Hypervisor
// =============================================================================

/**
 * MCP Hypervisor manages the lifecycle of multiple MCP server instances.
 *
 * Usage:
 * ```ts
 * const hypervisor = new MCPHypervisor();
 * await hypervisor.start();
 *
 * const result = await hypervisor.spawnServer({
 *   id: 'stripe',
 *   name: 'Stripe MCP',
 *   command: 'npx',
 *   args: ['@stripe/mcp', '--tools=all'],
 * });
 *
 * const tool = hypervisor.findTool('create_payment_intent');
 * await hypervisor.shutdown();
 * ```
 */
export class MCPHypervisor extends EventEmitter {
  private servers: Map<string, ManagedServer> = new Map();
  private config: Required<HypervisorConfig>;
  private running = false;
  private shuttingDown = false;
  private spawnFn: typeof import('node:child_process').spawn;

  constructor(config: HypervisorConfig = {}, spawnFn?: typeof import('node:child_process').spawn) {
    super();
    this.config = { ...DEFAULT_HYPERVISOR_CONFIG, ...config };
    // Allow injection for testing; lazy-load at runtime
    this.spawnFn = spawnFn as typeof import('node:child_process').spawn;
  }

  /**
   * Initialize the hypervisor.
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Hypervisor is already running');
    }
    this.running = true;
    this.shuttingDown = false;
  }

  /**
   * Spawn a new MCP server.
   */
  async spawnServer(definition: ServerDefinition): Promise<SpawnResult> {
    if (!this.running) {
      return { success: false, serverId: definition.id, error: 'Hypervisor is not running' };
    }

    if (this.shuttingDown) {
      return { success: false, serverId: definition.id, error: 'Hypervisor is shutting down' };
    }

    if (this.servers.has(definition.id)) {
      return {
        success: false,
        serverId: definition.id,
        error: `Server "${definition.id}" already exists`,
      };
    }

    if (this.servers.size >= this.config.maxServers) {
      return {
        success: false,
        serverId: definition.id,
        error: `Maximum server limit (${this.config.maxServers}) reached`,
      };
    }

    const managed: ManagedServer = {
      definition,
      state: 'init',
      process: null,
      tools: [],
      activeRequests: 0,
      startedAt: null,
      lastHealthCheck: null,
      healthInterval: null,
      error: null,
    };

    this.servers.set(definition.id, managed);

    try {
      // Spawn the process
      const timeoutMs = definition.startupTimeoutMs ?? this.config.defaultStartupTimeoutMs;
      await this.doSpawn(managed, timeoutMs);

      managed.state = 'ready';
      managed.startedAt = Date.now();
      this.emit('server:started', definition.id);

      // Start health checks
      const healthIntervalMs =
        definition.healthCheckIntervalMs ?? this.config.defaultHealthCheckIntervalMs;
      managed.healthInterval = setInterval(() => this.checkHealth(definition.id), healthIntervalMs);

      return {
        success: true,
        serverId: definition.id,
        tools: managed.tools,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      managed.state = 'error';
      managed.error = msg;
      this.emit('server:error', definition.id, error instanceof Error ? error : new Error(msg));

      return { success: false, serverId: definition.id, error: msg };
    }
  }

  /**
   * Stop a specific server.
   */
  async stopServer(serverId: string): Promise<void> {
    const managed = this.servers.get(serverId);
    if (!managed) {
      throw new Error(`Server "${serverId}" not found`);
    }

    await this.doStop(managed);
    this.servers.delete(serverId);
    this.emit('server:stopped', serverId);
  }

  /**
   * Graceful shutdown of all servers.
   * Waits for pending requests to complete up to the shutdown timeout.
   */
  async shutdown(): Promise<void> {
    if (!this.running) return;

    this.shuttingDown = true;

    // Wait for pending requests up to timeout
    const deadline = Date.now() + this.config.shutdownTimeoutMs;
    while (this.hasPendingRequests() && Date.now() < deadline) {
      await this.delay(100);
    }

    // Stop all servers
    const stopPromises = Array.from(this.servers.keys()).map(async (id) => {
      try {
        await this.stopServer(id);
      } catch {
        // Best effort during shutdown
      }
    });
    await Promise.all(stopPromises);

    this.servers.clear();
    this.running = false;
    this.shuttingDown = false;
  }

  /**
   * Register tool capabilities for a server.
   */
  registerTools(serverId: string, tools: ToolCapability[]): void {
    const managed = this.servers.get(serverId);
    if (!managed) {
      throw new Error(`Server "${serverId}" not found`);
    }

    managed.tools = tools;
    for (const tool of tools) {
      this.emit('tool:discovered', tool);
    }
  }

  /**
   * Find a tool by name across all servers.
   */
  findTool(toolName: string): ToolCapability | undefined {
    for (const managed of this.servers.values()) {
      const tool = managed.tools.find((t) => t.name === toolName);
      if (tool) return tool;
    }
    return undefined;
  }

  /**
   * Get all discovered tools.
   */
  getAllTools(): ToolCapability[] {
    const tools: ToolCapability[] = [];
    for (const managed of this.servers.values()) {
      tools.push(...managed.tools);
    }
    return tools;
  }

  /**
   * Get a server by ID.
   */
  getServer(serverId: string): ManagedServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get the current status of the hypervisor.
   */
  getStatus(): HypervisorStatus {
    const now = Date.now();
    return {
      running: this.running,
      serverCount: this.servers.size,
      servers: Array.from(this.servers.values()).map((s) => ({
        id: s.definition.id,
        name: s.definition.name,
        state: s.state,
        activeRequests: s.activeRequests,
        toolCount: s.tools.length,
        uptime: s.startedAt ? now - s.startedAt : null,
      })),
      totalTools: this.getAllTools().length,
    };
  }

  /**
   * Whether the hypervisor is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Increment active request count for a server.
   */
  acquireSlot(serverId: string): boolean {
    const managed = this.servers.get(serverId);
    if (!managed || (managed.state !== 'ready' && managed.state !== 'executing')) return false;

    const maxConcurrent = managed.definition.maxConcurrent ?? this.config.defaultMaxConcurrent;
    if (managed.activeRequests >= maxConcurrent) return false;

    managed.activeRequests++;
    managed.state = 'executing';
    return true;
  }

  /**
   * Decrement active request count for a server.
   */
  releaseSlot(serverId: string): void {
    const managed = this.servers.get(serverId);
    if (!managed) return;

    managed.activeRequests = Math.max(0, managed.activeRequests - 1);
    if (managed.activeRequests === 0 && managed.state === 'executing') {
      managed.state = 'ready';
    }
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private async doSpawn(managed: ManagedServer, timeoutMs: number): Promise<void> {
    if (!this.spawnFn) {
      // Lazy-load spawn to allow test injection
      const cp = await import('node:child_process');
      this.spawnFn = cp.spawn;
    }

    const proc = this.spawnFn(managed.definition.command, managed.definition.args, {
      stdio: 'pipe',
      env: { ...process.env, ...managed.definition.env },
    });

    managed.process = proc;

    // Wait for process to be ready (or fail)
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        proc.on('error', (err) => reject(err));

        // Consider ready after spawn event
        proc.on('spawn', () => resolve());
      }),
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Server "${managed.definition.id}" startup timed out after ${timeoutMs}ms`),
            ),
          timeoutMs,
        ),
      ),
    ]);

    // Handle unexpected exit
    proc.on('exit', (code, signal) => {
      if (managed.state !== 'stopped') {
        managed.state = 'error';
        managed.error = `Process exited unexpectedly (code=${code}, signal=${signal})`;
        this.emit('server:error', managed.definition.id, new Error(managed.error));
      }
    });
  }

  private async doStop(managed: ManagedServer): Promise<void> {
    // Clear health check
    if (managed.healthInterval) {
      clearInterval(managed.healthInterval);
      managed.healthInterval = null;
    }

    managed.state = 'stopped';

    // Kill the process
    if (managed.process && !managed.process.killed) {
      // Set up exit listener BEFORE sending kill signal
      const exitPromise = new Promise<void>((resolve) => {
        managed.process?.on('exit', () => resolve());
      });

      managed.process.kill('SIGTERM');

      // If process is already killed (synchronous kill), skip waiting
      if (!managed.process.killed) {
        // Wait for exit, then force kill
        await Promise.race([
          exitPromise,
          new Promise<void>((resolve) => {
            setTimeout(() => {
              if (managed.process && !managed.process.killed) {
                managed.process.kill('SIGKILL');
              }
              resolve();
            }, 3_000);
          }),
        ]);
      }
    }

    managed.process = null;
  }

  private checkHealth(serverId: string): void {
    const managed = this.servers.get(serverId);
    if (!managed) return;

    const healthy = managed.process !== null && !managed.process.killed;
    managed.lastHealthCheck = Date.now();

    this.emit('server:health', serverId, healthy);

    if (!healthy && managed.state === 'ready') {
      managed.state = 'error';
      managed.error = 'Health check failed: process not running';
    }
  }

  private hasPendingRequests(): boolean {
    for (const managed of this.servers.values()) {
      if (managed.activeRequests > 0) return true;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Server Config Validation
// =============================================================================

/** Validate a server definition. Returns an array of error messages (empty = valid). */
export function validateServerDefinition(definition: Partial<ServerDefinition>): string[] {
  const errors: string[] = [];

  if (!definition.id || typeof definition.id !== 'string') {
    errors.push('Server ID is required and must be a string');
  }

  if (!definition.name || typeof definition.name !== 'string') {
    errors.push('Server name is required and must be a string');
  }

  if (!definition.command || typeof definition.command !== 'string') {
    errors.push('Server command is required and must be a string');
  }

  if (!Array.isArray(definition.args)) {
    errors.push('Server args must be an array');
  }

  if (definition.startupTimeoutMs !== undefined && definition.startupTimeoutMs <= 0) {
    errors.push('Startup timeout must be positive');
  }

  if (definition.healthCheckIntervalMs !== undefined && definition.healthCheckIntervalMs <= 0) {
    errors.push('Health check interval must be positive');
  }

  if (definition.maxConcurrent !== undefined && definition.maxConcurrent <= 0) {
    errors.push('Max concurrent must be positive');
  }

  return errors;
}
