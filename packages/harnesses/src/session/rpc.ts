/**
 * Soft-optional JSON-RPC over the RevDev harness Unix socket.
 * Never throws for "daemon down" — callers treat null as skip.
 */

import { existsSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function defaultSocketPath(): string {
  return (
    process.env.REVEALUI_SOCKET ?? join(homedir(), '.local', 'share', 'revealui', 'harness.sock')
  );
}

/** Fast path: socket file exists (may still refuse connect if stale). */
export function isDaemonSocketPresent(socketPath: string = defaultSocketPath()): boolean {
  try {
    if (!existsSync(socketPath)) return false;
    const st = statSync(socketPath);
    // Unix sockets report as FIFO/socket; existence is enough for soft probe.
    return Boolean(st);
  } catch {
    return false;
  }
}

export interface RpcCallOptions {
  readonly socketPath?: string;
  readonly timeoutMs?: number;
  readonly signature?: string;
}

export async function rpcCall(
  method: string,
  params: Record<string, unknown> = {},
  options: RpcCallOptions = {},
): Promise<unknown> {
  const socketPath = options.socketPath ?? defaultSocketPath();
  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let buffer = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`RPC timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('connect', () => {
      const frame: Record<string, unknown> = {
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      };
      if (options.signature) {
        frame['x-revdev-signature'] = options.signature;
      }
      socket.write(`${JSON.stringify(frame)}\n`);
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const resp = JSON.parse(line) as {
            result?: unknown;
            error?: { message?: string; code?: number };
          };
          clearTimeout(timer);
          socket.destroy();
          if (resp.error) {
            reject(new Error(resp.error.message ?? `RPC error ${resp.error.code ?? ''}`));
          } else {
            resolve(resp.result);
          }
        } catch (err) {
          clearTimeout(timer);
          socket.destroy();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
