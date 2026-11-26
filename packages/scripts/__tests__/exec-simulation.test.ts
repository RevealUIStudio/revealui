import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchCommand } from '../cli/dispatch.js';
import { DryRunEngine } from '../dry-run/dry-run-engine.js';
import { execCommand, execParallel, execSequence, runPnpmScript } from '../exec.js';

const effects = vi.hoisted(() => ({ spawn: vi.fn(), register: vi.fn(), update: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: effects.spawn }));
vi.mock('@revealui/core/monitoring/process-registry', () => ({
  registerProcess: effects.register,
  updateProcessStatus: effects.update,
}));

describe('Supported executor simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effects.spawn.mockImplementation(() => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('close', 0, null));
      return child;
    });
  });

  it('does not spawn or register a direct simulated command', async () => {
    const result = await execCommand('pnpm', ['publish'], { dryRun: true });
    expect(effects.spawn.mock.calls.length).toBe(0);
    expect(effects.register).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, simulated: true, exitCode: 0 });
  });

  it('cannot disable sequence simulation with per-command options', async () => {
    await execSequence(
      [
        ['git', ['tag', 'v1.0.0'], { dryRun: false }],
        ['git', ['push'], { dryRun: false }],
      ],
      { dryRun: true },
    );
    expect(effects.spawn.mock.calls.length).toBe(0);
  });

  it('cannot disable parallel simulation with per-command options', async () => {
    await execParallel(
      [
        ['pnpm', ['publish'], { dryRun: false }],
        ['gh', ['workflow', 'run', 'release.yml'], { dryRun: false }],
      ],
      { dryRun: true },
    );
    expect(effects.spawn.mock.calls.length).toBe(0);
  });

  it('keeps the maintained pnpm helper simulation safe', async () => {
    await runPnpmScript('release:oss', { dryRun: true });
    expect(effects.spawn.mock.calls.length).toBe(0);
  });

  it('preserves actual normal executor outcomes', async () => {
    const result = await execCommand('fixture', ['normal'], { capture: true });
    expect(effects.spawn).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.simulated).not.toBe(true);
  });

  it('keeps active simulation monotonic through disabled nested engines and explicit options', async () => {
    const parent = new DryRunEngine({ enabled: true });
    await parent.run(async () => {
      parent.setEnabled(false);
      const nested = new DryRunEngine({ enabled: false });
      await nested.run(() => execCommand('fixture', [], { dryRun: false }));
      await nested.fs.writeFile('/synthetic/never-written', 'inert');
      await nested.exec('fixture');
    });
    expect(effects.spawn.mock.calls.length).toBe(0);
    expect(parent.getChanges()).toHaveLength(1);
  });

  it.each(['import', 'subprocess', 'auto'] as const)(
    'guards %s dispatch before import or execution',
    async (mode) => {
      const engine = new DryRunEngine({ enabled: true });
      const result = await engine.run(() =>
        dispatchCommand('/nonexistent/effectful-entrypoint.ts', {
          mode,
          dryRun: false,
        }),
      );
      expect(result.simulated).toBe(true);
      expect(effects.spawn.mock.calls.length).toBe(0);
      expect(engine.getChanges()).toHaveLength(1);
    },
  );

  it('supports explicit simulation for import dispatch without importing', async () => {
    const result = await dispatchCommand('/nonexistent/effectful-entrypoint.ts', {
      mode: 'import',
      dryRun: true,
    });
    expect(result.simulated).toBe(true);
    expect(effects.spawn.mock.calls.length).toBe(0);
  });

  it('isolates concurrent and later normal execution from simulation', async () => {
    let release: (() => void) | undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine = new DryRunEngine({ enabled: true });
    const simulation = engine.run(async () => {
      await barrier;
      return execCommand('simulated', [], { dryRun: false });
    });
    const actual = await execCommand('actual');
    release?.();
    const predicted = await simulation;
    const later = await execCommand('later');
    expect(predicted.simulated).toBe(true);
    expect(actual.simulated).not.toBe(true);
    expect(later.simulated).not.toBe(true);
    expect(effects.spawn.mock.calls.length).toBe(2);
    expect(engine.getChanges()).toHaveLength(1);
  });

  it('preserves an actual synthetic file through nested disabled-engine simulation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'revealui-simulation-'));
    const path = join(directory, 'sentinel.txt');
    try {
      await writeFile(path, 'unchanged');
      await new DryRunEngine({ enabled: true }).run(async () => {
        const nested = new DryRunEngine({ enabled: false });
        await nested.fs.writeFile(path, 'changed');
        await nested.fs.deleteFile(path);
        await nested.fs.rmdir(directory, true);
      });
      expect(await readFile(path, 'utf8')).toBe('unchanged');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('activates simulation monotonically when the scoped engine is enabled during execution', async () => {
    const engine = new DryRunEngine({ enabled: false });
    await engine.run(async () => {
      engine.setEnabled(true);
      engine.setEnabled(false);
      expect((await execCommand('fixture', [], { dryRun: false })).simulated).toBe(true);
    });
    expect(effects.spawn.mock.calls.length).toBe(0);
  });
});
