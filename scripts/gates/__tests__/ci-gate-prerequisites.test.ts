import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  calls: [] as string[][],
  failPrerequisite: false,
  log: vi.fn(),
}));
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

import { gate } from '../ci-gate';

afterEach(() => {
  vi.restoreAllMocks();
  state.calls = [];
  state.failPrerequisite = false;
});

describe('quality prerequisite ordering', () => {
  it('builds declared package graphs before quality consumers even with phase 3 disabled', async () => {
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
