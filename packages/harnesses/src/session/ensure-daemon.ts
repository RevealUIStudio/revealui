/**
 * Default local sessions use the installed service and its credential drop-ins.
 * Custom sockets belong to their caller; never start a different daemon for them.
 */
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { defaultSocketPath, rpcCall } from './rpc.js';

const exec = promisify(execFile);
let starting: Promise<boolean> | undefined;

async function ready(socketPath: string): Promise<boolean> {
  try {
    const result = await rpcCall('ping', {}, { socketPath, timeoutMs: 800 });
    return Boolean(
      result && typeof result === 'object' && (result as { pong?: boolean }).pong === true,
    );
  } catch {
    return false;
  }
}

export async function ensureDaemonForSession(socketPath = defaultSocketPath()): Promise<boolean> {
  const canonical = join(homedir(), '.local', 'share', 'revealui', 'harness.sock');
  if (process.platform !== 'linux' || resolve(socketPath) !== canonical) return false;
  if (await ready(socketPath)) return true;
  if (starting) return starting;
  starting = (async () => {
    try {
      await exec('systemctl', ['--user', 'start', 'revdev-daemon.service'], { timeout: 25_000 });
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        if (await ready(socketPath)) return true;
        await new Promise((done) => setTimeout(done, 200));
      }
    } catch {
      // Session hooks remain soft-optional when the service cannot start.
    }
    return false;
  })();
  try {
    return await starting;
  } finally {
    starting = undefined;
  }
}
