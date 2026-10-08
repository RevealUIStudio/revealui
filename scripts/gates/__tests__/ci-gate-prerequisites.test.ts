import type { SpawnOptions } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  calls: [] as string[][],
  failPrerequisite: false,
  log: vi.fn(),
  flockPids: [] as (number | undefined)[],
  flockArguments: [] as string[][],
  admissionDirectory: null as string | null,
  failure: null as {
    exitCode: number;
    processExitCode: number | null;
    signal?: NodeJS.Signals;
    timedOut: boolean;
  } | null,
}));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: vi.fn((program: string, args: readonly string[], options: SpawnOptions) => {
      const child = actual.spawn(program, args, options);
      if (program === 'flock') {
        state.flockPids.push(child.pid);
        state.flockArguments.push([...args]);
      }
      return child;
    }),
  };
});
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    availableParallelism: () => 4,
    tmpdir: () => state.admissionDirectory ?? actual.tmpdir(),
  };
});
vi.mock('@revealui/scripts/errors.js', () => ({
  ErrorCode: { EXECUTION_ERROR: 1, VALIDATION_ERROR: 2 },
}));
vi.mock('@revealui/scripts/exec.js', () => ({
  execCommand: vi.fn(async (command: string, args: string[]) => {
    state.calls.push([command, ...args]);
    return {
      success: !(
        state.failure ||
        (state.failPrerequisite && args.includes('--filter=@revealui/harnesses...'))
      ),
      exitCode: state.failPrerequisite ? 7 : 0,
      ...(state.failure || {}),
      message: 'secret=synthetic-credential',
      stdout: 'secret=synthetic-credential',
      stderr: 'secret=synthetic-credential',
    };
  }),
}));
vi.mock('../../utils/base.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/base.js')>();
  return {
    ...actual,
    getProjectRoot: vi.fn(async () => '/project'),
    createLogger: () => ({
      ...actual.createLogger(),
      info: state.log,
      error: state.log,
      warning: state.log,
      success: state.log,
      header: state.log,
    }),
  };
});

import { gate, phaseConcurrency, printSummary, runCheck, withGateAdmission } from '../ci-gate';

afterEach(() => {
  vi.restoreAllMocks();
  state.calls = [];
  state.flockPids = [];
  state.flockArguments = [];
  state.failPrerequisite = false;
  state.admissionDirectory = null;
  state.failure = null;
  state.log.mockClear();
});

describe('gate command failure diagnostics', () => {
  it.each([
    { exitCode: 7, processExitCode: 7, timedOut: false },
    { exitCode: 1, processExitCode: null, signal: 'SIGTERM' as const, timedOut: false },
    { exitCode: 124, processExitCode: 0, timedOut: true },
  ])('retains exact process outcome without capture buffers: %j', async (failure) => {
    state.failure = failure;
    const result = await runCheck({
      name: 'fixture check',
      command: 'fixture',
      args: ['secret-argument'],
      timeout: 321,
    });
    expect(result.status).toBe('fail');
    expect(result.failure).toMatchObject(failure);
    if (failure.timedOut) expect(result.failure?.timeoutMs).toBe(321);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    printSummary([result], result.durationMs);
    const logged = JSON.stringify([state.log.mock.calls, output.mock.calls, result]);
    expect(logged).not.toContain('synthetic-credential');
    expect(logged).not.toContain('secret-argument');
    expect(logged).toContain(`status=${failure.exitCode}`);
    if ('signal' in failure) expect(logged).toContain('signal=SIGTERM');
    if (failure.timedOut) expect(logged).toContain('timeout=321ms');
  });

  it('preserves warning-only policy while reporting the failed process', async () => {
    state.failure = { exitCode: 7, processExitCode: 7, timedOut: false };
    const result = await runCheck({
      name: 'warning check',
      command: 'fixture',
      args: [],
      warnOnly: true,
    });
    expect(result.status).toBe('warn');
    expect(result.failure?.exitCode).toBe(7);
    expect(state.log).toHaveBeenCalledWith('warning check: exit=7, status=7');
  });
});

describe('quality prerequisite ordering', () => {
  it('builds declared package graphs before quality consumers even with phase 3 disabled', async () => {
    vi.spyOn(process, 'availableMemory').mockReturnValue(4 * 1024 ** 3);
    vi.spyOn(process, 'argv', 'get').mockReturnValue([
      'node',
      'ci-gate.ts',
      '--phase=1',
      '--no-build',
    ]);
    await gate();
    expect(state.calls[0]).toEqual([
      'pnpm',
      'turbo',
      'run',
      'build',
      '--filter=@revealui/harnesses...',
      '--filter=@revealui/claim-gates...',
      '--concurrency=2',
    ]);
    expect(state.calls.some((call) => call.includes('--manager-only'))).toBe(true);
    expect(state.calls.some((call) => call.includes('validate:claims'))).toBe(true);
  });
  it('fails closed and never launches export consumers when the dependency build fails', async () => {
    vi.spyOn(process, 'availableMemory').mockReturnValue(4 * 1024 ** 3);
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'ci-gate.ts', '--phase=1']);
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('gate exit');
    });
    state.failPrerequisite = true;
    await expect(gate()).rejects.toThrow('gate exit');
    expect(state.calls).toHaveLength(1);
    expect(process.exit).toHaveBeenCalledWith(expect.any(Number));
  });
});

describe('gate resource admission', () => {
  it.each([
    { label: 'missing', flags: [] },
    { label: 'duplicate', flags: ['--concurrency=1', '--concurrency=2'] },
    { label: 'zero', flags: ['--concurrency=0'] },
    { label: 'negative', flags: ['--concurrency=-1'] },
    { label: 'fraction', flags: ['--concurrency=1.5'] },
    { label: 'empty', flags: ['--concurrency='] },
    { label: 'NaN', flags: ['--concurrency=NaN'] },
    { label: 'infinite', flags: ['--concurrency=Infinity'] },
  ])('rejects $label Turbo worker caps without launching a command', async ({ flags }) => {
    await expect(
      runCheck({
        name: 'invalid cap fixture',
        command: 'pnpm',
        args: ['turbo', 'run', 'test', ...flags],
      }),
    ).rejects.toThrow('worker cap');
    expect(state.calls).toEqual([]);
  });

  it.each([
    { phase: 2, changed: false, memoryGiB: 1.5, cap: 1 },
    { phase: 2, changed: true, memoryGiB: 1.5, cap: 1 },
    { phase: 2, changed: false, memoryGiB: 4, cap: 2 },
    { phase: 2, changed: true, memoryGiB: 4, cap: 2 },
    { phase: 3, changed: false, memoryGiB: 1.5, cap: 1 },
    { phase: 3, changed: true, memoryGiB: 1.5, cap: 1 },
    { phase: 3, changed: false, memoryGiB: 4, cap: 2 },
    { phase: 3, changed: true, memoryGiB: 4, cap: 2 },
  ])(
    'bounds phase $phase package fan-out with $memoryGiB GiB (changed=$changed)',
    async ({ phase, changed, memoryGiB, cap }) => {
      vi.spyOn(process, 'availableMemory').mockReturnValue(memoryGiB * 1024 ** 3);
      vi.spyOn(process, 'argv', 'get').mockReturnValue([
        'node',
        'ci-gate.ts',
        `--phase=${phase}`,
        ...(changed ? ['--changed'] : []),
      ]);
      await gate();
      const tasks = state.calls.filter((call) => call[1] === 'turbo');
      expect(tasks.map((call) => call[3])).toEqual(phase === 2 ? ['typecheck'] : ['test', 'build']);
      for (const task of tasks) expect(task).toContain(`--concurrency=${cap}`);
    },
  );

  it.each(['--no-test', '--no-build'])('preserves phase3 requested scope %s', async (flag) => {
    vi.spyOn(process, 'availableMemory').mockReturnValue(1.5 * 1024 ** 3);
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'ci-gate.ts', '--phase=3', flag]);
    await gate();
    const tasks = state.calls.filter((call) => call[1] === 'turbo');
    expect(tasks.map((call) => call[3])).toEqual(flag === '--no-test' ? ['build'] : ['test']);
    expect(tasks[0]).toContain('--concurrency=1');
  });

  it('rechecks available headroom before build after the serial test finishes', async () => {
    vi.spyOn(process, 'availableMemory')
      .mockReturnValueOnce(4 * 1024 ** 3)
      .mockReturnValueOnce(4 * 1024 ** 3)
      .mockReturnValue(1.5 * 1024 ** 3);
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'ci-gate.ts', '--phase=3']);
    await gate();
    const tasks = state.calls.filter((call) => call[1] === 'turbo');
    expect(tasks[0]).toContain('--concurrency=2');
    expect(tasks[1]).toContain('--concurrency=1');
  });

  it('caps configured concurrency by available memory and CPU', () => {
    expect(phaseConcurrency(49, { memoryBytes: 2.5 * 1024 ** 3, cpus: 8, requested: '49' })).toBe(
      2,
    );
    expect(phaseConcurrency(49, { memoryBytes: 16 * 1024 ** 3, cpus: 2, requested: '49' })).toBe(2);
    expect(phaseConcurrency(49, { memoryBytes: 16 * 1024 ** 3, cpus: 8, requested: '1' })).toBe(1);
  });

  it('rejects insufficient headroom instead of admitting an over-budget worker', () => {
    expect(() => phaseConcurrency(1, { memoryBytes: 1024 ** 3, cpus: 8, requested: '49' })).toThrow(
      'admission rejected',
    );
    expect(phaseConcurrency(0, { memoryBytes: 0, cpus: 8, requested: undefined })).toBe(0);
  });

  it.each(['0', '-1', '1.5', 'NaN'])('rejects invalid configured concurrency %s', (requested) => {
    expect(() => phaseConcurrency(2, { memoryBytes: 4 * 1024 ** 3, cpus: 8, requested })).toThrow(
      'positive integer',
    );
  });

  it.skipIf(process.platform !== 'linux')(
    'queues concurrent operations and releases admission after failure',
    async () => {
      state.admissionDirectory = mkdtempSync(join(tmpdir(), 'revealui-admission-test-'));
      vi.spyOn(process, 'availableMemory').mockReturnValue(4 * 1024 ** 3);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const events: string[] = [];
      try {
        const first = withGateAdmission(async () => {
          events.push('first');
          await held;
          throw new Error('synthetic check failure');
        });
        const firstFailure = expect(first).rejects.toThrow('synthetic check failure');
        await vi.waitFor(() => expect(events).toEqual(['first']));
        const second = withGateAdmission(async () => {
          events.push('second');
        });
        const secondCompletion = expect(second).resolves.toBeUndefined();
        const secondPid = await vi.waitFor(() => {
          expect(state.flockPids).toHaveLength(2);
          const pid = state.flockPids[1];
          if (pid === undefined) throw new Error('Second lock process did not start.');
          expect(readFileSync(`/proc/${pid}/wchan`, 'utf8').trim()).toBe('locks_lock_inode_wait');
          return pid;
        });
        expect(state.flockArguments[1]).toEqual(['--exclusive', '3']);
        expect(secondPid).toBeTypeOf('number');
        expect(events).toEqual(['first']);
        release();
        await firstFailure;
        await secondCompletion;
        expect(events).toEqual(['first', 'second']);
      } finally {
        release();
      }
    },
  );

  it.skipIf(process.platform !== 'linux').each(['SIGINT', 'SIGTERM'] as const)(
    'terminates a blocked flock waiter and exits the gate on %s',
    async (signal) => {
      state.admissionDirectory = mkdtempSync(join(tmpdir(), 'revealui-admission-test-'));
      vi.spyOn(process, 'availableMemory').mockReturnValue(4 * 1024 ** 3);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const events: string[] = [];
      const existingHandlers = process.listeners(signal);
      try {
        const first = withGateAdmission(async () => {
          events.push('first');
          await held;
        });
        const firstCompletion = expect(first).resolves.toBeUndefined();
        await vi.waitFor(() => expect(events).toEqual(['first']));

        const waiting = withGateAdmission(async () => {
          events.push('cancelled waiter operation');
        });
        const waitingFailure = expect(waiting).rejects.toThrow(
          `CI gate admission interrupted (${signal}).`,
        );
        await vi.waitFor(() => {
          expect(state.flockPids).toHaveLength(2);
          const pid = state.flockPids[1];
          if (pid === undefined) throw new Error('Second lock process did not start.');
          expect(readFileSync(`/proc/${pid}/wchan`, 'utf8').trim()).toBe('locks_lock_inode_wait');
          const handler = process
            .listeners(signal)
            .find((listener) => !existingHandlers.includes(listener));
          expect(handler).toBeTypeOf('function');
          return handler;
        });
        expect(state.flockArguments[1]).toEqual(['--exclusive', '3']);

        const handler = process
          .listeners(signal)
          .find((listener) => !existingHandlers.includes(listener));
        handler?.call(process);
        await waitingFailure;
        expect(events).toEqual(['first']);
        expect(process.listeners(signal)).toEqual(existingHandlers);

        release();
        await firstCompletion;
        await withGateAdmission(async () => {
          events.push('next');
        });
        expect(events).toEqual(['first', 'next']);
      } finally {
        release();
      }
    },
  );
});
