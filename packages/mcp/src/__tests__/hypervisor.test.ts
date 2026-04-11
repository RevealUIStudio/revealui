import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MCPHypervisor, type MCPServerConfig } from '../hypervisor.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@revealui/core/monitoring', () => ({
  registerCleanupHandler: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock child_process.spawn
const mockProcess = {
  pid: 12345,
  exitCode: null as number | null,
  stdin: { write: vi.fn() },
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  on: vi.fn(),
  kill: vi.fn(),
};

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockProcess),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testConfig: MCPServerConfig = {
  name: 'test-server',
  command: 'node',
  args: ['test-mcp-server.js'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCPHypervisor', () => {
  beforeEach(() => {
    MCPHypervisor._resetForTests();
    mockProcess.exitCode = null;
    mockProcess.stdin.write.mockClear();
    mockProcess.stdout.on.mockClear();
    mockProcess.stderr.on.mockClear();
    mockProcess.on.mockClear();
    mockProcess.kill.mockClear();
  });

  afterEach(() => {
    MCPHypervisor._resetForTests();
    vi.clearAllMocks();
  });

  describe('getInstance()', () => {
    it('returns a singleton', () => {
      const a = MCPHypervisor.getInstance();
      const b = MCPHypervisor.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('registerServer()', () => {
    it('registers a server config', () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const status = hv.getStatus();
      expect(status['test-server']).toMatchObject({
        healthy: false,
        toolCount: 0,
        pid: null,
      });
    });

    it('ignores duplicate registrations', () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);
      hv.registerServer(testConfig); // duplicate  -  no throw

      const status = hv.getStatus();
      expect(Object.keys(status)).toHaveLength(1);
    });
  });

  describe('getAllTools()', () => {
    it('returns empty array when no servers are healthy', () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      expect(hv.getAllTools()).toHaveLength(0);
    });

    it('returns namespaced tools from healthy servers', () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      // Directly inject tools into the server entry via internal state
      // (bypasses spawn for unit testing)
      // Access private state via type cast  -  for testing only
      const servers = (
        hv as unknown as { servers: Map<string, { healthy: boolean; tools: unknown[] }> }
      ).servers;
      const entry = servers.get('test-server')!;
      entry.healthy = true;
      entry.tools = [
        {
          name: 'create_payment',
          description: 'Create a payment',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
        {
          name: 'list_payments',
          description: 'List payments',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
      ];

      const tools = hv.getAllTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]?.namespacedName).toBe('@@mcp_test-server_create_payment');
      expect(tools[1]?.namespacedName).toBe('@@mcp_test-server_list_payments');
      expect(tools[0]?.serverName).toBe('test-server');
    });

    it('skips unhealthy servers', () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const servers = (
        hv as unknown as { servers: Map<string, { healthy: boolean; tools: unknown[] }> }
      ).servers;
      const entry = servers.get('test-server')!;
      entry.healthy = false;
      entry.tools = [
        { name: 'some_tool', description: '', inputSchema: { type: 'object' as const } },
      ];

      expect(hv.getAllTools()).toHaveLength(0);
    });

    it('namespaces tools from multiple healthy servers', () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer({ name: 'stripe', command: 'node', args: [] });
      hv.registerServer({ name: 'vercel', command: 'node', args: [] });

      const servers = (
        hv as unknown as { servers: Map<string, { healthy: boolean; tools: unknown[] }> }
      ).servers;

      const stripe = servers.get('stripe')!;
      stripe.healthy = true;
      stripe.tools = [
        { name: 'charge', description: '', inputSchema: { type: 'object' as const } },
      ];

      const vercel = servers.get('vercel')!;
      vercel.healthy = true;
      vercel.tools = [
        { name: 'deploy', description: '', inputSchema: { type: 'object' as const } },
      ];

      const tools = hv.getAllTools();
      const names = tools.map((t) => t.namespacedName);

      expect(names).toContain('@@mcp_stripe_charge');
      expect(names).toContain('@@mcp_vercel_deploy');
    });
  });

  describe('pingServer()', () => {
    it('returns false for unknown server', async () => {
      const hv = MCPHypervisor.getInstance();
      const result = await hv.pingServer('nonexistent');
      expect(result).toBe(false);
    });

    it('returns false when process is not running', async () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const result = await hv.pingServer('test-server');
      expect(result).toBe(false);
    });
  });

  describe('getStatus()', () => {
    it('reflects registered servers', () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer({ name: 'alpha', command: 'node', args: [] });
      hv.registerServer({ name: 'beta', command: 'node', args: [] });

      const status = hv.getStatus();
      expect(Object.keys(status)).toHaveLength(2);
      expect(status.alpha?.healthy).toBe(false);
      expect(status.beta?.healthy).toBe(false);
    });
  });

  describe('unregisterServer()', () => {
    it('removes a registered server', async () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);
      await hv.unregisterServer('test-server');

      expect(hv.getStatus()).not.toHaveProperty('test-server');
    });
  });

  // ===========================================================================
  // Error recovery & edge case tests
  // ===========================================================================

  /**
   * Helper: start a server with fake timers, advancing past the 500ms startup
   * delay and 5s tool discovery timeout. Returns captured event callbacks.
   */
  async function startServerWithFakeTimers(hv: ReturnType<typeof MCPHypervisor.getInstance>) {
    let exitCb: (code: number | null) => void = () => {};
    let stdoutCb: (chunk: Buffer) => void = () => {};

    mockProcess.on.mockImplementation((event: string, cb: (code: number | null) => void) => {
      if (event === 'exit') exitCb = cb;
      return mockProcess;
    });
    mockProcess.stdout.on.mockImplementation((event: string, cb: (chunk: Buffer) => void) => {
      if (event === 'data') stdoutCb = cb;
      return mockProcess;
    });
    mockProcess.stderr.on.mockImplementation((_event: string, _cb: unknown) => mockProcess);

    const startPromise = hv.startServer('test-server');
    // Advance past 500ms startup delay + 5s tool discovery timeout
    await vi.advanceTimersByTimeAsync(5_501);
    await startPromise;

    return { exitCb, stdoutCb };
  }

  describe('error recovery', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects pending requests when server process exits', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const { exitCb } = await startServerWithFakeTimers(hv);

      // callTool creates a pending request
      const toolPromise = hv.callTool('test-server', 'some_tool', {});

      // Simulate server crash  -  exit handler rejects all pending requests
      mockProcess.exitCode = 1;
      exitCb(1);

      await expect(toolPromise).rejects.toThrow('Server "test-server" exited');
    });

    it('sets server unhealthy on process exit', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const { exitCb } = await startServerWithFakeTimers(hv);

      // Mark healthy for this test
      const servers = (hv as unknown as { servers: Map<string, { healthy: boolean }> }).servers;
      servers.get('test-server')!.healthy = true;

      // Simulate crash
      mockProcess.exitCode = 1;
      exitCb(1);

      expect(hv.getStatus()['test-server']?.healthy).toBe(false);
    });

    it('rejects request with timeout after 5 seconds', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      await startServerWithFakeTimers(hv);

      // callTool sends request, no response will come
      const toolPromise = hv.callTool('test-server', 'some_tool', {});
      // Attach catch before advancing to prevent unhandled rejection warning
      const caught = toolPromise.catch((e: Error) => e);

      // Advance past the 5s timeout
      await vi.advanceTimersByTimeAsync(5_001);

      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch('timed out after 5000ms');
    });

    it('cleans up pending request map after timeout', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      await startServerWithFakeTimers(hv);

      const pendingRequests = (hv as unknown as { pendingRequests: Map<number, unknown> })
        .pendingRequests;

      const countBefore = pendingRequests.size;

      const toolPromise = hv.callTool('test-server', 'some_tool', {});
      // Attach catch before advancing to prevent unhandled rejection warning
      const caught = toolPromise.catch(() => {});
      expect(pendingRequests.size).toBe(countBefore + 1);

      await vi.advanceTimersByTimeAsync(5_001);
      await caught;

      // Pending request should be cleaned up after timeout
      expect(pendingRequests.size).toBe(countBefore);
    });

    it('survives malformed JSON on stdout without crashing', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const { stdoutCb } = await startServerWithFakeTimers(hv);

      // Send garbage data  -  should not throw
      expect(() => {
        stdoutCb(Buffer.from('NOT VALID JSON\n'));
        stdoutCb(Buffer.from('{{{{broken\n'));
        stdoutCb(Buffer.from('\n'));
      }).not.toThrow();

      // Hypervisor should still be functional
      expect(hv.getStatus()['test-server']).toBeDefined();
    });

    it('rejects pending requests when stopServer is called', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const { exitCb } = await startServerWithFakeTimers(hv);

      // Create a pending request  -  attach catch before kill to prevent unhandled rejection
      const toolPromise = hv.callTool('test-server', 'some_tool', {});
      const caught = toolPromise.catch((e: Error) => e);

      // Simulate kill triggering exit callback
      mockProcess.kill.mockImplementation(() => {
        mockProcess.exitCode = 0;
        exitCb(0);
        return true;
      });

      const stopPromise = hv.stopServer('test-server');
      // Advance past the 200ms post-kill wait in stopServer
      await vi.advanceTimersByTimeAsync(200);
      await stopPromise;

      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch('Server "test-server" exited');
    });

    it('routes concurrent responses to correct pending promises', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const { stdoutCb } = await startServerWithFakeTimers(hv);

      // Clear write mock to make indexing simpler
      mockProcess.stdin.write.mockClear();

      // Fire off two concurrent requests
      const promise1 = hv.callTool('test-server', 'tool_a', { x: 1 });
      const promise2 = hv.callTool('test-server', 'tool_b', { x: 2 });

      // Get the request IDs from what was written to stdin
      const writes = mockProcess.stdin.write.mock.calls;
      const req1 = JSON.parse(writes[0]?.[0] as string);
      const req2 = JSON.parse(writes[1]?.[0] as string);

      // Respond in reverse order  -  proves routing is by ID, not order
      stdoutCb(
        Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id: req2.id, result: 'result_b' })}\n`),
      );
      stdoutCb(
        Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id: req1.id, result: 'result_a' })}\n`),
      );

      await expect(promise1).resolves.toBe('result_a');
      await expect(promise2).resolves.toBe('result_b');
    });
  });

  describe('startServer()', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('throws for unknown server', async () => {
      const hv = MCPHypervisor.getInstance();
      await expect(hv.startServer('nonexistent')).rejects.toThrow('Unknown server: "nonexistent"');
    });

    it('is a no-op when server process is already running', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      mockProcess.on.mockImplementation((_event: string, _cb: unknown) => mockProcess);
      mockProcess.stdout.on.mockImplementation((_event: string, _cb: unknown) => mockProcess);
      mockProcess.stderr.on.mockImplementation((_event: string, _cb: unknown) => mockProcess);

      const { spawn: spawnMock } = await import('node:child_process');
      const callCountBefore = (spawnMock as ReturnType<typeof vi.fn>).mock.calls.length;

      const startPromise = hv.startServer('test-server');
      await vi.advanceTimersByTimeAsync(5_501);
      await startPromise;

      const callCountAfterFirst = (spawnMock as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callCountAfterFirst).toBe(callCountBefore + 1);

      // Start again  -  process.exitCode is still null (running)
      const startPromise2 = hv.startServer('test-server');
      await vi.advanceTimersByTimeAsync(5_501);
      await startPromise2;

      // spawn should NOT have been called again
      expect((spawnMock as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountAfterFirst);
    });

    it('marks healthy even when tool discovery fails if process is alive', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      mockProcess.on.mockImplementation((_event: string, _cb: unknown) => mockProcess);
      mockProcess.stdout.on.mockImplementation((_event: string, _cb: unknown) => mockProcess);
      mockProcess.stderr.on.mockImplementation((_event: string, _cb: unknown) => mockProcess);

      const startPromise = hv.startServer('test-server');
      // Advance past the 500ms startup delay + 5s request timeout for tools/list
      await vi.advanceTimersByTimeAsync(5_501);
      await startPromise;

      // Process is still alive (exitCode === null), so healthy should be true
      // despite tool discovery failing
      expect(hv.getStatus()['test-server']?.healthy).toBe(true);
    });
  });

  describe('callTool()', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects when server is not running', async () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      // Server registered but not started  -  process is null
      await expect(hv.callTool('test-server', 'some_tool', {})).rejects.toThrow(
        'Server "test-server" is not running',
      );
    });

    it('rejects when server process has exited', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      await startServerWithFakeTimers(hv);

      // Simulate process has exited
      mockProcess.exitCode = 1;

      await expect(hv.callTool('test-server', 'some_tool', {})).rejects.toThrow(
        'Server "test-server" is not running',
      );
    });

    it('sends correct JSON-RPC message format', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      await startServerWithFakeTimers(hv);

      // Clear write mock to isolate callTool writes
      mockProcess.stdin.write.mockClear();

      // Fire a callTool  -  attach catch immediately to prevent unhandled rejection
      const toolPromise = hv.callTool('test-server', 'create_payment', { amount: 1000 });
      const caught = toolPromise.catch(() => {});

      const writes = mockProcess.stdin.write.mock.calls;
      expect(writes).toHaveLength(1);
      const parsed = JSON.parse((writes[0]?.[0] as string).trim());

      expect(parsed).toMatchObject({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'create_payment',
          arguments: { amount: 1000 },
        },
      });
      expect(parsed.id).toBeTypeOf('number');

      // Clean up  -  advance past timeout
      await vi.advanceTimersByTimeAsync(5_001);
      await caught;
    });
  });

  describe('pingServer() edge cases', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('sets server unhealthy and returns false when process has exited', async () => {
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      // Inject a process that has exited (bypass startServer)
      const servers = (
        hv as unknown as {
          servers: Map<string, { process: typeof mockProcess | null; healthy: boolean }>;
        }
      ).servers;
      const entry = servers.get('test-server')!;
      entry.process = mockProcess as unknown as import('node:child_process').ChildProcess;
      entry.healthy = true;
      mockProcess.exitCode = 1;

      const result = await hv.pingServer('test-server');

      expect(result).toBe(false);
      expect(hv.getStatus()['test-server']?.healthy).toBe(false);
    });

    it('stays healthy when ping request fails but process is alive', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      // Inject a running process (bypass startServer)
      const servers = (
        hv as unknown as {
          servers: Map<string, { process: typeof mockProcess | null; healthy: boolean }>;
        }
      ).servers;
      const entry = servers.get('test-server')!;
      entry.process = mockProcess as unknown as import('node:child_process').ChildProcess;
      mockProcess.exitCode = null;

      const pingPromise = hv.pingServer('test-server');

      // Advance past timeout so the ping sendRequest times out
      await vi.advanceTimersByTimeAsync(5_001);

      const result = await pingPromise;

      // Process is alive, so pingServer should return true despite timeout
      expect(result).toBe(true);
      expect(hv.getStatus()['test-server']?.healthy).toBe(true);
    });
  });

  describe('handleResponse()', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects pending request on JSON-RPC error response', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const { stdoutCb } = await startServerWithFakeTimers(hv);

      // Clear write mock to isolate callTool writes
      mockProcess.stdin.write.mockClear();

      const toolPromise = hv.callTool('test-server', 'failing_tool', {});

      // Get the request ID from what was written to stdin
      const writes = mockProcess.stdin.write.mock.calls;
      const lastReq = JSON.parse((writes[0]?.[0] as string).trim());

      // Send a JSON-RPC error response
      stdoutCb(
        Buffer.from(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: lastReq.id,
            error: { code: -32600, message: 'Invalid Request' },
          })}\n`,
        ),
      );

      await expect(toolPromise).rejects.toThrow('JSON-RPC error -32600: Invalid Request');
    });

    it('ignores responses with unknown IDs', async () => {
      vi.useFakeTimers();
      const hv = MCPHypervisor.getInstance();
      hv.registerServer(testConfig);

      const { stdoutCb } = await startServerWithFakeTimers(hv);

      // Send a response with an ID that doesn't match any pending request
      expect(() => {
        stdoutCb(
          Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id: 999999, result: 'orphan' })}\n`),
        );
      }).not.toThrow();
    });
  });
});
