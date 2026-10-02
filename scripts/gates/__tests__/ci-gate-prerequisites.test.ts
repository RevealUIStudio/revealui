import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  calls: [] as string[][],
  failPrerequisite: false,
  log: vi.fn(),
  admissionDirectory: null as string | null,
}));
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
      success: !(state.failPrerequisite && args.includes('--filter=@revealui/harnesses...')),
    };
  }),
}));
vi.mock('../../utils/base.js', () => ({
  getProjectRoot: vi.fn(async () => '/project'),
  createLogger: () => ({
    info: state.log,
    error: state.log,
    success: state.log,
    header: state.log,
  }),
}));

import { gate, phaseConcurrency, runCheck, withGateAdmission } from '../ci-gate';

afterEach(() => {
  vi.restoreAllMocks();
  state.calls = [];
  state.failPrerequisite = false;
  state.admissionDirectory = null;
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

  it('holds admission across concurrent operations and releases it after failure', async () => {
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
      await vi.waitFor(() => expect(events).toEqual(['first']));
      await expect(
        withGateAdmission(async () => {
          events.push('second');
        }),
      ).rejects.toThrow('admission lock failed');
      expect(events).toEqual(['first']);
      release();
      await expect(first).rejects.toThrow('synthetic check failure');
      await withGateAdmission(async () => {
        events.push('second');
      });
      expect(events).toEqual(['first', 'second']);
    } finally {
      release();
    }
  });
});
