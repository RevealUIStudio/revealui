/**
 * MCP Integration Tests
 *
 * Tests MCP integration with other parts of the RevealUI system:
 * - Feature gating (MCP requires Pro tier)
 * - Process registry integration (MCP source tracking)
 * - Adapter + Hypervisor end-to-end orchestration
 * - Tool execution through the full pipeline
 */

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateIdempotencyKey,
  generateUniqueIdempotencyKey,
  MCPAdapter,
  type MCPConfig,
  type MCPRequest,
} from '../../mcp/adapter.js';
import { MCPHypervisor, type ToolCapability } from '../../mcp/hypervisor.js';

// =============================================================================
// Test Helpers
// =============================================================================

/** Concrete adapter for integration testing */
class StripeTestAdapter extends MCPAdapter {
  private tools: string[] = [
    'create_payment_intent',
    'list_payments',
    'create_customer',
    'create_subscription',
  ];

  constructor(config: MCPConfig = {}) {
    super('stripe', config);
  }

  protected isValidAction(action: string): boolean {
    return this.tools.includes(action);
  }

  protected getAuthHeaderName(): string {
    return 'Authorization';
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    switch (request.action) {
      case 'create_payment_intent':
        return {
          id: 'pi_test_123',
          amount: request.parameters?.amount ?? 1000,
          currency: request.parameters?.currency ?? 'usd',
          status: 'requires_payment_method',
        };

      case 'list_payments':
        return {
          data: [
            { id: 'pi_1', amount: 1000 },
            { id: 'pi_2', amount: 2500 },
          ],
          has_more: false,
        };

      case 'create_customer':
        return {
          id: 'cus_test_456',
          email: request.parameters?.email ?? 'test@example.com',
        };

      case 'create_subscription':
        return {
          id: 'sub_test_789',
          status: 'active',
          plan: request.parameters?.plan ?? 'pro',
        };

      default:
        throw new Error(`Unknown Stripe action: ${request.action}`);
    }
  }
}

/** Create a mock spawn function */
function createMockSpawn() {
  return vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & {
      pid: number;
      killed: boolean;
      kill: ReturnType<typeof vi.fn>;
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    proc.pid = 12345;
    proc.killed = false;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn(() => {
      proc.killed = true;
      proc.emit('exit', 0, 'SIGTERM');
    });
    process.nextTick(() => proc.emit('spawn'));
    return proc;
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('MCP Integration', () => {
  // ---------------------------------------------------------------------------
  // Adapter + Hypervisor Orchestration
  // ---------------------------------------------------------------------------

  describe('Adapter + Hypervisor Orchestration', () => {
    let hypervisor: MCPHypervisor;
    let adapter: StripeTestAdapter;

    beforeEach(async () => {
      const spawnFn = createMockSpawn();
      hypervisor = new MCPHypervisor({}, spawnFn as never);
      adapter = new StripeTestAdapter({ retryDelayMs: 10 });
      await hypervisor.start();
    });

    afterEach(async () => {
      adapter.dispose();
      await hypervisor.shutdown();
    });

    it('should spawn server, register tools, and execute through adapter', async () => {
      // Spawn server in hypervisor
      const spawnResult = await hypervisor.spawnServer({
        id: 'stripe',
        name: 'Stripe MCP',
        command: 'npx',
        args: ['@stripe/mcp'],
      });
      expect(spawnResult.success).toBe(true);

      // Register tools
      const tools: ToolCapability[] = [
        { name: 'create_payment_intent', description: 'Create payment', serverId: 'stripe' },
        { name: 'list_payments', description: 'List payments', serverId: 'stripe' },
      ];
      hypervisor.registerTools('stripe', tools);

      // Find tool and execute through adapter
      const tool = hypervisor.findTool('create_payment_intent');
      expect(tool).toBeDefined();
      expect(tool?.serverId).toBe('stripe');

      // Acquire slot
      expect(hypervisor.acquireSlot('stripe')).toBe(true);

      // Execute via adapter
      const response = await adapter.execute({
        action: 'create_payment_intent',
        parameters: { amount: 5000, currency: 'usd' },
      });

      expect(response.success).toBe(true);
      const data = response.data as { id: string; amount: number };
      expect(data.id).toBe('pi_test_123');
      expect(data.amount).toBe(5000);

      // Release slot
      hypervisor.releaseSlot('stripe');
      expect(hypervisor.getServer('stripe')?.activeRequests).toBe(0);
    });

    it('should handle full lifecycle: spawn -> tools -> execute -> stop', async () => {
      const events: string[] = [];
      hypervisor.on('server:started', () => events.push('started'));
      hypervisor.on('tool:discovered', () => events.push('tool'));
      hypervisor.on('server:stopped', () => events.push('stopped'));

      // Spawn
      await hypervisor.spawnServer({
        id: 'stripe',
        name: 'Stripe',
        command: 'npx',
        args: ['@stripe/mcp'],
      });

      // Register tools
      hypervisor.registerTools('stripe', [
        { name: 'create_payment_intent', description: 'Create', serverId: 'stripe' },
      ]);

      // Execute
      hypervisor.acquireSlot('stripe');
      const response = await adapter.execute({ action: 'create_payment_intent' });
      expect(response.success).toBe(true);
      hypervisor.releaseSlot('stripe');

      // Stop
      await hypervisor.stopServer('stripe');

      expect(events).toEqual(['started', 'tool', 'stopped']);
    });

    it('should handle multiple adapters with separate servers', async () => {
      const neonAdapter = new (class extends MCPAdapter {
        constructor() {
          super('neon', { retryDelayMs: 10 });
        }
        protected isValidAction(action: string): boolean {
          return action === 'create_database';
        }
        protected getAuthHeaderName(): string {
          return 'Authorization';
        }
        protected async executeRequest(): Promise<unknown> {
          return { id: 'db_123' };
        }
      })();

      try {
        await hypervisor.spawnServer({
          id: 'stripe',
          name: 'Stripe',
          command: 'npx',
          args: ['@stripe/mcp'],
        });
        await hypervisor.spawnServer({
          id: 'neon',
          name: 'Neon',
          remoteUrl: 'https://mcp.neon.tech',
        });

        // Execute on different adapters
        const stripeResponse = await adapter.execute({
          action: 'create_payment_intent',
          parameters: { amount: 1000 },
        });
        const neonResponse = await neonAdapter.execute({
          action: 'create_database',
        });

        expect(stripeResponse.success).toBe(true);
        expect(stripeResponse.metadata?.adapter).toBe('stripe');
        expect(neonResponse.success).toBe(true);
        expect(neonResponse.metadata?.adapter).toBe('neon');
      } finally {
        neonAdapter.dispose();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotency Key Integration
  // ---------------------------------------------------------------------------

  describe('Idempotency Key Integration', () => {
    let adapter: StripeTestAdapter;

    beforeEach(() => {
      adapter = new StripeTestAdapter({ retryDelayMs: 10 });
    });

    afterEach(() => {
      adapter.dispose();
    });

    it('should deduplicate identical payment creation requests', async () => {
      const request: MCPRequest = {
        action: 'create_payment_intent',
        parameters: { amount: 5000, currency: 'usd' },
        options: { idempotencyKey: 'payment-abc-123' },
      };

      const response1 = await adapter.execute(request);
      const response2 = await adapter.execute(request);

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      expect(response2.metadata?.cached).toBe(true);
      expect(response1.data).toEqual(response2.data);
    });

    it('should generate consistent keys for same parameters', () => {
      const key1 = generateIdempotencyKey({
        action: 'create_payment_intent',
        parameters: { amount: 1000, currency: 'usd' },
      });
      const key2 = generateIdempotencyKey({
        action: 'create_payment_intent',
        parameters: { amount: 1000, currency: 'usd' },
      });

      expect(key1).toBe(key2);
    });

    it('should generate unique keys for different payment amounts', () => {
      const key1 = generateIdempotencyKey({
        action: 'create_payment_intent',
        parameters: { amount: 1000 },
      });
      const key2 = generateIdempotencyKey({
        action: 'create_payment_intent',
        parameters: { amount: 2000 },
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate truly unique keys with generateUniqueIdempotencyKey', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateUniqueIdempotencyKey('create_payment'));
      }
      expect(keys.size).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Process Registry MCP Source
  // ---------------------------------------------------------------------------

  describe('Process Registry Integration', () => {
    it('should track MCP processes in the process registry', async () => {
      // Import the process registry
      const { processRegistry } = await import(
        '../../../packages/core/src/monitoring/process-registry.js'
      );

      processRegistry.setEnabled(true);
      processRegistry.clear();

      // Register an MCP process
      processRegistry.register(12345, 'npx', ['@stripe/mcp'], 'mcp', {
        server: 'stripe',
      });

      // Query by source
      const mcpProcesses = processRegistry.getBySource('mcp');
      expect(mcpProcesses).toHaveLength(1);
      expect(mcpProcesses[0].pid).toBe(12345);
      expect(mcpProcesses[0].source).toBe('mcp');
      expect(mcpProcesses[0].metadata?.server).toBe('stripe');

      // Check stats
      const stats = processRegistry.getStats();
      expect(stats.bySource.mcp).toBe(1);

      // Clean up
      processRegistry.clear();
    });

    it('should track multiple MCP server processes', async () => {
      const { processRegistry } = await import(
        '../../../packages/core/src/monitoring/process-registry.js'
      );

      processRegistry.setEnabled(true);
      processRegistry.clear();

      processRegistry.register(1001, 'npx', ['@stripe/mcp'], 'mcp');
      processRegistry.register(1002, 'mcp-remote', ['https://mcp.neon.tech'], 'mcp');
      processRegistry.register(1003, 'npx', ['supabase-mcp'], 'mcp');

      const mcpProcesses = processRegistry.getBySource('mcp');
      expect(mcpProcesses).toHaveLength(3);

      const stats = processRegistry.getStats();
      expect(stats.bySource.mcp).toBe(3);
      expect(stats.running).toBe(3);

      processRegistry.clear();
    });

    it('should update MCP process status on exit', async () => {
      const { processRegistry } = await import(
        '../../../packages/core/src/monitoring/process-registry.js'
      );

      processRegistry.setEnabled(true);
      processRegistry.clear();

      processRegistry.register(2001, 'npx', ['@stripe/mcp'], 'mcp');
      processRegistry.updateStatus(2001, 'completed', 0);

      const proc = processRegistry.get(2001);
      expect(proc?.status).toBe('completed');
      expect(proc?.exitCode).toBe(0);

      processRegistry.clear();
    });

    it('should detect zombie MCP processes', async () => {
      const { processRegistry } = await import(
        '../../../packages/core/src/monitoring/process-registry.js'
      );

      processRegistry.setEnabled(true);
      processRegistry.clear();

      processRegistry.register(3001, 'npx', ['@stripe/mcp'], 'mcp');
      processRegistry.markZombie(3001);

      const zombies = processRegistry.getZombies();
      expect(zombies).toHaveLength(1);
      expect(zombies[0].pid).toBe(3001);
      expect(zombies[0].source).toBe('mcp');

      processRegistry.clear();
    });
  });

  // ---------------------------------------------------------------------------
  // Tool Execution Pipeline
  // ---------------------------------------------------------------------------

  describe('Tool Execution Pipeline', () => {
    let adapter: StripeTestAdapter;

    beforeEach(() => {
      adapter = new StripeTestAdapter({ retryDelayMs: 10 });
    });

    afterEach(() => {
      adapter.dispose();
    });

    it('should execute create_payment_intent', async () => {
      const response = await adapter.execute({
        action: 'create_payment_intent',
        parameters: { amount: 2500, currency: 'eur' },
      });

      expect(response.success).toBe(true);
      const data = response.data as { id: string; amount: number; currency: string };
      expect(data.id).toBe('pi_test_123');
      expect(data.amount).toBe(2500);
      expect(data.currency).toBe('eur');
    });

    it('should execute list_payments', async () => {
      const response = await adapter.execute({
        action: 'list_payments',
      });

      expect(response.success).toBe(true);
      const data = response.data as { data: Array<{ id: string }>; has_more: boolean };
      expect(data.data).toHaveLength(2);
      expect(data.has_more).toBe(false);
    });

    it('should execute create_customer', async () => {
      const response = await adapter.execute({
        action: 'create_customer',
        parameters: { email: 'customer@example.com' },
      });

      expect(response.success).toBe(true);
      const data = response.data as { id: string; email: string };
      expect(data.email).toBe('customer@example.com');
    });

    it('should execute create_subscription', async () => {
      const response = await adapter.execute({
        action: 'create_subscription',
        parameters: { plan: 'max' },
      });

      expect(response.success).toBe(true);
      const data = response.data as { id: string; status: string; plan: string };
      expect(data.status).toBe('active');
      expect(data.plan).toBe('max');
    });

    it('should reject unknown Stripe tools', async () => {
      const response = await adapter.execute({
        action: 'delete_account',
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid action');
    });

    it('should handle concurrent tool executions', async () => {
      const responses = await Promise.all([
        adapter.execute({ action: 'create_payment_intent', parameters: { amount: 100 } }),
        adapter.execute({ action: 'list_payments' }),
        adapter.execute({ action: 'create_customer', parameters: { email: 'a@b.com' } }),
        adapter.execute({ action: 'create_subscription', parameters: { plan: 'pro' } }),
      ]);

      expect(responses.every((r) => r.success)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Error Scenarios
  // ---------------------------------------------------------------------------

  describe('Error Scenarios', () => {
    it('should handle adapter dispose during execution', async () => {
      const adapter = new StripeTestAdapter({ retryDelayMs: 10 });

      const response = await adapter.execute({
        action: 'create_payment_intent',
        parameters: { amount: 1000 },
      });
      expect(response.success).toBe(true);

      adapter.dispose();

      // Cache is cleared on dispose  -  executing again should still work
      // (adapter is stateless except for cache and cleanup interval)
      const response2 = await adapter.execute({ action: 'list_payments' });
      expect(response2.success).toBe(true);
    });

    it('should handle hypervisor shutdown during adapter execution', async () => {
      const spawnFn = createMockSpawn();
      const hypervisor = new MCPHypervisor({ shutdownTimeoutMs: 50 }, spawnFn as never);
      const adapter = new StripeTestAdapter({ retryDelayMs: 10 });

      await hypervisor.start();
      await hypervisor.spawnServer({
        id: 'stripe',
        name: 'Stripe',
        command: 'npx',
        args: ['@stripe/mcp'],
      });

      // Acquire slot and execute
      hypervisor.acquireSlot('stripe');
      const responsePromise = adapter.execute({
        action: 'create_payment_intent',
        parameters: { amount: 1000 },
      });

      // Shutdown while executing
      hypervisor.releaseSlot('stripe');
      await hypervisor.shutdown();

      // Adapter should still complete
      const response = await responsePromise;
      expect(response.success).toBe(true);

      adapter.dispose();
    });
  });
});
