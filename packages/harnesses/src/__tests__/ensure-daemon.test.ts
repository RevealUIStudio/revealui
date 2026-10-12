import { homedir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('node:util', () => ({ promisify: () => mocks.exec }));
vi.mock('../session/rpc.js', () => ({
  defaultSocketPath: () => join(homedir(), '.local', 'share', 'revealui', 'harness.sock'),
  rpcCall: mocks.rpc,
}));

import { ensureDaemonForSession } from '../session/ensure-daemon.js';

describe.skipIf(process.platform !== 'linux')('session daemon startup', () => {
  beforeEach(() => {
    mocks.exec.mockReset();
    mocks.rpc.mockReset();
  });

  it('reuses a daemon that answers ping', async () => {
    mocks.rpc.mockResolvedValue({ pong: true });
    expect(await ensureDaemonForSession()).toBe(true);
    expect(mocks.exec).not.toHaveBeenCalled();
  });

  it('starts the installed service and waits for readiness', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ pong: true });
    mocks.exec.mockResolvedValue({});
    expect(await ensureDaemonForSession()).toBe(true);
    expect(mocks.exec).toHaveBeenCalledWith(
      'systemctl',
      ['--user', 'start', 'revdev-daemon.service'],
      { timeout: 25_000 },
    );
  });

  it('does not start a service for a custom socket', async () => {
    expect(await ensureDaemonForSession('/tmp/custom-daemon.sock')).toBe(false);
    expect(mocks.exec).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns a soft failure when service startup fails', async () => {
    mocks.rpc.mockRejectedValue(new Error('offline'));
    mocks.exec.mockRejectedValue(new Error('service failed'));
    expect(await ensureDaemonForSession()).toBe(false);
    expect(mocks.exec).toHaveBeenCalledTimes(1);
  });
});
