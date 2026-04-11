import { createConnection, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HarnessRegistry } from '../registry/harness-registry.js';
import { RpcServer } from '../server/rpc-server.js';

vi.mock('../config/config-sync.js', () => ({
  syncConfig: vi.fn().mockReturnValue({ success: true, harnessId: 'test', direction: 'push' }),
  diffConfig: vi
    .fn()
    .mockReturnValue({ harnessId: 'test', localExists: true, ssdExists: true, identical: true }),
}));
vi.mock('../detection/process-detector.js', () => ({
  findAllHarnessProcesses: vi.fn().mockResolvedValue([]),
  findHarnessProcesses: vi.fn().mockResolvedValue([]),
}));

function socketPath(): string {
  return join(
    tmpdir(),
    `harness-rpc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
  );
}

async function connect(path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path);
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

async function sendRequest(
  socket: Socket,
  method: string,
  params?: unknown,
  id: number | string = 1,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const handler = (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            socket.off('data', handler);
            resolve(response);
          } catch {
            // incomplete  -  wait for more
          }
        }
      }
    };
    socket.on('data', handler);
    socket.on('error', reject);
    socket.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

describe('RpcServer (harnesses)', () => {
  let server: RpcServer;
  let registry: HarnessRegistry;
  let path: string;
  let socket: Socket;

  beforeEach(async () => {
    registry = new HarnessRegistry();
    path = socketPath();
    server = new RpcServer(registry, path);
    await server.start();
    socket = await connect(path);
  });

  afterEach(async () => {
    socket.destroy();
    await server.stop();
  });

  it('harness.list returns empty array when no adapters registered', async () => {
    const res = (await sendRequest(socket, 'harness.list')) as { result: unknown[] };
    expect(Array.isArray(res.result)).toBe(true);
  });

  it('harness.info returns error for unknown harness', async () => {
    const res = (await sendRequest(socket, 'harness.info', {
      harnessId: 'nonexistent',
    })) as { error: { code: number; message: string } };
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.message).toContain('not found');
  });

  it('harness.execute returns error for unknown harness', async () => {
    const res = (await sendRequest(socket, 'harness.execute', {
      harnessId: 'nonexistent',
      command: { type: 'get-status' },
    })) as { error: { code: number } };
    expect(res.error?.code).toBe(-32602);
  });

  it('harness.execute returns error when params missing', async () => {
    const res = (await sendRequest(socket, 'harness.execute', {})) as {
      error: { code: number };
    };
    expect(res.error?.code).toBe(-32602);
  });

  it('harness.syncConfig returns error when params missing', async () => {
    const res = (await sendRequest(socket, 'harness.syncConfig', {})) as {
      error: { code: number };
    };
    expect(res.error?.code).toBe(-32602);
  });

  it('harness.diffConfig returns error when params missing', async () => {
    const res = (await sendRequest(socket, 'harness.diffConfig', {})) as {
      error: { code: number };
    };
    expect(res.error?.code).toBe(-32602);
  });

  it('returns parse error for invalid JSON', async () => {
    const res = await new Promise<{ error: { code: number } }>((resolve) => {
      socket.once('data', (data) => {
        resolve(JSON.parse(data.toString()));
      });
      socket.write('not-valid-json\n');
    });
    expect(res.error?.code).toBe(-32700);
  });

  it('returns method not found for unknown method', async () => {
    const res = (await sendRequest(socket, 'harness.doesNotExist')) as {
      error: { code: number };
    };
    expect(res.error?.code).toBe(-32601);
  });

  it('preserves request id in response', async () => {
    const res = (await sendRequest(socket, 'harness.list', undefined, 99)) as { id: number };
    expect(res.id).toBe(99);
  });

  it('harness.health returns internal error when no health check configured', async () => {
    const res = (await sendRequest(socket, 'harness.health')) as {
      error: { code: number; message: string };
    };
    expect(res.error?.code).toBe(-32603);
    expect(res.error?.message).toContain('Health check not configured');
  });

  it('harness.health returns result when health check is configured', async () => {
    server.setHealthCheck(async () => ({ healthy: true, services: 'all ok' }));
    const res = (await sendRequest(socket, 'harness.health')) as {
      result: { healthy: boolean; services: string };
    };
    expect(res.result?.healthy).toBe(true);
    expect(res.result?.services).toBe('all ok');
  });

  it('harness.listRunning returns process list for a known harness', async () => {
    const res = (await sendRequest(socket, 'harness.listRunning', {
      harnessId: 'claude-code',
    })) as { result: unknown[] };
    expect(Array.isArray(res.result)).toBe(true);
  });

  it('harness.syncConfig returns success when params provided', async () => {
    const res = (await sendRequest(socket, 'harness.syncConfig', {
      harnessId: 'test',
      direction: 'push',
    })) as { result: { success: boolean } };
    expect(res.result?.success).toBe(true);
  });

  it('harness.diffConfig returns diff when harnessId provided', async () => {
    const res = (await sendRequest(socket, 'harness.diffConfig', {
      harnessId: 'test',
    })) as { result: { identical: boolean } };
    expect(res.result?.identical).toBe(true);
  });
});
