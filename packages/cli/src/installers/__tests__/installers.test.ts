import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock ora
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

// Mock the logger
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

import { execa } from 'execa';
import { initializeDatabase } from '../database.js';
import { seedDatabase } from '../seed.js';

const mockExeca = vi.mocked(execa);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initializeDatabase', () => {
  it('runs db:init and db:migrate in sequence', async () => {
    mockExeca.mockResolvedValue({} as Awaited<ReturnType<typeof execa>>);
    await initializeDatabase('/my/project');

    expect(mockExeca).toHaveBeenCalledTimes(2);
    expect(mockExeca).toHaveBeenNthCalledWith(1, 'pnpm', ['db:init'], {
      cwd: '/my/project',
      stdio: 'pipe',
    });
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'pnpm', ['db:migrate'], {
      cwd: '/my/project',
      stdio: 'pipe',
    });
  });

  it('does not throw when db:init fails', async () => {
    mockExeca.mockRejectedValueOnce(new Error('db:init failed'));
    // Should not throw  -  database setup is optional
    await expect(initializeDatabase('/my/project')).resolves.toBeUndefined();
  });

  it('does not throw when db:migrate fails', async () => {
    mockExeca.mockResolvedValueOnce({} as Awaited<ReturnType<typeof execa>>);
    mockExeca.mockRejectedValueOnce(new Error('db:migrate failed'));
    await expect(initializeDatabase('/my/project')).resolves.toBeUndefined();
  });

  it('uses the provided project path as cwd', async () => {
    mockExeca.mockResolvedValue({} as Awaited<ReturnType<typeof execa>>);
    await initializeDatabase('/some/other/path');

    for (const call of mockExeca.mock.calls as unknown[][]) {
      expect(call[2]).toEqual(expect.objectContaining({ cwd: '/some/other/path' }));
    }
  });
});

describe('seedDatabase', () => {
  it('runs pnpm run --if-present db:seed', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: 'Seeding complete',
    } as Awaited<ReturnType<typeof execa>>);
    await seedDatabase('/my/project');

    expect(mockExeca).toHaveBeenCalledOnce();
    expect(mockExeca).toHaveBeenCalledWith('pnpm', ['run', '--if-present', 'db:seed'], {
      cwd: '/my/project',
      stdio: 'pipe',
    });
  });

  it('does not throw when seeding fails', async () => {
    mockExeca.mockRejectedValueOnce(new Error('seed failed'));
    await expect(seedDatabase('/my/project')).resolves.toBeUndefined();
  });

  it('uses the provided project path as cwd', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: 'done',
    } as Awaited<ReturnType<typeof execa>>);
    await seedDatabase('/custom/path');

    expect(mockExeca).toHaveBeenCalledWith(
      'pnpm',
      ['run', '--if-present', 'db:seed'],
      expect.objectContaining({ cwd: '/custom/path' }),
    );
  });

  it('handles "Unknown command" output gracefully', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: 'Unknown command: db:seed',
    } as Awaited<ReturnType<typeof execa>>);
    // Should return early without error
    await expect(seedDatabase('/my/project')).resolves.toBeUndefined();
  });
});
