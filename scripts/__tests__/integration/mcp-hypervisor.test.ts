/**
 * MCP Hypervisor Tests
 *
 * Tests the hypervisor lifecycle management including:
 * - Initialization and shutdown
 * - Server spawning (success, failure, timeout)
 * - Server lifecycle (init -> ready -> executing -> cleanup)
 * - Tool discovery and capability registration
 * - Concurrent server requests
 * - Resource cleanup on failure/crash
 * - Connection pooling (slot acquire/release)
 * - Health check integration
 * - Server config validation
 * - Graceful shutdown (pending requests complete before exit)
 */

import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type HypervisorConfig,
  MCPHypervisor,
  type ServerDefinition,
  type ToolCapability,
  validateServerDefinition,
} from '../../mcp/hypervisor.js';

// =============================================================================
// Mocks
// =============================================================================

/** Mock process type */
type MockProcess = EventEmitter & {
  pid: number;
  killed: boolean;
  kill: ReturnType<typeof vi.fn>;
  stdout: EventEmitter;
  stderr: EventEmitter;
};

/** Mock process creation options */
interface MockProcessOptions {
  exitCode?: number;
  exitImmediately?: boolean;
  failOnSpawn?: boolean;
}

/** Create a mock ChildProcess that emits 'spawn' immediately */
function createMockProcess(options?: MockProcessOptions): MockProcess {
  const proc = new EventEmitter() as MockProcess;
  proc.pid = Math.floor(Math.random() * 100_000);
  proc.killed = false;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn((signal?: string) => {
    proc.killed = true;
    if (signal === 'SIGTERM' || signal === 'SIGKILL') {
      proc.emit('exit', 0, signal);
    }
  });

  // Emit spawn or error in the next tick
  if (options?.failOnSpawn) {
    process.nextTick(() => proc.emit('error', new Error('spawn ENOENT')));
  } else {
    process.nextTick(() => proc.emit('spawn'));
  }

  if (options?.exitImmediately) {
    setTimeout(() => {
      proc.emit('exit', options.exitCode ?? 0, null);
    }, 5);
  }

  return proc;
}

/**
 * Create a mock spawn function.
 * If a specific mock process is provided, it returns that process every time.
 * Otherwise, it creates a new mock process for each call (required for multi-server tests).
 */
function createMockSpawn(mockProcess?: MockProcess, processOptions?: MockProcessOptions) {
  if (mockProcess) {
    return vi.fn(() => mockProcess);
  }
  return vi.fn(() => createMockProcess(processOptions));
}

/** Create a valid server definition for testing */
function makeServerDef(overrides: Partial<ServerDefinition> = {}): ServerDefinition {
  return {
    id: 'test-server',
    name: 'Test Server',
    command: 'node',
    args: ['server.js'],
    ...overrides,
  };
}

/** Default fast config for tests  -  avoid 5s shutdown waits */
const FAST_CONFIG: HypervisorConfig = { shutdownTimeoutMs: 100 };

// =============================================================================
// Tests
// =============================================================================

describe('MCP Hypervisor', () => {
  let hypervisor: MCPHypervisor;

  afterEach(async () => {
    if (hypervisor?.isRunning()) {
      await hypervisor.shutdown();
    }
  });

  // ---------------------------------------------------------------------------
  // Initialization and Shutdown
  // ---------------------------------------------------------------------------

  describe('Initialization', () => {
    it('should start the hypervisor', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.start();

      expect(hypervisor.isRunning()).toBe(true);
    });

    it('should throw if started twice', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.start();

      await expect(hypervisor.start()).rejects.toThrow('already running');
    });

    it('should apply custom config', () => {
      const config: HypervisorConfig = {
        maxServers: 5,
        defaultStartupTimeoutMs: 5_000,
        shutdownTimeoutMs: 2_000,
      };

      hypervisor = new MCPHypervisor(config);
      const status = hypervisor.getStatus();

      expect(status.running).toBe(false);
      expect(status.serverCount).toBe(0);
    });

    it('should report empty status before starting', () => {
      hypervisor = new MCPHypervisor();
      const status = hypervisor.getStatus();

      expect(status.running).toBe(false);
      expect(status.serverCount).toBe(0);
      expect(status.servers).toEqual([]);
      expect(status.totalTools).toBe(0);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly with no servers', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.start();
      await hypervisor.shutdown();

      expect(hypervisor.isRunning()).toBe(false);
    });

    it('should be safe to shutdown when not running', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.shutdown(); // No-op
      expect(hypervisor.isRunning()).toBe(false);
    });

    it('should stop all servers on shutdown', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef({ id: 'server-1' }));
      await hypervisor.spawnServer(makeServerDef({ id: 'server-2' }));

      expect(hypervisor.getStatus().serverCount).toBe(2);

      await hypervisor.shutdown();

      expect(hypervisor.isRunning()).toBe(false);
      expect(hypervisor.getStatus().serverCount).toBe(0);
    });

    it('should emit server:stopped for each server on shutdown', async () => {
      const spawnFn = createMockSpawn();
      const stoppedServers: string[] = [];

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      hypervisor.on('server:stopped', (id) => stoppedServers.push(id));
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef({ id: 'a' }));
      await hypervisor.spawnServer(makeServerDef({ id: 'b' }));

      await hypervisor.shutdown();

      expect(stoppedServers).toContain('a');
      expect(stoppedServers).toContain('b');
    });
  });

  // ---------------------------------------------------------------------------
  // Server Spawning
  // ---------------------------------------------------------------------------

  describe('Server Spawning', () => {
    it('should spawn a server successfully', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      const result = await hypervisor.spawnServer(makeServerDef());

      expect(result.success).toBe(true);
      expect(result.serverId).toBe('test-server');
      expect(spawnFn).toHaveBeenCalledWith('node', ['server.js'], expect.any(Object));
    });

    it('should emit server:started event on successful spawn', async () => {
      const spawnFn = createMockSpawn();
      let startedId: string | undefined;

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      hypervisor.on('server:started', (id) => {
        startedId = id;
      });
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef());

      expect(startedId).toBe('test-server');
    });

    it('should set server state to ready after spawn', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef());

      const server = hypervisor.getServer('test-server');
      expect(server?.state).toBe('ready');
      expect(server?.startedAt).toBeGreaterThan(0);
    });

    it('should fail if hypervisor is not running', async () => {
      hypervisor = new MCPHypervisor();

      const result = await hypervisor.spawnServer(makeServerDef());

      expect(result.success).toBe(false);
      expect(result.error).toContain('not running');
    });

    it('should fail if server ID already exists', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef());
      const result = await hypervisor.spawnServer(makeServerDef());

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should fail if max server limit reached', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor({ maxServers: 2, shutdownTimeoutMs: 100 }, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef({ id: 'a' }));
      await hypervisor.spawnServer(makeServerDef({ id: 'b' }));

      const result = await hypervisor.spawnServer(makeServerDef({ id: 'c' }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum server limit');
    });

    it('should fail if spawn errors', async () => {
      const proc = createMockProcess({ failOnSpawn: true });
      const spawnFn = createMockSpawn(proc);

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      const result = await hypervisor.spawnServer(makeServerDef());

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should emit server:error on spawn failure', async () => {
      const proc = createMockProcess({ failOnSpawn: true });
      const spawnFn = createMockSpawn(proc);
      let errorId: string | undefined;

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      hypervisor.on('server:error', (id) => {
        errorId = id;
      });
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef());

      expect(errorId).toBe('test-server');
    });

    it('should set server state to error on spawn failure', async () => {
      const proc = createMockProcess({ failOnSpawn: true });
      const spawnFn = createMockSpawn(proc);

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef());

      const server = hypervisor.getServer('test-server');
      expect(server?.state).toBe('error');
      expect(server?.error).toContain('ENOENT');
    });

    it('should fail during shutdown', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      // Start shutdown
      const shutdownPromise = hypervisor.shutdown();
      const result = await hypervisor.spawnServer(makeServerDef());

      expect(result.success).toBe(false);
      expect(result.error).toContain('shutting down');

      await shutdownPromise;
    });

    it('should pass environment variables to spawned process', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(
        makeServerDef({
          env: { STRIPE_SECRET_KEY: 'sk_test_123' },
        }),
      );

      expect(spawnFn).toHaveBeenCalledWith(
        'node',
        ['server.js'],
        expect.objectContaining({
          env: expect.objectContaining({ STRIPE_SECRET_KEY: 'sk_test_123' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Server Lifecycle (init -> ready -> executing -> stopped)
  // ---------------------------------------------------------------------------

  describe('Server Lifecycle', () => {
    it('should transition through init -> ready states on spawn', async () => {
      const states: string[] = [];
      const proc = new EventEmitter() as ReturnType<typeof createMockProcess>;
      proc.pid = 1234;
      proc.killed = false;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = vi.fn(() => {
        proc.killed = true;
        proc.emit('exit', 0, 'SIGTERM');
      });

      const spawnFn = vi.fn(() => {
        // Track state before spawn event
        const server = hypervisor.getServer('test-server');
        if (server) states.push(server.state);

        // Emit spawn after a tick
        process.nextTick(() => proc.emit('spawn'));
        return proc;
      });

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef());

      states.push(hypervisor.getServer('test-server')!.state);

      expect(states).toContain('init');
      expect(states[states.length - 1]).toBe('ready');
    });

    it('should transition to executing when slot acquired', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      const acquired = hypervisor.acquireSlot('test-server');
      expect(acquired).toBe(true);
      expect(hypervisor.getServer('test-server')?.state).toBe('executing');
    });

    it('should transition back to ready when slot released', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      hypervisor.acquireSlot('test-server');
      hypervisor.releaseSlot('test-server');

      expect(hypervisor.getServer('test-server')?.state).toBe('ready');
    });

    it('should transition to stopped on stopServer', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      await hypervisor.stopServer('test-server');

      // Server is removed from the map on stop
      expect(hypervisor.getServer('test-server')).toBeUndefined();
    });

    it('should throw when stopping non-existent server', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.start();

      await expect(hypervisor.stopServer('nonexistent')).rejects.toThrow('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Tool Discovery and Registration
  // ---------------------------------------------------------------------------

  describe('Tool Discovery', () => {
    it('should register tools for a server', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      const tools: ToolCapability[] = [
        { name: 'create_payment', description: 'Create a payment', serverId: 'test-server' },
        { name: 'list_payments', description: 'List payments', serverId: 'test-server' },
      ];

      hypervisor.registerTools('test-server', tools);

      const server = hypervisor.getServer('test-server');
      expect(server?.tools).toHaveLength(2);
    });

    it('should emit tool:discovered for each registered tool', async () => {
      const spawnFn = createMockSpawn();
      const discovered: ToolCapability[] = [];

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      hypervisor.on('tool:discovered', (tool) => discovered.push(tool));
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      hypervisor.registerTools('test-server', [
        { name: 'tool-a', description: 'A', serverId: 'test-server' },
        { name: 'tool-b', description: 'B', serverId: 'test-server' },
      ]);

      expect(discovered).toHaveLength(2);
      expect(discovered[0].name).toBe('tool-a');
      expect(discovered[1].name).toBe('tool-b');
    });

    it('should find a tool by name', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      hypervisor.registerTools('test-server', [
        { name: 'create_payment', description: 'Create payment', serverId: 'test-server' },
      ]);

      const tool = hypervisor.findTool('create_payment');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('create_payment');
      expect(tool?.serverId).toBe('test-server');
    });

    it('should return undefined for missing tool', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.start();

      expect(hypervisor.findTool('nonexistent')).toBeUndefined();
    });

    it('should find tools across multiple servers', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef({ id: 'stripe' }));
      await hypervisor.spawnServer(makeServerDef({ id: 'neon' }));

      hypervisor.registerTools('stripe', [
        { name: 'create_payment', description: 'Payment', serverId: 'stripe' },
      ]);
      hypervisor.registerTools('neon', [
        { name: 'create_database', description: 'Database', serverId: 'neon' },
      ]);

      expect(hypervisor.findTool('create_payment')?.serverId).toBe('stripe');
      expect(hypervisor.findTool('create_database')?.serverId).toBe('neon');
    });

    it('should get all tools', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef({ id: 'a' }));
      await hypervisor.spawnServer(makeServerDef({ id: 'b' }));

      hypervisor.registerTools('a', [{ name: 'tool-1', description: 'T1', serverId: 'a' }]);
      hypervisor.registerTools('b', [
        { name: 'tool-2', description: 'T2', serverId: 'b' },
        { name: 'tool-3', description: 'T3', serverId: 'b' },
      ]);

      expect(hypervisor.getAllTools()).toHaveLength(3);
    });

    it('should throw when registering tools for non-existent server', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.start();

      expect(() => {
        hypervisor.registerTools('nonexistent', []);
      }).toThrow('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Connection Pooling (Slot Management)
  // ---------------------------------------------------------------------------

  describe('Connection Pooling', () => {
    it('should acquire and release slots', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      expect(hypervisor.acquireSlot('test-server')).toBe(true);
      expect(hypervisor.getServer('test-server')?.activeRequests).toBe(1);

      hypervisor.releaseSlot('test-server');
      expect(hypervisor.getServer('test-server')?.activeRequests).toBe(0);
    });

    it('should enforce max concurrent limit', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef({ maxConcurrent: 2 }));

      expect(hypervisor.acquireSlot('test-server')).toBe(true);
      expect(hypervisor.acquireSlot('test-server')).toBe(true);
      expect(hypervisor.acquireSlot('test-server')).toBe(false); // Limit reached

      hypervisor.releaseSlot('test-server');
      expect(hypervisor.acquireSlot('test-server')).toBe(true); // Slot freed
    });

    it('should not acquire slot on non-ready server', async () => {
      const proc = createMockProcess({ failOnSpawn: true });
      const spawnFn = createMockSpawn(proc);

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      // Server is in error state
      expect(hypervisor.acquireSlot('test-server')).toBe(false);
    });

    it('should not acquire slot for non-existent server', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.start();

      expect(hypervisor.acquireSlot('nonexistent')).toBe(false);
    });

    it('should not go below zero active requests on release', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      // Release without acquire
      hypervisor.releaseSlot('test-server');
      expect(hypervisor.getServer('test-server')?.activeRequests).toBe(0);
    });

    it('should be safe to release non-existent server slot', async () => {
      hypervisor = new MCPHypervisor();
      await hypervisor.start();

      // Should not throw
      hypervisor.releaseSlot('nonexistent');
    });

    it('should use default max concurrent from config', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(
        { defaultMaxConcurrent: 1, shutdownTimeoutMs: 100 },
        spawnFn as never,
      );
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef()); // No maxConcurrent override

      expect(hypervisor.acquireSlot('test-server')).toBe(true);
      expect(hypervisor.acquireSlot('test-server')).toBe(false); // Hit default limit of 1
    });
  });

  // ---------------------------------------------------------------------------
  // Health Checks
  // ---------------------------------------------------------------------------

  describe('Health Checks', () => {
    it('should emit server:health events', async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      const spawnFn = createMockSpawn(proc);
      const healthEvents: Array<{ id: string; healthy: boolean }> = [];

      hypervisor = new MCPHypervisor(
        { defaultHealthCheckIntervalMs: 1_000, shutdownTimeoutMs: 100 },
        spawnFn as never,
      );
      hypervisor.on('server:health', (id, healthy) => {
        healthEvents.push({ id, healthy });
      });

      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      // Advance time to trigger health check
      vi.advanceTimersByTime(1_100);

      expect(healthEvents.length).toBeGreaterThan(0);
      expect(healthEvents[0].id).toBe('test-server');

      vi.useRealTimers();
    });

    it('should detect unhealthy server when process is killed', async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      const spawnFn = createMockSpawn(proc);
      const healthEvents: Array<{ id: string; healthy: boolean }> = [];

      hypervisor = new MCPHypervisor(
        { defaultHealthCheckIntervalMs: 100, shutdownTimeoutMs: 100 },
        spawnFn as never,
      );
      hypervisor.on('server:health', (id, healthy) => {
        healthEvents.push({ id, healthy });
      });

      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      // Kill the process
      proc.killed = true;

      vi.advanceTimersByTime(200);

      const unhealthy = healthEvents.find((e) => !e.healthy);
      expect(unhealthy).toBeDefined();

      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // Graceful Shutdown
  // ---------------------------------------------------------------------------

  describe('Graceful Shutdown', () => {
    it('should wait for pending requests before shutdown', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor({ shutdownTimeoutMs: 1_000 }, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      // Acquire a slot to simulate pending request
      hypervisor.acquireSlot('test-server');
      expect(hypervisor.getServer('test-server')?.activeRequests).toBe(1);

      // Start shutdown and release slot shortly after
      const shutdownPromise = hypervisor.shutdown();
      setTimeout(() => hypervisor.releaseSlot('test-server'), 50);

      await shutdownPromise;

      expect(hypervisor.isRunning()).toBe(false);
    });

    it('should force shutdown after timeout even with pending requests', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor({ shutdownTimeoutMs: 100 }, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      // Acquire slot but never release
      hypervisor.acquireSlot('test-server');

      const start = Date.now();
      await hypervisor.shutdown();
      const elapsed = Date.now() - start;

      expect(hypervisor.isRunning()).toBe(false);
      // Should have waited approximately the shutdown timeout
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(500);
    });

    it('should reject new spawns during shutdown', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor({ shutdownTimeoutMs: 200 }, spawnFn as never);
      await hypervisor.start();

      const shutdownPromise = hypervisor.shutdown();

      const result = await hypervisor.spawnServer(makeServerDef());
      expect(result.success).toBe(false);
      expect(result.error).toContain('shutting down');

      await shutdownPromise;
    });
  });

  // ---------------------------------------------------------------------------
  // Status Reporting
  // ---------------------------------------------------------------------------

  describe('Status', () => {
    it('should report accurate status with multiple servers', async () => {
      const spawnFn = createMockSpawn();

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef({ id: 'stripe', name: 'Stripe MCP' }));
      await hypervisor.spawnServer(makeServerDef({ id: 'neon', name: 'Neon MCP' }));

      hypervisor.registerTools('stripe', [
        { name: 't1', description: '', serverId: 'stripe' },
        { name: 't2', description: '', serverId: 'stripe' },
      ]);
      hypervisor.registerTools('neon', [{ name: 't3', description: '', serverId: 'neon' }]);

      hypervisor.acquireSlot('stripe');

      const status = hypervisor.getStatus();

      expect(status.running).toBe(true);
      expect(status.serverCount).toBe(2);
      expect(status.totalTools).toBe(3);

      const stripeStatus = status.servers.find((s) => s.id === 'stripe');
      expect(stripeStatus?.name).toBe('Stripe MCP');
      expect(stripeStatus?.state).toBe('executing');
      expect(stripeStatus?.activeRequests).toBe(1);
      expect(stripeStatus?.toolCount).toBe(2);
      expect(stripeStatus?.uptime).toBeGreaterThanOrEqual(0);

      const neonStatus = status.servers.find((s) => s.id === 'neon');
      expect(neonStatus?.state).toBe('ready');
      expect(neonStatus?.activeRequests).toBe(0);
      expect(neonStatus?.toolCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Server Config Validation
  // ---------------------------------------------------------------------------

  describe('Config Validation', () => {
    it('should accept valid server definition', () => {
      const errors = validateServerDefinition(makeServerDef());
      expect(errors).toEqual([]);
    });

    it('should reject missing id', () => {
      const errors = validateServerDefinition({ name: 'Test', command: 'node', args: [] });
      expect(errors).toContain('Server ID is required and must be a string');
    });

    it('should reject missing name', () => {
      const errors = validateServerDefinition({ id: 'test', command: 'node', args: [] });
      expect(errors).toContain('Server name is required and must be a string');
    });

    it('should reject missing command', () => {
      const errors = validateServerDefinition({ id: 'test', name: 'Test', args: [] });
      expect(errors).toContain('Server command is required and must be a string');
    });

    it('should reject missing args', () => {
      const errors = validateServerDefinition({ id: 'test', name: 'Test', command: 'node' });
      expect(errors).toContain('Server args must be an array');
    });

    it('should reject negative startup timeout', () => {
      const errors = validateServerDefinition({
        ...makeServerDef(),
        startupTimeoutMs: -1,
      });
      expect(errors).toContain('Startup timeout must be positive');
    });

    it('should reject zero health check interval', () => {
      const errors = validateServerDefinition({
        ...makeServerDef(),
        healthCheckIntervalMs: 0,
      });
      expect(errors).toContain('Health check interval must be positive');
    });

    it('should reject zero max concurrent', () => {
      const errors = validateServerDefinition({
        ...makeServerDef(),
        maxConcurrent: 0,
      });
      expect(errors).toContain('Max concurrent must be positive');
    });

    it('should collect multiple errors', () => {
      const errors = validateServerDefinition({});
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Error Recovery
  // ---------------------------------------------------------------------------

  describe('Error Recovery', () => {
    it('should handle unexpected process exit', async () => {
      const proc = createMockProcess();
      const spawnFn = createMockSpawn(proc);
      let errorId: string | undefined;

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      hypervisor.on('server:error', (id) => {
        errorId = id;
      });
      await hypervisor.start();

      await hypervisor.spawnServer(makeServerDef());
      expect(hypervisor.getServer('test-server')?.state).toBe('ready');

      // Simulate unexpected exit
      proc.emit('exit', 1, null);

      // Wait for event to propagate
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(hypervisor.getServer('test-server')?.state).toBe('error');
      expect(errorId).toBe('test-server');
    });

    it('should still allow stop on errored server', async () => {
      const proc = createMockProcess({ failOnSpawn: true });
      const spawnFn = createMockSpawn(proc);

      hypervisor = new MCPHypervisor(FAST_CONFIG, spawnFn as never);
      await hypervisor.start();
      await hypervisor.spawnServer(makeServerDef());

      // Server is in error state  -  stopping should not throw
      await hypervisor.stopServer('test-server');
      expect(hypervisor.getServer('test-server')).toBeUndefined();
    });
  });
});
