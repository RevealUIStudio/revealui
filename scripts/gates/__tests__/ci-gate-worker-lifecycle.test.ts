import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('retains admission in an actual validator after abrupt gate-parent termination', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'revealui-worker-lifecycle-'));
  const marker = join(directory, 'worker.pid');
  const lock = join(directory, `revealui-gate-${process.getuid?.() ?? 'user'}.lock`);
  const fixture = fileURLToPath(new URL('./fixtures/admission-worker.ts', import.meta.url));
  const parent = spawn(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), fixture, marker],
    {
      env: { ...process.env, TMPDIR: directory },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const exited = new Promise<void>((resolve) => parent.once('exit', () => resolve()));
  let worker: number | undefined;
  let output = '';
  parent.stdout?.on('data', (data) => {
    output += String(data);
  });
  parent.stderr?.on('data', (data) => {
    output += String(data);
  });
  try {
    await expect
      .poll(
        () => {
          assert.equal(parent.exitCode, null, output);
          return existsSync(marker);
        },
        { timeout: 10000 },
      )
      .toBe(true);
    worker = Number(readFileSync(marker, 'utf8'));
    assert.ok(Number.isInteger(worker) && worker > 1);
    parent.kill('SIGKILL');
    await exited;
    expect(spawnSync('flock', ['--nonblock', lock, 'true']).status).not.toBe(0);
    process.kill(-worker, 'SIGKILL');
    worker = undefined;
    await expect.poll(() => spawnSync('flock', ['--nonblock', lock, 'true']).status).toBe(0);
    expect(existsSync(lock)).toBe(true);
  } finally {
    if (worker) process.kill(-worker, 'SIGKILL');
    if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGKILL');
    await exited;
  }
}, 15000);
