import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('@revealui/setup/utils', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
    header: vi.fn(),
    divider: vi.fn(),
  }),
}));

vi.mock('../utils/command.js', () => ({
  commandExists: vi.fn(),
}));

vi.mock('../utils/workspace.js', () => ({
  findWorkspaceRoot: vi.fn(),
}));

vi.mock('../runtime/doctor.js', () => ({
  gatherDoctorReport: vi.fn(),
  formatDoctorReport: vi.fn(() => 'doctor report'),
}));

vi.mock('../commands/db.js', () => ({
  runDbInitCommand: vi.fn(),
  runDbStartCommand: vi.fn(),
}));

import { execa } from 'execa';
import { runShellCommand } from '../commands/shell.js';
import { gatherDoctorReport } from '../runtime/doctor.js';
import { commandExists } from '../utils/command.js';
import { findWorkspaceRoot } from '../utils/workspace.js';

const mockExeca = vi.mocked(execa);
const mockCommandExists = vi.mocked(commandExists);
const mockFindWorkspaceRoot = vi.mocked(findWorkspaceRoot);
const mockGatherDoctorReport = vi.mocked(gatherDoctorReport);

describe('runShellCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.IN_NIX_SHELL;
    mockGatherDoctorReport.mockResolvedValue({
      workspaceRoot: '/repo',
      dbTarget: 'local',
      checks: [{ id: 'postgres', ok: true, detail: 'postgres running' }],
    });
  });

  it('re-enters through nix develop with forwarded dev up flags', async () => {
    mockCommandExists.mockImplementation(async (command) => command === 'nix');
    mockFindWorkspaceRoot.mockReturnValue('/repo');
    mockExeca.mockResolvedValue({} as Awaited<ReturnType<typeof execa>>);

    const reentered = await runShellCommand({
      ensure: true,
      forwardArgs: ['--dry-run', '--profile', 'fullstack'],
    });

    expect(reentered).toBe(true);
    expect(mockExeca).toHaveBeenCalledWith(
      'nix',
      [
        'develop',
        '-c',
        'node',
        'packages/cli/bin/revealui.js',
        'dev',
        'up',
        '--dry-run',
        '--profile',
        'fullstack',
        '--inside',
      ],
      {
        cwd: '/repo',
        stdio: 'inherit',
      },
    );
  });

  it('re-enters through nix develop with forwarded dev status flags', async () => {
    mockCommandExists.mockImplementation(async (command) => command === 'nix');
    mockFindWorkspaceRoot.mockReturnValue('/repo');
    mockExeca.mockResolvedValue({} as Awaited<ReturnType<typeof execa>>);

    const reentered = await runShellCommand({
      ensure: false,
      forwardArgs: ['--profile', 'agent', '--script', 'dev:api'],
    });

    expect(reentered).toBe(true);
    expect(mockExeca).toHaveBeenCalledWith(
      'nix',
      [
        'develop',
        '-c',
        'node',
        'packages/cli/bin/revealui.js',
        'dev',
        'status',
        '--profile',
        'agent',
        '--script',
        'dev:api',
        '--inside',
      ],
      {
        cwd: '/repo',
        stdio: 'inherit',
      },
    );
  });
});
